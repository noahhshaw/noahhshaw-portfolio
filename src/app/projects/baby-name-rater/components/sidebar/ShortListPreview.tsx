"use client";

import type { ShortListEntry } from "../../hooks/useShortList";

interface ShortListPreviewProps {
  entries: ShortListEntry[];
}

export default function ShortListPreview({ entries }: ShortListPreviewProps) {
  if (entries.length === 0) {
    return (
      <div className="text-sm text-slate/60">
        No matches yet
      </div>
    );
  }

  return (
    <ul className="space-y-1.5">
      {entries.map((entry) => (
        <li
          key={entry.nameId}
          className="flex items-center justify-between text-sm"
        >
          <span className="text-charcoal font-medium">{entry.name}</span>
          <span className="text-xs text-slate">
            {entry.user1Rating} + {entry.user2Rating}
          </span>
        </li>
      ))}
    </ul>
  );
}
