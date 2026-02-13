"use client";

import { useState, useCallback, useEffect } from "react";

export interface RecentRating {
  nameId: number;
  name: string;
  rating: number;
  updatedAt: string;
}

export function useRecentRatings(userId: number | null) {
  const [recentRatings, setRecentRatings] = useState<RecentRating[]>([]);

  const fetchRecent = useCallback(async () => {
    if (!userId) return;
    const res = await fetch(`/api/baby-name-rater/ratings/recent?userId=${userId}`);
    if (!res.ok) return;
    const data = await res.json();
    setRecentRatings(data.ratings);
  }, [userId]);

  // Optimistic add — prepend a new rating to the list
  const addOptimistic = useCallback(
    (nameId: number, name: string, rating: number) => {
      setRecentRatings((prev) => {
        const updated = [
          { nameId, name, rating, updatedAt: new Date().toISOString() },
          ...prev.filter((r) => r.nameId !== nameId),
        ].slice(0, 5);
        return updated;
      });
    },
    []
  );

  useEffect(() => {
    fetchRecent();
  }, [fetchRecent]);

  return { recentRatings, fetchRecent, addOptimistic };
}
