import { promises as fs } from "fs";
import path from "path";

// KB content lives in /baby-kb at the repo root. Vercel includes it in the
// deployed bundle (it's just files under the project). At runtime we read it
// from disk relative to process.cwd(), which on Vercel is the project root.

let _voiceGuideCache: { content: string; loadedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // re-read voice.md every 5 minutes

export async function loadVoiceGuide(): Promise<string> {
  const now = Date.now();
  if (_voiceGuideCache && now - _voiceGuideCache.loadedAt < CACHE_TTL_MS) {
    return _voiceGuideCache.content;
  }
  const filePath = path.join(process.cwd(), "baby-kb", "voice.md");
  try {
    const content = await fs.readFile(filePath, "utf8");
    _voiceGuideCache = { content, loadedAt: now };
    return content;
  } catch (err) {
    console.error("[kb-loader] voice.md not found at", filePath, err);
    return DEFAULT_VOICE;
  }
}

const DEFAULT_VOICE = `# Voice Guide (fallback)
Data-dense, warm, reassuring, "HBS finance mom" register. Lead with action,
cite sources, calibrate severity with [low concern]/[monitor]/[call within 24h]/
[call now]. No saccharine adjectives, no emoji, no exclamation points.`;
