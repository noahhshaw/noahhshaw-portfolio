"use client";

import RecentRatings from "./RecentRatings";
import ShortListPreview from "./ShortListPreview";
import RatingStats from "./RatingStats";
import type { RecentRating } from "../../hooks/useRecentRatings";
import type { ShortListEntry } from "../../hooks/useShortList";

interface SidebarProps {
  recentRatings: RecentRating[];
  shortList: ShortListEntry[];
  totalRatings?: number;
}

export default function Sidebar({ recentRatings, shortList, totalRatings = 0 }: SidebarProps) {
  return (
    <aside className="w-72 shrink-0 space-y-5">
      <RatingStats totalRatings={totalRatings || recentRatings.length} shortListCount={shortList.length} />

      <div>
        <h2 className="text-[11px] font-bold text-charcoal uppercase tracking-wider mb-3">
          Recent
        </h2>
        <RecentRatings ratings={recentRatings} />
      </div>

      <div>
        <h2 className="text-[11px] font-bold text-charcoal uppercase tracking-wider mb-3">
          Short List
          {shortList.length > 0 && (
            <span className="ml-2 text-[11px] font-normal text-slate">
              {shortList.length}
            </span>
          )}
        </h2>
        <ShortListPreview entries={shortList} />
      </div>
    </aside>
  );
}
