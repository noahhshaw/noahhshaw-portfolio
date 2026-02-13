"use client";

import { useState, useEffect } from "react";
import { SIDEBAR_POLL_INTERVAL_MS } from "../lib/constants";

interface RatingStats {
  totalRatings: number;
  shortListCount: number;
}

export function useRatingStats(userId: number | null, coupleId: number | null) {
  const [stats, setStats] = useState<RatingStats>({
    totalRatings: 0,
    shortListCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !coupleId) {
      setLoading(false);
      return;
    }

    const fetchStats = async () => {
      try {
        const params = new URLSearchParams({
          userId: String(userId),
          coupleId: String(coupleId),
        });
        const res = await fetch(`/api/baby-name-rater/ratings/stats?${params}`);
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error("Failed to fetch rating stats:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, SIDEBAR_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [userId, coupleId]);

  return { ...stats, loading };
}
