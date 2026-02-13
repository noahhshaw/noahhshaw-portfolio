"use client";

import { useState, useCallback, useRef } from "react";
import type { Name } from "@/db/schema";

export function useNextName(userId: number | null, coupleId: number | null) {
  const [currentName, setCurrentName] = useState<Name | null>(null);
  const [loading, setLoading] = useState(false);
  const prefetchedRef = useRef<Name | null>(null);

  const fetchName = useCallback(
    async (excludeNameId?: number): Promise<Name | null> => {
      if (!userId || !coupleId) return null;

      const params = new URLSearchParams({
        userId: String(userId),
        coupleId: String(coupleId),
      });
      if (excludeNameId) {
        params.set("excludeNameId", String(excludeNameId));
      }

      const res = await fetch(`/api/baby-name-rater/names/next?${params}`);
      if (!res.ok) return null;
      const data = await res.json();

      return data.name || null;
    },
    [userId, coupleId]
  );

  const loadNext = useCallback(
    async (excludeNameId?: number) => {
      // Use prefetched name if available
      if (prefetchedRef.current) {
        const next = prefetchedRef.current;
        prefetchedRef.current = null;
        setCurrentName(next);
        // Start prefetching the one after that
        fetchName(next.id).then((name) => {
          prefetchedRef.current = name;
        });
        return;
      }

      setLoading(true);
      const name = await fetchName(excludeNameId);
      setCurrentName(name);
      setLoading(false);

      // Prefetch the next one
      if (name) {
        fetchName(name.id).then((prefetched) => {
          prefetchedRef.current = prefetched;
        });
      }
    },
    [fetchName]
  );

  const loadInitial = useCallback(async () => {
    prefetchedRef.current = null;
    setLoading(true);
    const name = await fetchName();
    setCurrentName(name);
    setLoading(false);

    // Prefetch the next one
    if (name) {
      fetchName(name.id).then((prefetched) => {
        prefetchedRef.current = prefetched;
      });
    }
  }, [fetchName]);

  return { currentName, loading, loadNext, loadInitial };
}
