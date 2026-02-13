"use client";

interface RatingStatsProps {
  totalRatings: number;
  shortListCount: number;
}

export default function RatingStats({
  totalRatings,
  shortListCount,
}: RatingStatsProps) {
  const likeRatio = shortListCount > 0 ? Math.round((shortListCount / Math.max(totalRatings, 1)) * 100) : 0;

  return (
    <div className="space-y-4">
      <h2 className="text-[11px] font-bold text-charcoal uppercase tracking-wider">
        Stats
      </h2>

      <div className="flex gap-4">
        <div className="flex-1 bg-white border border-slate/20 rounded-lg p-4">
          <div className="text-2xl font-bold text-charcoal">{totalRatings}</div>
          <div className="text-xs text-slate mt-1">Rated</div>
        </div>
        <div className="flex-1 bg-white border border-slate/20 rounded-lg p-4">
          <div className="text-2xl font-bold text-charcoal">{shortListCount}</div>
          <div className="text-xs text-slate mt-1">Matches</div>
        </div>
      </div>

      {totalRatings > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate">Progress</span>
            <span className="text-xs font-bold text-charcoal">{likeRatio}% match</span>
          </div>
          <div className="w-full h-1 bg-slate/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal rounded-full transition-all duration-300"
              style={{ width: `${Math.min((totalRatings / 100) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
