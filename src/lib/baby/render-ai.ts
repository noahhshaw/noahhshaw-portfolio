import Anthropic from "@anthropic-ai/sdk";
import { promises as fs } from "fs";
import path from "path";

// AI-driven email renderer used for pre-computation.
// Inputs: age + KB content. NO parent_context, NO live email replies.
// Outputs: a render with `{{UPCOMING_HTML}}` / `{{UPCOMING_TEXT}}` placeholders
// that the daily cron substitutes from the current calendar state.

const MODEL = "claude-sonnet-4-6";

export type AIRenderResult = {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  citations: string[];
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd: string;
};

export type AIRenderInput = {
  ageInDays: number;
  weekIndex: number;
  voiceGuide: string;
  bucketContent: string;
  topicExcerpts: Array<{ path: string; content: string }>;
  calendarHints: Array<{ daysAway: number; title: string; eventType: string }>;
};

export async function generateEmailAI(
  input: AIRenderInput
): Promise<AIRenderResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
  const client = new Anthropic({ apiKey });

  const systemBlocks: Anthropic.Messages.TextBlockParam[] = [
    {
      type: "text",
      text: SYSTEM_PROLOGUE,
    },
    {
      type: "text",
      text: `## Voice guide (binding)\n\n${input.voiceGuide}`,
      cache_control: { type: "ephemeral" },
    },
    {
      type: "text",
      text: SYSTEM_TASK,
    },
  ];

  const userText = buildUserPrompt(input);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: systemBlocks,
    tools: [
      {
        name: "emit_email",
        description:
          "Emit the rendered email for the given day, with placeholders for the dynamic Upcoming section.",
        input_schema: TOOL_SCHEMA,
      },
    ],
    tool_choice: { type: "tool", name: "emit_email" },
    messages: [{ role: "user", content: userText }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("renderer did not produce a tool_use block");
  }
  const args = toolUse.input as ToolArgs;

  const usage = {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
  };

  return {
    subject: args.subject,
    bodyHtml: args.body_html,
    bodyText: args.body_text,
    citations: args.citations ?? [],
    ...usage,
    costUsd: estimateCost(usage),
  };
}

function buildUserPrompt(input: AIRenderInput): string {
  const lines: string[] = [];
  lines.push(`# Today\nAge in days: ${input.ageInDays}\nWeek of life: ${input.weekIndex}`);
  lines.push("");
  lines.push(`# Bucket content (baby-kb/buckets/week-${String(input.weekIndex).padStart(2, "0")}.md)\n${input.bucketContent}`);
  if (input.topicExcerpts.length > 0) {
    lines.push("");
    lines.push("# Relevant topic deep-dives");
    for (const t of input.topicExcerpts) {
      lines.push(`\n## ${t.path}\n${t.content}`);
    }
  }
  if (input.calendarHints.length > 0) {
    lines.push("");
    lines.push("# Static calendar hints (deterministic events for this age)");
    for (const c of input.calendarHints) {
      lines.push(`- in ${c.daysAway} days: ${c.eventType} — ${c.title}`);
    }
  }
  lines.push("");
  lines.push(
    "Emit the rendered email via the `emit_email` tool. Body must contain the `{{UPCOMING_HTML}}` placeholder in body_html and `{{UPCOMING_TEXT}}` placeholder in body_text where the dynamic upcoming-events section will be substituted at send time. The placeholders take the place of the entire 'Upcoming' section header AND its bullets."
  );
  return lines.join("\n");
}

const SYSTEM_PROLOGUE = `You are the daily render agent for Daily Baby — a one-year newsletter for Noah Shaw and Anushka Vaswani about their son Avi (born 2026-05-09). Your job is to produce a single day's email body, ahead of time, that will be reviewed before being approved for sending.

You receive only deterministic inputs: the baby's age, the relevant week-bucket KB file, optional topic deep-dive files, and a small list of static calendar hints (vaccines, well-visits — events that depend only on age). You DO NOT receive parent-supplied context, replies, or photos. The email you produce must remain valid regardless of whatever a parent says or does between now and send time.`;

