"use client";

import { useState, useEffect } from "react";

interface EmailIdentifyProps {
  onIdentified: (email: string) => void;
  defaultEmail?: string;
  partnerWaiting?: string;
  loading?: boolean;
}

export default function EmailIdentify({
  onIdentified,
  defaultEmail,
  partnerWaiting,
  loading,
}: EmailIdentifyProps) {
  const [email, setEmail] = useState(defaultEmail || "");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("knownEmails");
    if (stored) {
      setSuggestions(JSON.parse(stored));
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    const stored = localStorage.getItem("knownEmails");
    const known: string[] = stored ? JSON.parse(stored) : [];
    if (!known.includes(email.toLowerCase().trim())) {
      known.push(email.toLowerCase().trim());
      localStorage.setItem("knownEmails", JSON.stringify(known));
    }

    onIdentified(email.toLowerCase().trim());
  };

  const filteredSuggestions = suggestions.filter(
    (s) => s.includes(email.toLowerCase()) && s !== email.toLowerCase()
  );

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm">
      {partnerWaiting && (
        <div className="mb-4 px-4 py-3 bg-teal/10 border border-teal/20 rounded-lg text-sm text-charcoal">
          Your partner <strong>{partnerWaiting}</strong> is waiting for you!
        </div>
      )}

      <label className="block text-sm font-medium text-charcoal mb-2">
        Your email
      </label>
      <div className="relative">
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder="you@example.com"
          className="w-full px-4 py-3 border-2 border-slate/20 bg-cream text-charcoal placeholder:text-slate/60 rounded-lg focus:outline-none focus:border-teal transition-colors"
          required
          autoFocus
        />
        {showSuggestions && filteredSuggestions.length > 0 && (
          <ul className="absolute z-10 w-full mt-1 bg-white border border-slate/20 rounded-lg shadow-lg overflow-hidden">
            {filteredSuggestions.map((suggestion) => (
              <li key={suggestion}>
                <button
                  type="button"
                  className="w-full px-4 py-3 text-left text-sm hover:bg-cream transition-colors"
                  onMouseDown={() => {
                    setEmail(suggestion);
                    setShowSuggestions(false);
                  }}
                >
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="submit"
        disabled={loading}
        className="mt-4 w-full py-3.5 bg-teal text-white font-medium rounded-lg hover:bg-teal-dark disabled:opacity-40 transition-colors"
      >
        {loading ? "Loading..." : "Continue"}
      </button>
    </form>
  );
}
