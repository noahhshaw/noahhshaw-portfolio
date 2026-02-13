"use client";

import type { Name } from "@/db/schema";

interface NameCardProps {
  name: Name;
}

export default function NameCard({ name }: NameCardProps) {
  const famousPeople = [
    name.famousPerson1,
    name.famousPerson2,
    name.famousPerson3,
  ].filter(Boolean);

  const altSpellings = name.alternativeSpellings?.filter(Boolean) || [];

  return (
    <div className="bg-white border border-slate/20 rounded-lg p-4 md:p-8 max-w-lg w-full max-h-[55vh] md:max-h-[480px] flex flex-col">
      {/* Name — fixed top section */}
      <div className="text-center mb-3 md:mb-6 shrink-0">
        <h1 className="text-4xl md:text-6xl font-serif font-bold text-charcoal tracking-tight">
          {name.name}
        </h1>
        {name.phonetic && (
          <p className="mt-2 text-slate text-base">{name.phonetic}</p>
        )}
      </div>

      {/* Scrollable detail area */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Origin & Meaning */}
        <div className="space-y-3 mb-6">
          {name.origin && (
            <div className="flex items-start gap-4">
              <span className="text-xs font-bold text-slate uppercase tracking-wider w-20 shrink-0 pt-0.5">
                Origin
              </span>
              <span className="text-charcoal text-sm">{name.origin}</span>
            </div>
          )}
          {name.meaning && (
            <div className="flex items-start gap-4">
              <span className="text-xs font-bold text-slate uppercase tracking-wider w-20 shrink-0 pt-0.5">
                Meaning
              </span>
              <span className="text-charcoal text-sm">{name.meaning}</span>
            </div>
          )}
        </div>

        {/* Famous People */}
        {famousPeople.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-bold text-slate uppercase tracking-wider mb-2">
              Famous namesakes
            </h3>
            <ul className="space-y-1">
              {famousPeople.map((person, i) => (
                <li key={i} className="text-sm text-charcoal flex items-start gap-2">
                  <span className="text-slate/60 mt-0.5">&bull;</span>
                  {person}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Meaning Tags */}
        {name.meaningTags && name.meaningTags.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-bold text-slate uppercase tracking-wider mb-2">
              Essence
            </h3>
            <div className="flex flex-wrap gap-2">
              {name.meaningTags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 text-xs font-medium bg-teal/10 text-teal-dark rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Alternative Spellings */}
        {altSpellings.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-bold text-slate uppercase tracking-wider mb-2">
              Also spelled as
            </h3>
            <div className="flex flex-wrap gap-2">
              {altSpellings.slice(0, 5).map((spelling) => (
                <span
                  key={spelling}
                  className="px-3 py-1 text-xs bg-cream rounded-full text-slate border border-slate/20"
                >
                  {spelling}
                </span>
              ))}
              {altSpellings.length > 5 && (
                <span className="px-3 py-1 text-xs text-slate/60">
                  +{altSpellings.length - 5} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Rank badge — fixed bottom */}
      <div className="mt-4 pt-4 border-t border-slate/20 flex items-center justify-center gap-4 text-xs text-slate shrink-0">
        {name.usRank > 0 && <span>#{name.usRank} in popularity</span>}
        {name.isBoy && name.isGirl && <span>Unisex</span>}
        {name.isBoy && !name.isGirl && <span>Boy</span>}
        {!name.isBoy && name.isGirl && <span>Girl</span>}
      </div>
    </div>
  );
}
