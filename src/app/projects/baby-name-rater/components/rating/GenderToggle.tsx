"use client";

interface GenderToggleProps {
  value: string;
  onChange: (filter: string) => void;
}

const OPTIONS = [
  { value: "all", label: "All" },
  { value: "boy", label: "Boy" },
  { value: "girl", label: "Girl" },
];

export default function GenderToggle({ value, onChange }: GenderToggleProps) {
  return (
    <div className="flex items-center gap-0.5 bg-slate/10 rounded-lg p-0.5">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-colors ${
            value === option.value
              ? "bg-white text-charcoal shadow-sm"
              : "text-slate hover:text-charcoal"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
