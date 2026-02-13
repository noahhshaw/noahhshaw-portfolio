"use client";

import { useEffect, useCallback } from "react";

interface RatingControlsProps {
  onRate: (rating: number) => void;
  disabled?: boolean;
}

const RATING_OPTIONS = [
  { value: 1, label: "Nope", shortcut: "1" },
  { value: 2, label: "Meh", shortcut: "2" },
  { value: 3, label: "Okay", shortcut: "3" },
  { value: 4, label: "Like", shortcut: "4" },
  { value: 5, label: "Love", shortcut: "5" },
];

export default function RatingControls({
  onRate,
  disabled,
}: RatingControlsProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (disabled) return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 5) {
        e.preventDefault();
        onRate(num);
      }
    },
    [onRate, disabled]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex items-center justify-center gap-2">
      {RATING_OPTIONS.map((option) => (
        <button
          key={option.value}
          onClick={() => onRate(option.value)}
          disabled={disabled}
          className="flex flex-col items-center gap-1 w-14 md:w-16 py-2 md:py-3 rounded-lg border-2 border-slate/20 bg-white text-charcoal font-bold text-base md:text-lg transition-colors hover:bg-teal hover:text-white hover:border-teal active:bg-teal-dark disabled:opacity-30 disabled:cursor-not-allowed"
          title={`${option.label} (press ${option.shortcut})`}
        >
          {option.value}
          <span className="text-[10px] font-medium text-slate uppercase tracking-wider">
            {option.label}
          </span>
        </button>
      ))}
    </div>
  );
}
