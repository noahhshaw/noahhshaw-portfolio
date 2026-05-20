import Anthropic from "@anthropic-ai/sdk";
import { loadVoiceGuide } from "./kb-loader";

// Multimodal classifier + reply drafter. Called from process-replies once
// per inbound reply (NOT batched across replies — see the 2026-05-14
// product rule revision). Receives one reply with any attached images,
// returns a structured decision: classification, whether to reply, the
// reply body itself, any context to persist, any KB-update request to
// queue.
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

export type FeedbackChangeType =
  | "voice"
  | "code"
  | "kb-content"
  | "calendar"
  | "recipient"
  | "other";

export type FeedbackItem = {
  changeType: FeedbackChangeType;
  targetPath: string; // e.g. "baby-kb/voice.md", "src/lib/baby/constants.ts"
  changeSummary: string; // 1–2 sentence what-and-why
  evidenceQuote: string; // verbatim quote from the parent's reply
  confidence: "low" | "medium" | "high";
};

export type ClassifierResult = {
  classification: Classification;
  shouldReply: boolean;
  /** Plain-prose reply body. HTML is rendered downstream by cleanReplyHtml. */
  replyText?: string;
  contextToStore: ContextEntry[];
  feedbackItems: FeedbackItem[];
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
  /** A single inbound reply. One classifier call ↔ one outbound response. */
  reply: ReplyInput;
  originalDailyEmail?: DailyEmailContext;
  babyContext: {
    babyName: string | null;
    ageInDays: number;
    weekIndex: number;
    status: string;
  };
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
  const { reply } = inputs;
  // Strip the user's client's quoted history (the daily email they replied
  // to, plus any prior agent responses) before sending to the classifier.
  // The quoted block is what they're responding to, not what they wrote.
  // Keeping it in inflates input by 10-20x for a long daily email and was
  // the cause of the 2026-05-20 truncated-reply incident.
  const userPortion = stripQuotedHistory(reply.bodyText ?? "");
  userContent.push({
    type: "text",
    text: `\n--- inbound reply received ${reply.receivedAt.toISOString()} ---\nSubject: ${
      reply.subject ?? "(none)"
    }\n\n${userPortion || "(no plain-text body)"}`,
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

  const response = await client.messages.create({
    model: MODEL,
    // 4096 leaves headroom for the full tool-use envelope (classification +
    // reasoning + reply_text + context_to_store + feedback_items). With
    // 2048 a long reply_text could be truncated and the SDK returned a
    // partial tool_use with reply_text undefined — see 2026-05-20 incident.
    max_tokens: 4096,
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
    replyText: args.reply_text,
    contextToStore: (args.context_to_store ?? []).map((c) => ({
      contentType: c.content_type,
      content: c.content,
      tags: c.tags ?? [],
    })),
    feedbackItems: (args.feedback_items ?? []).map((f) => ({
      changeType: f.change_type,
      targetPath: f.target_path,
      changeSummary: f.change_summary,
      evidenceQuote: f.evidence_quote,
      confidence: f.confidence ?? "medium",
    })),
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
  return lines.join("\n");
}

const SYSTEM_PROLOGUE = `You are the inbound-reply agent for "Daily Baby" — a daily email service for Noah Shaw and Anoushka Vaswani about their first child (a boy, due 2026-05-11). Your job is to read inbound replies from a parent, decide whether they need a response, and if so draft it. Never invent medical facts. Never violate the voice guide.`;

const SYSTEM_TASK = `## Your task

You will receive ONE inbound reply from a parent (not a batch). One reply in, at most one outbound response. The user content includes the original daily email they're replying to, the reply text, and any attached images.

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

3. If should_reply, draft **reply_text** (plain-prose body only). Do NOT draft HTML — the pipeline renders HTML from the text, paragraph-wraps it, and auto-links bare URLs. Do NOT draft a subject — the pipeline forces the outgoing subject to match the inbound thread.

   **Formatting rules for reply_text (strict — output is validated):**
   - Plain prose in paragraphs separated by a blank line. NO markdown: no \`**bold**\`, no \`*italic*\`, no \`---\` separators, no leading \`- \` or \`1. \` list markers, no inline backticks.
   - If you need to call out a severity flag use bracketed shorthand inside the sentence, e.g. "[call within 24h]".
   - Inline authority URLs as bare URLs in the prose — email clients linkify them, and the HTML renderer will anchor them with humanized text.

4. **context_to_store**: every meaningful fact about the baby, the family, dates, preferences, or noted concerns goes here so future emails can use it. Each entry has a content_type and tags.

5. **feedback_items**: One entry per **distinct change request** the parent made. A single reply can contain multiple asks ("change the voice AND add my birthday AND fix this typo") — emit one item per ask. For each:
   - **change_type**:
     - "voice" → edits to baby-kb/voice.md (the binding tone guide)
     - "code" → edits to src/* (TypeScript)
     - "kb-content" → edits to baby-kb/topics/*.md or baby-kb/buckets/week-NN.md
     - "calendar" → adds to calendar_events table (one-click approve later, no PR needed)
     - "recipient" → edits to BABY_PARENT_EMAILS in constants.ts
     - "other" → anything else
   - **target_path**: best guess at the file path that should change
   - **change_summary**: 1–2 sentences in imperative voice ("Add inline source URLs to all topic deep-dives")
   - **evidence_quote**: verbatim quote from the parent's reply that asks for this change
   - **confidence**: "high" if the parent stated it clearly and unambiguously; "medium" if implied; "low" if uncertain inference. Apply the anti-overfit rule: parents are tired and stressed. Don't infer changes that aren't clearly stated.

Leave feedback_items empty if classification is not "feedback" (or if the feedback is purely conversational with no actionable change).

6. **reasoning**: 1-2 sentences explaining the classification and whether you replied. This is for the audit log, not the parent.

Critical rules:
- The reply MUST be plain prose written in the voice guide register. No exclamation points. No saccharine framing.
- If the parent asks about a symptom or concerning observation, you may give a severity flag and reasoning. Do not refuse.
- For images: describe what you see briefly in context_to_store (e.g., "Photo of baby smiling at 7 weeks") and reference it if relevant in the reply.
- If the parent asked something the KB doesn't cover (you genuinely don't know), say so plainly and add a feedback_item with change_type="kb-content".
- Anti-overfit: parents are tired and stressed; their inputs are noisy. Don't infer changes from a single ambiguous comment. When confidence is low, mark it as such — the human will review.
- Privacy: never quote parent-supplied context verbatim in the reply body. Use it only to inform classification decisions.

Return your decision via the "respond" tool.`;

type ToolArgs = {
  classification: Classification;
  should_reply: boolean;
  reply_text?: string;
  context_to_store?: Array<{
    content_type: ContextEntry["contentType"];
    content: string;
    tags?: string[];
  }>;
  feedback_items?: Array<{
    change_type: FeedbackChangeType;
    target_path: string;
    change_summary: string;
    evidence_quote: string;
    confidence?: "low" | "medium" | "high";
  }>;
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
    feedback_items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          change_type: {
            type: "string",
            enum: ["voice", "code", "kb-content", "calendar", "recipient", "other"],
          },
          target_path: { type: "string" },
          change_summary: { type: "string" },
          evidence_quote: { type: "string" },
          confidence: {
            type: "string",
            enum: ["low", "medium", "high"],
          },
        },
        required: [
          "change_type",
          "target_path",
          "change_summary",
          "evidence_quote",
        ],
      },
    },
    reasoning: { type: "string" },
  },
  required: ["classification", "should_reply", "reasoning"],
};

