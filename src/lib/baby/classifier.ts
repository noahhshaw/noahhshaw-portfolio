import Anthropic from "@anthropic-ai/sdk";
import { loadVoiceGuide } from "./kb-loader";

// Multimodal classifier + reply drafter. Called from process-replies after
// the debounce window elapses. Receives the batched replies from one sender,
// returns a structured decision: classification, whether to reply, the reply
// itself, any context to persist, any KB-update request to queue.
//
// We use Sonnet 4.6 (cheap, capable, multimodal) with prompt caching on the
// voice guide and the prior daily-email context.

const MODEL = "claude-sonnet-4-6";

export type Classification =
  | "question"
  | "context"
  | "feedback"
  | "photo-only"
  | "none";

export type ContextEntry = {
  contentType: "milestone" | "note" | "concern" | "preference" | "photo-tag";
  content: string;
  tags: string[];
};

export type ClassifierResult = {
  classification: Classification;
  shouldReply: boolean;
  replySubject?: string;
  replyHtml?: string;
  replyText?: string;
  contextToStore: ContextEntry[];
  kbUpdateRequest?: string;
  reasoning: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
};

export type ReplyAttachmentInput = {
  base64: string;
  mediaType: string; // e.g. "image/jpeg"
  filename?: string;
};

export type ReplyInput = {
  receivedAt: Date;
  subject: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  attachments: ReplyAttachmentInput[];
};

export type DailyEmailContext = {
  sentDate: string;
  subject: string;
  bodyText: string;
};

export type ClassifierInputs = {
  fromEmail: string;
  fromName?: string;
  replies: ReplyInput[];
  originalDailyEmail?: DailyEmailContext;
  babyContext: {
    babyName: string | null;
    ageInDays: number;
    weekIndex: number;
    status: string;
  };
  recentParentContext: Array<{ contentType: string; content: string }>;
};

export async function classifyAndDraft(
  inputs: ClassifierInputs
): Promise<ClassifierResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }
  const client = new Anthropic({ apiKey });
  const voice = await loadVoiceGuide();

  const systemBlocks: Anthropic.Messages.TextBlockParam[] = [
    {
      type: "text",
      text: SYSTEM_PROLOGUE,
    },
    {
      type: "text",
      text: `## Voice guide (binding)\n\n${voice}`,
      cache_control: { type: "ephemeral" },
    },
    {
      type: "text",
      text: SYSTEM_TASK,
    },
  ];

  const userContent: Anthropic.Messages.ContentBlockParam[] = [];
  userContent.push({
    type: "text",
    text: buildContextBlock(inputs),
  });
  for (const reply of inputs.replies) {
    userContent.push({
      type: "text",
      text: `\n--- inbound reply received ${reply.receivedAt.toISOString()} ---\nSubject: ${
        reply.subject ?? "(none)"
      }\n\n${reply.bodyText ?? "(no plain-text body)"}`,
    });
    for (const att of reply.attachments) {
      if (att.mediaType.startsWith("image/")) {
        userContent.push({
          type: "image",
          source: {
            type: "base64",
            media_type: att.mediaType as
              | "image/jpeg"
              | "image/png"
              | "image/gif"
              | "image/webp",
            data: att.base64,
          },
        });
        userContent.push({
          type: "text",
          text: `(image attached: ${att.filename ?? "unnamed"})`,
        });
      } else {
        userContent.push({
          type: "text",
          text: `(non-image attachment: ${att.filename ?? "unnamed"} ${att.mediaType})`,
        });
      }
    }
  }

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: systemBlocks,
    tools: [
      {
        name: "respond",
        description:
          "Classify the parent's reply batch, optionally draft a response, and emit any context to persist.",
        input_schema: TOOL_SCHEMA,
      },
    ],
    tool_choice: { type: "tool", name: "respond" },
    messages: [{ role: "user", content: userContent }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("classifier did not produce a tool_use block");
  }
  const args = toolUse.input as ToolArgs;

  return {
    classification: args.classification,
    shouldReply: args.should_reply,
    replySubject: args.reply_subject,
    replyHtml: args.reply_html,
    replyText: args.reply_text,
    contextToStore: (args.context_to_store ?? []).map((c) => ({
      contentType: c.content_type,
      content: c.content,
      tags: c.tags ?? [],
    })),
    kbUpdateRequest: args.kb_update_request ?? undefined,
    reasoning: args.reasoning,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
  };
}

