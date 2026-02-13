"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { SIDEBAR_POLL_INTERVAL_MS } from "../lib/constants";

export interface ShortListEntry {
  nameId: number;
  name: string;
  user1Rating: number;
  user2Rating: number;
  addedAt: string;
}

export function useShortList(coupleId: number | null) {
  const [shortList, setShortList] = useState<ShortListEntry[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchShortList = useCallback(async () => {
    if (!coupleId) return;
    const res = await fetch(`/api/baby-name-rater/shortlist?coupleId=${coupleId}`);
    if (!res.ok) return;
    const data = await res.json();
    setShortList(data.shortList);
  }, [coupleId]);

  useEffect(() => {
    fetchShortList();

    // Poll every 30s for partner updates
    intervalRef.current = setInterval(fetchShortList, SIDEBAR_POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchShortList]);

  return { shortList, fetchShortList };
}
