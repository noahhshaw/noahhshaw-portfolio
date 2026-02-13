"use client";

import { useState, useCallback } from "react";

export function useRating(
  userId: number | null,
  coupleId: number | null,
  onRated?: () => void
) {
  const [submitting, setSubmitting] = useState(false);

  const submitRating = useCallback(
    async (nameId: number, rating: number) => {
      if (!userId || !coupleId) return;
      setSubmitting(true);

      try {
        const res = await fetch("/api/baby-name-rater/ratings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, nameId, coupleId, rating }),
        });

        if (!res.ok) throw new Error("Failed to submit rating");

        await res.json();
        onRated?.();
      } catch (err) {
        console.error("Rating submission failed:", err);
      } finally {
        setSubmitting(false);
      }
    },
    [userId, coupleId, onRated]
  );

  return { submitRating, submitting };
}
