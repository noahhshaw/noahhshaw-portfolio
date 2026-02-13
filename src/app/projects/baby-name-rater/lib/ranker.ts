import { db } from "@/db";
import { names, ratings, couples } from "@/db/schema";
import { eq, and, notInArray, desc, sql, inArray, gte } from "drizzle-orm";
import {
  RANKER_CANDIDATE_SAMPLE_SIZE,
  RANKER_RECENCY_WINDOW,
  RANKER_STRONG_RECENCY_WINDOW,
  SHORT_LIST_THRESHOLD,
} from "./constants";
import type { SQL } from "drizzle-orm";
import type { Name } from "@/db/schema";

interface ScoringContext {
  partnerRatings: Map<number, number>; // nameId → rating
  userTopLetters: Set<string>;
  userTopOrigins: Set<string>;
  userTopMeaningTags: Set<string>;
  userRecentNameIds: number[];
  totalNameCount: number;
}

interface CandidateName {
  id: number;
  name: string;
  startingLetter: string;
  origin: string | null;
  usRank: number;
  meaningTags: string[] | null;
}

function scoreCandidate(
  candidate: CandidateName,
  ctx: ScoringContext
): number {
  let score = 0;

  // Partner rating bonuses
  const partnerRating = ctx.partnerRatings.get(candidate.id);
  if (partnerRating !== undefined) {
    score += partnerRating >= SHORT_LIST_THRESHOLD ? 30 : 15;
  }

  // Similarity to user's top-rated names
  if (ctx.userTopLetters.has(candidate.startingLetter)) {
    score += 10;
  }
  if (candidate.origin && ctx.userTopOrigins.has(candidate.origin)) {
    score += 10;
  }

  // Semantic meaning similarity
  if (candidate.meaningTags && candidate.meaningTags.length > 0) {
    const overlap = candidate.meaningTags.filter((tag) =>
      ctx.userTopMeaningTags.has(tag)
    ).length;
    if (overlap > 0) {
      score += Math.min(overlap * 5, 10); // Cap at +10
    }
  }

  // Moderate popularity bonus (25th-75th percentile by rank)
  const p25 = Math.floor(ctx.totalNameCount * 0.25);
  const p75 = Math.floor(ctx.totalNameCount * 0.75);
  if (candidate.usRank >= p25 && candidate.usRank <= p75) {
    score += 5;
  }

  // Recency penalties
  const recentIndex = ctx.userRecentNameIds.indexOf(candidate.id);
  if (recentIndex >= 0 && recentIndex < RANKER_STRONG_RECENCY_WINDOW) {
    score -= 50;
  } else if (recentIndex >= 0 && recentIndex < RANKER_RECENCY_WINDOW) {
    score -= 20;
  }

  // Random noise for variety
  score += Math.random() * 5;

  return score;
}

