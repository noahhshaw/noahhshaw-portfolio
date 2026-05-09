"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

const ERROR_MESSAGES: Record<string, string> = {
  missing: "No login token provided.",
  invalid: "That login link is invalid.",
  expired: "That login link has expired. Request a new one.",
  used: "That login link has already been used.",
  "not-whitelisted": "That email is not on the allow list.",
};

export default function BabyLoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12 bg-white">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Daily Baby
        </h1>
        <p className="text-gray-600 mb-6 text-sm">
          Enter your email to receive a login link.
        </p>
        <Suspense fallback={<LoginFormFallback />}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}

function LoginFormFallback() {
  return <div className="h-24 animate-pulse rounded bg-gray-100" />;
}

function LoginForm() {
  const params = useSearchParams();
  const errorKey = params.get("error");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch("/api/baby/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {errorKey && ERROR_MESSAGES[errorKey] && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {ERROR_MESSAGES[errorKey]}
        </div>
      )}

      {sent ? (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
          If your email is on the allow list, a login link is on its way. Check
          your inbox.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? "Sending…" : "Send login link"}
          </button>
        </form>
      )}
    </>
  );
}
