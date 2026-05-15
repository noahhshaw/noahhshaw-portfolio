/**
 * Lightweight request-trace logger for the inbound→processor pipeline.
 *
 * Every log line is:
 *   - prefixed with [baby-trace], so it's grep-able in Vercel logs
 *   - tagged with a correlation id (typically the email message-id or a
 *     UUID), so logs from inbound + processor for the same reply line up
 *   - structured JSON, so we can pipe to log search later without parsing
 *
 * In addition, every event is also pushed to a capped Redis list
 * (`baby:trace:recent`) so the diagnostic endpoint can surface the last
 * N events without relying on Vercel log retention. The list is trimmed
 * to TRACE_RECENT_MAX entries.
 */

import { redis, isRedisConfigured } from "@/lib/redis";

const TRACE_RECENT_KEY = "baby:trace:recent";
const TRACE_RECENT_MAX = 200;

export type TraceLevel = "info" | "warn" | "error";

export type TraceEvent = {
  ts: string;
  level: TraceLevel;
  traceId: string;
  stage: string;
  message: string;
  data?: Record<string, unknown>;
};

export function newTraceId(prefix = "trace"): string {
  // Cheap, non-crypto. Just needs to be unique within a short window.
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export async function trace(
  level: TraceLevel,
  traceId: string,
  stage: string,
  message: string,
  data?: Record<string, unknown>
): Promise<void> {
  const event: TraceEvent = {
    ts: new Date().toISOString(),
    level,
    traceId,
    stage,
    message,
    data,
  };
  // Always stdout so Vercel function logs capture it.
  const line = `[baby-trace] ${JSON.stringify(event)}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  // Best-effort Redis capture so the diag endpoint has history. Never
  // throws — Redis hiccups must not break the inbound path.
  if (isRedisConfigured()) {
    try {
      await redis.lpush(TRACE_RECENT_KEY, JSON.stringify(event));
      await redis.ltrim(TRACE_RECENT_KEY, 0, TRACE_RECENT_MAX - 1);
    } catch (err) {
      console.error("[baby-trace] redis push failed", err);
    }
  }
}

export async function readRecentTrace(limit = 100): Promise<TraceEvent[]> {
  if (!isRedisConfigured()) return [];
  try {
    const raw = await redis.lrange(TRACE_RECENT_KEY, 0, limit - 1);
    const out: TraceEvent[] = [];
    for (const item of raw) {
      try {
        // upstash returns parsed objects sometimes, strings other times
        const v: TraceEvent =
          typeof item === "string" ? JSON.parse(item) : (item as TraceEvent);
        out.push(v);
      } catch {
        // skip malformed entry
      }
    }
    return out;
  } catch (err) {
    console.error("[baby-trace] redis read failed", err);
    return [];
  }
}