/**
 * Strip the quoted-history block from a plain-text email body so the
 * classifier sees only the user's new content.
 *
 * Gmail (and most clients) prefix the quoted block with an attribution
 * line like "On Thu, May 14, 2026 at 7:50 PM, ... wrote:" followed by
 * lines starting with "> ". We cut at the first such attribution or at
 * the first run of "> "-prefixed lines, whichever comes first.
 *
 * Also handles the legacy "[Quoted text hidden]" marker some clients
 * substitute when collapsing a quote.
 *
 * Exported for unit testing.
 */
export function stripQuotedHistory(text: string): string {
  if (!text) return text;
  const lines = text.split(/\r?\n/);
  let cutAt = -1;

  // Pattern A: Gmail attribution line. Cover common date formats by being
  // permissive — anchored on "On <stuff> wrote:" optionally with trailing
  // whitespace or stray Unicode.
  const ATTR = /^On\s.+\swrote:\s*$/;
  // Pattern B: a line starting with "> " — the canonical reply-quote marker.
  const QUOTE = /^>\s?/;
  // Pattern C: collapsed quote marker.
  const COLLAPSED = /^\[Quoted text hidden\]\s*$/;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (ATTR.test(l) || COLLAPSED.test(l)) {
      cutAt = i;
      break;
    }
    // Two consecutive "> "-prefixed lines is a strong quote signal.
    if (QUOTE.test(l) && i + 1 < lines.length && QUOTE.test(lines[i + 1])) {
      cutAt = i;
      break;
    }
  }

  if (cutAt < 0) return text.trim();
  return lines.slice(0, cutAt).join("\n").trim();
}

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
