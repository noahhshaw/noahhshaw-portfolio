"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import EmailIdentify from "./components/onboarding/EmailIdentify";
import CoupleSetup from "./components/onboarding/CoupleSetup";
import NameCard from "./components/rating/NameCard";
import RatingControls from "./components/rating/RatingControls";
import GenderToggle from "./components/rating/GenderToggle";
import LetterFilter from "./components/rating/LetterFilter";
import Sidebar from "./components/sidebar/Sidebar";
import { useNextName } from "./hooks/useNextName";
import { useRating } from "./hooks/useRating";
import { useRecentRatings } from "./hooks/useRecentRatings";
import { useShortList } from "./hooks/useShortList";
import { useRatingStats } from "./hooks/useRatingStats";

type Step = "checking" | "email" | "partner" | "rating";

interface SessionData {
  userId: number;
  email: string;
  coupleId: number;
}

export default function BabyNameRaterPage() {
  const [step, setStep] = useState<Step>("checking");
  const [userId, setUserId] = useState<number | null>(null);
  const [coupleId, setCoupleId] = useState<number | null>(null);
  const [genderFilter, setGenderFilter] = useState("all");
  const [letterFilter, setLetterFilter] = useState("all");
  const [identifyLoading, setIdentifyLoading] = useState(false);
  const [coupleLoading, setCoupleLoading] = useState(false);
  const [coupleError, setCoupleError] = useState("");

  const { recentRatings, addOptimistic } = useRecentRatings(userId);
  const { shortList, fetchShortList } = useShortList(coupleId);
  const { totalRatings } = useRatingStats(userId, coupleId);

  const { currentName, loading: nameLoading, loadNext, loadInitial } = useNextName(userId, coupleId);

  const onRated = useCallback(() => {
    fetchShortList();
  }, [fetchShortList]);

  const { submitRating, submitting } = useRating(userId, coupleId, onRated);

  // Check localStorage for saved session on mount
  useEffect(() => {
    const saved = localStorage.getItem("bnr_session");
    if (saved) {
      try {
        const session: SessionData = JSON.parse(saved);
        setUserId(session.userId);
        setCoupleId(session.coupleId);
        setStep("rating");
      } catch {
        setStep("email");
      }
    } else {
      setStep("email");
    }
  }, []);

  // Load initial name when entering rating step
  useEffect(() => {
    if (step === "rating" && userId && coupleId) {
      loadInitial();
    }
  }, [step, userId, coupleId, loadInitial]);

  const handleIdentify = async (email: string) => {
    setIdentifyLoading(true);
    try {
      const res = await fetch("/api/baby-name-rater/auth/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setUserId(data.user.id);

      if (data.couple) {
        setCoupleId(data.couple.id);
        localStorage.setItem(
          "bnr_session",
          JSON.stringify({
            userId: data.user.id,
            email: data.user.email,
            coupleId: data.couple.id,
          })
        );
        setStep("rating");
      } else {
        setStep("partner");
      }
    } catch (err) {
      console.error("Identify failed:", err);
    } finally {
      setIdentifyLoading(false);
    }
  };

  const handleCoupleCreated = async (partnerEmail: string) => {
    if (!userId) return;
    setCoupleLoading(true);
    setCoupleError("");
    try {
      const res = await fetch("/api/baby-name-rater/couples/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, partnerEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setCoupleId(data.couple.id);
      localStorage.setItem(
        "bnr_session",
        JSON.stringify({
          userId,
          email: "",
          coupleId: data.couple.id,
        })
      );
      setStep("rating");
    } catch (err) {
      setCoupleError(err instanceof Error ? err.message : "Failed to create couple");
    } finally {
      setCoupleLoading(false);
    }
  };

  const handleRate = async (rating: number) => {
    if (!currentName || submitting) return;

    const nameId = currentName.id;
    const nameName = currentName.name;

    // Optimistic updates
    addOptimistic(nameId, nameName, rating);
    loadNext(nameId);

    // Fire-and-forget submit
    submitRating(nameId, rating);
  };

  const handleGenderChange = async (filter: string) => {
    setGenderFilter(filter);
    if (!coupleId) return;
    await fetch(`/api/baby-name-rater/couples/${coupleId}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ genderFilter: filter }),
    });
    loadInitial();
  };

  const handleLetterChange = async (letter: string) => {
    setLetterFilter(letter);
    if (!coupleId) return;
    await fetch(`/api/baby-name-rater/couples/${coupleId}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstLetterFilter: letter }),
    });
    loadInitial();
  };

  // Checking state
  if (step === "checking") {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="animate-pulse text-slate">Loading...</div>
      </div>
    );
  }

  // Onboarding steps
  if (step === "email" || step === "partner") {
    return (
      <div className="min-h-screen bg-cream">
        <header className="sticky top-0 z-50 bg-cream/80 backdrop-blur-sm border-b border-slate/10">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
            <Link
              href="/#projects"
              className="flex items-center gap-1.5 text-sm text-slate hover:text-teal transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back
            </Link>
          </div>
        </header>

        <main className="flex flex-col items-center justify-center px-6 py-24">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-charcoal mb-3">
            Baby Name Rater
          </h1>
          <p className="text-slate mb-10 text-center max-w-md">
            {step === "email"
              ? "Enter your email to get started"
              : "Enter your partner\u2019s email to start rating names together"}
          </p>
          {step === "email" ? (
            <EmailIdentify
              onIdentified={handleIdentify}
              loading={identifyLoading}
            />
          ) : (
            <CoupleSetup
              onCoupleCreated={handleCoupleCreated}
              loading={coupleLoading}
              error={coupleError}
            />
          )}
        </main>
      </div>
    );
  }

  // Rating step
  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-cream/80 backdrop-blur-sm border-b border-slate/10">
        <div className="max-w-6xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4">
              <Link
                href="/#projects"
                className="flex items-center gap-1.5 text-sm text-slate hover:text-teal transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Back
              </Link>
              <h1 className="text-lg font-serif font-bold text-charcoal">
                Baby Name Rater
              </h1>
            </div>
            <GenderToggle value={genderFilter} onChange={handleGenderChange} />
          </div>
          <LetterFilter value={letterFilter} onChange={handleLetterChange} />
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex gap-8">
          {/* Card + controls */}
          <div className="flex-1 flex flex-col items-center gap-6">
            {nameLoading ? (
              <div className="bg-white border border-slate/20 rounded-lg p-8 max-w-lg w-full flex items-center justify-center min-h-[300px]">
                <div className="animate-pulse text-slate">
                  Finding a name...
                </div>
              </div>
            ) : currentName ? (
              <>
                <NameCard name={currentName} />
                <RatingControls
                  onRate={handleRate}
                  disabled={submitting}
                />
                <p className="text-xs text-slate/60">
                  Press 1-5 on your keyboard to rate
                </p>
              </>
            ) : (
              <div className="bg-white border border-slate/20 rounded-lg p-8 max-w-lg w-full text-center">
                <p className="text-charcoal font-medium mb-2">
                  All caught up!
                </p>
                <p className="text-sm text-slate">
                  You&apos;ve rated all available names. Try changing your
                  filters to see more.
                </p>
              </div>
            )}
          </div>

          {/* Sidebar — hidden on mobile */}
          <div className="hidden lg:block">
            <Sidebar
              recentRatings={recentRatings}
              shortList={shortList}
              totalRatings={totalRatings}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