const SYSTEM_TASK = `## Your task

Produce one daily email following the voice guide exactly.

Email structure (each section uses a clear heading; omit a section entirely if you have nothing substantive to say in it):

1. **Today's focus** — 1–2 sentences. Pull from the bucket file's "Focus" field; rephrase to fit subject naturally.
2. **Action items** — bulleted, imperative. Time-sensitive only.
3. **Watch-fors** — bulleted, each tagged with a severity flag in square brackets: [low concern] / [monitor] / [call within 24h] / [call now]. The flag is mandatory.
4. **Enrichment opportunity** — one concrete thing to do today, evidence-grounded.
5. **Upcoming** — REPLACE THIS ENTIRE SECTION (heading + bullets) with the placeholder \`{{UPCOMING_HTML}}\` (in body_html) and \`{{UPCOMING_TEXT}}\` (in body_text). Do NOT enumerate events yourself.
6. **Source** — 1–3 lines crediting the baby-kb/* file paths used. Each citation in the citations array MUST be a baby-kb/... path, never an author name.

Subject: \`Day N: {most important info}\`. N is the age in days. The hook is the single most actionable thing in today's email — never a generic summary. ≤72 chars.

Hard rules from the voice guide (re-read it; rules may have changed):
- Tone: data-dense, warm, reassuring, "HBS finance mom." No saccharine register, no woke/identity language, no crunchy/RIE/attachment-parenting framing.
- Default pronoun for the baby is **he/him**.
- No emoji.
- No exclamation points except inside [call now] content.
- Cite KB files inline (e.g., "[baby-kb/topics/sleep-newborn-fundamentals.md]") and list every cited path in the citations array.
- Privacy contract: the email NEVER contains content sourced from a parent reply, photo caption, or recentContext. You don't have access to those, so this is a no-op for you — but if you find yourself wanting to reference "what someone mentioned," stop. The email is one-to-many, addressable to anyone in the recipient list, and may be read by third parties.
- Length: 250–500 words.

Return your output via the \`emit_email\` tool.`;

type ToolArgs = {
  subject: string;
  body_html: string;
  body_text: string;
  citations?: string[];
  reasoning?: string;
};

const TOOL_SCHEMA: Anthropic.Messages.Tool.InputSchema = {
  type: "object",
  properties: {
    subject: { type: "string", maxLength: 72 },
    body_html: { type: "string" },
    body_text: { type: "string" },
    citations: { type: "array", items: { type: "string" } },
    reasoning: { type: "string" },
  },
  required: ["subject", "body_html", "body_text", "citations"],
};

function estimateCost(usage: {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}): string {
  const cost =
    (usage.inputTokens * 3.0) / 1_000_000 +
    (usage.outputTokens * 15.0) / 1_000_000 +
    (usage.cacheCreationTokens * 3.75) / 1_000_000 +
    (usage.cacheReadTokens * 0.3) / 1_000_000;
  return cost.toFixed(6);
}

// ---- KB loaders (used by the precompute script) ----

const KB_ROOT = path.join(process.cwd(), "baby-kb");

export async function loadVoiceGuideFromDisk(): Promise<string> {
  return fs.readFile(path.join(KB_ROOT, "voice.md"), "utf8");
}

export async function loadBucketFromDisk(weekIndex: number): Promise<string> {
  const w = String(Math.max(1, Math.min(52, weekIndex))).padStart(2, "0");
  const file = path.join(KB_ROOT, "buckets", `week-${w}.md`);
  return fs.readFile(file, "utf8");
}

export async function loadTopicFromDisk(filename: string): Promise<string> {
  const file = path.join(KB_ROOT, "topics", filename);
  return fs.readFile(file, "utf8");
}

export async function listTopicFiles(): Promise<string[]> {
  const dir = path.join(KB_ROOT, "topics");
  return (await fs.readdir(dir)).filter((f) => f.endsWith(".md"));
}