export async function getNextName(
  userId: number,
  coupleId: number,
  excludeNameId?: number
): Promise<Name | null> {
  // Get couple info
  const [couple] = await db
    .select()
    .from(couples)
    .where(eq(couples.id, coupleId));

  if (!couple) return null;

  const partnerId =
    couple.user1Id === userId ? couple.user2Id : couple.user1Id;

  // Get IDs of names this user has already rated
  const ratedByUser = await db
    .select({ nameId: ratings.nameId })
    .from(ratings)
    .where(eq(ratings.userId, userId));

  const ratedNameIds = ratedByUser.map((r) => r.nameId);
  if (excludeNameId) ratedNameIds.push(excludeNameId);

  // Build filter conditions
  const filterConditions: SQL[] = [];
  if (couple.genderFilter === "boy") {
    filterConditions.push(eq(names.isBoy, true));
  } else if (couple.genderFilter === "girl") {
    filterConditions.push(eq(names.isGirl, true));
  }
  if (couple.firstLetterFilter !== "all") {
    filterConditions.push(eq(names.startingLetter, couple.firstLetterFilter));
  }

  // Sample random candidates, preferring unrated names
  const candidateFields = {
    id: names.id,
    name: names.name,
    startingLetter: names.startingLetter,
    origin: names.origin,
    usRank: names.usRank,
    meaningTags: names.meaningTags,
  };

  async function fetchCandidates(conditions: SQL[]) {
    const query = db.select(candidateFields).from(names);
    const limited = conditions.length > 0
      ? query.where(and(...conditions))
      : query;
    return limited.orderBy(sql`RANDOM()`).limit(RANKER_CANDIDATE_SAMPLE_SIZE);
  }

  // First try unrated names
  const unratedConditions = [...filterConditions];
  if (ratedNameIds.length > 0) {
    unratedConditions.push(notInArray(names.id, ratedNameIds));
  }

  let candidates: CandidateName[] = await fetchCandidates(unratedConditions);

  // If no unrated names, fall back to all names (excluding current)
  if (candidates.length === 0) {
    const fallbackConditions = [...filterConditions];
    if (excludeNameId) {
      fallbackConditions.push(notInArray(names.id, [excludeNameId]));
    }
    candidates = await fetchCandidates(fallbackConditions);
  }

  if (candidates.length === 0) return null;

  // Build scoring context with parallel queries
  const candidateIds = candidates.map((c) => c.id);

  const [partnerRatingsResult, userTopNamesResult, userRecentResult, countResult] =
    await Promise.all([
      // Partner's ratings for candidate names
      partnerId
        ? db
            .select({ nameId: ratings.nameId, rating: ratings.rating })
            .from(ratings)
            .where(
              and(
                eq(ratings.userId, partnerId),
                inArray(ratings.nameId, candidateIds)
              )
            )
        : Promise.resolve([]),

      // User's top-rated name attributes (rating >= 4)
      db
        .select({
          startingLetter: names.startingLetter,
          origin: names.origin,
          meaningTags: names.meaningTags,
        })
        .from(ratings)
        .innerJoin(names, eq(ratings.nameId, names.id))
        .where(
          and(
            eq(ratings.userId, userId),
            gte(ratings.rating, SHORT_LIST_THRESHOLD)
          )
        ),

      // User's last N rated name IDs
      db
        .select({ nameId: ratings.nameId })
        .from(ratings)
        .where(eq(ratings.userId, userId))
        .orderBy(desc(ratings.updatedAt))
        .limit(RANKER_RECENCY_WINDOW),

      // Total name count (for percentile calculation)
      db.select({ count: sql<number>`count(*)::int` }).from(names),
    ]);

  // Build context
  const partnerRatingsMap = new Map<number, number>();
  for (const r of partnerRatingsResult) {
    partnerRatingsMap.set(r.nameId, r.rating);
  }

  const userTopLetters = new Set<string>();
  const userTopOrigins = new Set<string>();
  const userTopMeaningTags = new Set<string>();
  for (const n of userTopNamesResult) {
    if (n.startingLetter) userTopLetters.add(n.startingLetter);
    if (n.origin) userTopOrigins.add(n.origin);
    if (n.meaningTags) {
      for (const tag of n.meaningTags) {
        userTopMeaningTags.add(tag);
      }
    }
  }

  const ctx: ScoringContext = {
    partnerRatings: partnerRatingsMap,
    userTopLetters,
    userTopOrigins,
    userTopMeaningTags,
    userRecentNameIds: userRecentResult.map((r) => r.nameId),
    totalNameCount: countResult[0]?.count || 1,
  };

  // Score and sort candidates
  const scored = candidates.map((c) => ({
    id: c.id,
    score: scoreCandidate(c, ctx),
  }));
  scored.sort((a, b) => b.score - a.score);

  // Fetch full name data for the winner
  const [winner] = await db
    .select()
    .from(names)
    .where(eq(names.id, scored[0].id));

  return winner || null;
}
