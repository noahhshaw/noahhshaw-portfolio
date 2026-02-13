"use client";

import { useState } from "react";

interface CoupleSetupProps {
  onCoupleCreated: (partnerEmail: string) => void;
  loading?: boolean;
  error?: string;
}

export default function CoupleSetup({
  onCoupleCreated,
  loading,
  error,
}: CoupleSetupProps) {
  const [partnerEmail, setPartnerEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerEmail.trim()) return;
    onCoupleCreated(partnerEmail.toLowerCase().trim());
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm">
      <label className="block text-sm font-medium text-charcoal mb-2">
        Partner&apos;s email
      </label>
      <input
        type="email"
        value={partnerEmail}
        onChange={(e) => setPartnerEmail(e.target.value)}
        placeholder="partner@example.com"
        className="w-full px-4 py-3 border-2 border-slate/20 bg-cream text-charcoal placeholder:text-slate/60 rounded-lg focus:outline-none focus:border-teal transition-colors"
        required
        autoFocus
      />
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="mt-4 w-full py-3.5 bg-teal text-white font-medium rounded-lg hover:bg-teal-dark disabled:opacity-40 transition-colors"
      >
        {loading ? "Setting up..." : "Start Rating Names"}
      </button>
    </form>
  );
}
