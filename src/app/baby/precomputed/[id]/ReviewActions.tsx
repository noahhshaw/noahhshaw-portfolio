"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReviewActions({
  id,
  status,
}: {
  id: number;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function patch(newStatus: string, rejectionReason?: string | null) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/baby/precomputed", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus, rejectionReason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErr(data.error ?? `error ${res.status}`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (status === "sent") {
    return (
      <p className="text-[11px] text-gray-500">
        This email has been sent and can no longer be edited.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== "approved" && (
        <button
          onClick={() => patch("approved")}
          disabled={busy}
          className="rounded bg-emerald-700 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          {busy ? "…" : "Approve"}
        </button>
      )}
      {status !== "rejected" && (
        <button
          onClick={() => {
            const reason = window.prompt("Rejection reason (optional):") ?? "";
            patch("rejected", reason || null);
          }}
          disabled={busy}
          className="rounded border border-red-300 px-3 py-1 text-xs text-red-700 disabled:opacity-50"
        >
          Reject
        </button>
      )}
      {status !== "draft" && status !== "sent" && (
        <button
          onClick={() => patch("draft")}
          disabled={busy}
          className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-700 disabled:opacity-50"
        >
          Reset to draft
        </button>
      )}
      {err && <span className="text-[11px] text-red-700">{err}</span>}
    </div>
  );
}
