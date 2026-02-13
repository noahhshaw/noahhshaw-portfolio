"use client";

import { useRef, useEffect } from "react";

interface LetterFilterProps {
  value: string;
  onChange: (letter: string) => void;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function LetterFilter({ value, onChange }: LetterFilterProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [value]);

  return (
    <div
      ref={scrollRef}
      className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide"
    >
      <button
        ref={value === "all" ? activeRef : null}
        onClick={() => onChange("all")}
        className={`shrink-0 w-7 h-7 flex items-center justify-center text-xs font-bold uppercase rounded-md transition-colors ${
          value === "all"
            ? "bg-white text-charcoal shadow-sm"
            : "text-slate hover:text-charcoal"
        }`}
      >
        All
      </button>
      {LETTERS.map((letter) => (
        <button
          key={letter}
          ref={value === letter ? activeRef : null}
          onClick={() => onChange(letter)}
          className={`shrink-0 w-7 h-7 flex items-center justify-center text-xs font-bold rounded-md transition-colors ${
            value === letter
              ? "bg-white text-charcoal shadow-sm"
              : "text-slate hover:text-charcoal"
          }`}
        >
          {letter}
        </button>
      ))}
    </div>
  );
}
