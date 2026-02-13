"use client";

import type { RecentRating } from "../../hooks/useRecentRatings";

interface RecentRatingsProps {
  ratings: RecentRating[];
}

export default function RecentRatings({ ratings }: RecentRatingsProps) {
  if (ratings.length === 0) {
    return (
      <div className="text-sm text-slate/60">
        No names rated yet
      </div>
    );
  }

  return (
    <ul className="space-y-1.5">
      {ratings.map((r) => (
        <li
          key={r.nameId}
          className="flex items-center justify-between text-sm"
        >
          <span className="text-charcoal">{r.name}</span>
          <span className="text-xs font-bold text-slate bg-slate/10 rounded px-1.5 py-0.5" title={`Rating: ${r.rating}`}>
            {r.rating}
          </span>
        </li>
      ))}
    </ul>
  );
}
