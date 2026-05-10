import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { precomputedEmails } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { getCurrentParent } from "@/lib/baby/session";

export const runtime = "nodejs";

// Lists all pre-computed emails with summary fields. Body excluded; use
// /api/baby/precomputed/[id] for the full body.

export async function GET() {
  const parent = await getCurrentParent();
  if (!parent) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: precomputedEmails.id,
      ageInDays: precomputedEmails.ageInDays,
      weekIndex: precomputedEmails.weekIndex,
      subject: precomputedEmails.subject,
      generatedAt: precomputedEmails.generatedAt,
      kbVersion: precomputedEmails.kbVersion,
      modelUsed: precomputedEmails.modelUsed,
      tokensUsed: precomputedEmails.tokensUsed,
      costUsd: precomputedEmails.costUsd,
      status: precomputedEmails.status,
      reviewedAt: precomputedEmails.reviewedAt,
      reviewedByEmail: precomputedEmails.reviewedByEmail,
      validationIssues: precomputedEmails.validationIssues,
      sentAt: precomputedEmails.sentAt,
    })
    .from(precomputedEmails)
    .orderBy(asc(precomputedEmails.ageInDays));
  return NextResponse.json({ rows });
}

type PatchBody = {
  id: number;
  status?: "draft" | "approved" | "rejected" | "stale";
  rejectionReason?: string | null;
};

export async function PATCH(request: NextRequest) {
  const parent = await getCurrentParent();
  if (!parent) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!Number.isFinite(body.id)) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  if (
    body.status &&
    !["draft", "approved", "rejected", "stale"].includes(body.status)
  ) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {
    reviewedAt: new Date(),
    reviewedByEmail: parent.email,
  };
  if (body.status) patch.status = body.status;
  if (body.rejectionReason !== undefined)
    patch.rejectionReason = body.rejectionReason;

  const updated = await db
    .update(precomputedEmails)
    .set(patch)
    .where(eq(precomputedEmails.id, body.id))
    .returning();
  return NextResponse.json({ row: updated[0] });
}