function buildContextBlock(inputs: ClassifierInputs): string {
  const lines: string[] = [];
  lines.push(
    `## Baby\nName: ${inputs.babyContext.babyName ?? "(not yet set)"}\nAge: ${inputs.babyContext.ageInDays} days (week ${inputs.babyContext.weekIndex}, ${inputs.babyContext.status})`
  );
  lines.push(`\n## Sender\n${inputs.fromEmail}`);
  if (inputs.originalDailyEmail) {
    lines.push(
      `\n## Today's outbound email (subject: "${inputs.originalDailyEmail.subject}")\n${inputs.originalDailyEmail.bodyText}`
    );
  }
  if (inputs.recentParentContext.length > 0) {
    lines.push(
      `\n## Recent parent-supplied context (last 7 days)\n${inputs.recentParentContext
        .map((c) => `- ${c.contentType}: ${c.content}`)
        .join("\n")}`
    );
  }
  return lines.join("\n");
}

const SYSTEM_PROLOGUE = `You are the inbound-reply agent for "Daily Baby" — a daily email service for Noah Shaw and Anushka Vaswani about their first child (a boy, due 2026-05-11). Your job is to read inbound replies from a parent, decide whether they need a response, and if so draft it. Never invent medical facts. Never violate the voice guide.`;

const SYSTEM_TASK = `## Your task

You will receive one batch of replies from a single parent (debounced over 10 minutes). The user content includes the original daily email they're replying to, recent context, and the reply text + any attached images.

Decide:

1. **classification** (pick one):
   - "question" — they're asking for advice, information, or a severity judgment
   - "feedback" — they want to change how the agent operates (tone, frequency, topics, scope)
   - "context" — they're sharing information for the agent to remember (a milestone, a date, a note about the baby) but not asking anything
   - "photo-only" — only attachments, no meaningful text. Treat as memory unless the parent explicitly asks something
   - "none" — auto-replies, vacation responders, mistakes, or genuinely empty content

2. **should_reply**:
   - "question" → true
   - "feedback" → true (acknowledge the change and what was queued)
   - "context" → false (silently store)
   - "photo-only" → false (silently store; no nag-prompts for tags)
   - "none" → false

3. If should_reply, draft **reply_subject** (≤72 chars, prefix "Re: " of inbound subject is fine), **reply_html**, and **reply_text**. Match the voice guide above. Severity judgments allowed using the four-tier flag set; do NOT diagnose.

4. **context_to_store**: every meaningful fact about the baby, the family, dates, preferences, or noted concerns goes here so future emails can use it. Each entry has a content_type and tags.

5. **kb_update_request**: only set this if the parent has explicitly asked the agent to learn something it doesn't know, or to update its long-term knowledge. Otherwise null.

6. **reasoning**: 1-2 sentences explaining the classification and whether you replied. This is for the audit log, not the parent.

Critical rules:
- The reply MUST be plain prose written in the voice guide register. No exclamation points. No saccharine framing.
- If the parent asks about a symptom or concerning observation, you may give a severity flag and reasoning. Do not refuse.
- For images: describe what you see briefly in context_to_store (e.g., "Photo of baby smiling at 7 weeks") and reference it if relevant in the reply.
- If the parent asked something the KB doesn't cover (you genuinely don't know), say so plainly and queue a kb_update_request.

Return your decision via the "respond" tool.`;

type ToolArgs = {
  classification: Classification;
  should_reply: boolean;
  reply_subject?: string;
  reply_html?: string;
  reply_text?: string;
  context_to_store?: Array<{
    content_type: ContextEntry["contentType"];
    content: string;
    tags?: string[];
  }>;
  kb_update_request?: string | null;
  reasoning: string;
};

const TOOL_SCHEMA: Anthropic.Messages.Tool.InputSchema = {
  type: "object",
  properties: {
    classification: {
      type: "string",
      enum: ["question", "context", "feedback", "photo-only", "none"],
    },
    should_reply: { type: "boolean" },
    reply_subject: { type: "string", maxLength: 72 },
    reply_html: { type: "string" },
    reply_text: { type: "string" },
    context_to_store: {
      type: "array",
      items: {
        type: "object",
        properties: {
          content_type: {
            type: "string",
            enum: [
              "milestone",
              "note",
              "concern",
              "preference",
              "photo-tag",
            ],
          },
          content: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["content_type", "content"],
      },
    },
    kb_update_request: { type: ["string", "null"] },
    reasoning: { type: "string" },
  },
  required: ["classification", "should_reply", "reasoning"],
};

export function estimateCost(usage: {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}): string {
  // Sonnet 4.6 pricing (subject to change):
  //   input:           $3.00 / MTok
  //   output:         $15.00 / MTok
  //   cache write:    $3.75 / MTok
  //   cache read:     $0.30 / MTok
  const cost =
    (usage.inputTokens * 3.0) / 1_000_000 +
    (usage.outputTokens * 15.0) / 1_000_000 +
    (usage.cacheCreationTokens * 3.75) / 1_000_000 +
    (usage.cacheReadTokens * 0.3) / 1_000_000;
  return cost.toFixed(6);
}
