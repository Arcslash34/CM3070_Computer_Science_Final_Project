// badgesLogic.js
// Centralized badge rules + insertion into public.user_disaster_badges
// Also provides per-badge progress for the UI progress bars.

import { BADGE_CATALOG } from "./badgeCatalog";

/* ---------------------- helpers ---------------------- */

async function getUserId(supabase) {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id || null;
}

function categorizeTitle(title) {
  const t = String(title || "").toLowerCase();
  if (t.includes("fire")) return "fire";
  if (t.includes("flood")) return "flood";
  if (t.includes("earth")) return "earthquake";
  if (t.includes("first") || t.includes("aid")) return "firstaid";
  return null;
}

/* ------------------ progress summary ------------------ */
/**
 * Returns the summary your UI needs to compute progress:
 * {
 *   userId,
 *   totalQuizzes,
 *   perfectByCategory: { fire, flood, earthquake, firstaid },
 *   streakDays
 * }
 */
export async function getProgressSummary(supabase) {
  const userId = await getUserId(supabase);
  if (!userId) {
    return {
      userId: null,
      totalQuizzes: 0,
      perfectByCategory: { fire: 0, flood: 0, earthquake: 0, firstaid: 0 },
      streakDays: 0,
    };
  }

  // 1) Exact count of all quizzes completed
  let totalQuizzes = 0;
  try {
    const { count, error } = await supabase
      .from("quiz_results")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (error) throw error;
    totalQuizzes = count ?? 0;
  } catch (e) {
    console.warn("Count quizzes failed:", e?.message || e);
  }

  // 2) Pull titles/scores to compute perfect-by-category + current streak
  const { data: rows, error: rowsErr } = await supabase
    .from("quiz_results")
    .select("quiz_title, score, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (rowsErr) throw rowsErr;

  const perfectByCategory = { fire: 0, flood: 0, earthquake: 0, firstaid: 0 };
  const dayKeys = new Set();

  (rows || []).forEach((r) => {
    const cat = categorizeTitle(r.quiz_title);
    const score = Number(r.score) || 0;

    if (cat && score === 100) {
      perfectByCategory[cat] = (perfectByCategory[cat] || 0) + 1;
    }
    if (r.created_at) {
      dayKeys.add(new Date(r.created_at).toDateString());
    }
  });

  // daily streak (consecutive days with >=1 quiz)
  let streakDays = 0;
  for (let i = 0; i < 400; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    if (dayKeys.has(d.toDateString())) streakDays++;
    else break;
  }

  return {
    userId,
    totalQuizzes,
    perfectByCategory,
    streakDays,
  };
}

/* ----------------- per-badge progress ----------------- */
/**
 * Maps a badgeId -> { value, goal } used by badges.js to render progress bars.
 * Expert category badges show perfect-count / 5 (e.g., 1/5).
 * Learning achievements show quiz-count / target (1,5,10,20).
 * Streaks show current streak / threshold.
 */
export function computeBadgeProgress(badgeId, summary) {
  const q = Number(summary?.totalQuizzes || 0);
  const streak = Number(summary?.streakDays || 0);
  const p = summary?.perfectByCategory || {
    fire: 0,
    flood: 0,
    earthquake: 0,
    firstaid: 0,
  };

  switch (badgeId) {
    // Learning Achievements
    case "first-step":
      return { value: Math.min(q, 1), goal: 1 };
    case "quiz-explorer":
      return { value: Math.min(q, 5), goal: 5 };
    case "quiz-expert":
      return { value: Math.min(q, 10), goal: 10 };
    case "quiz-scholar":
      return { value: Math.min(q, 20), goal: 20 };

    // Disaster Specialist — require 5 perfect scores in that category
    case "fire-expert":
      return { value: Math.min(p.fire, 5), goal: 5 };
    case "flood-expert":
      return { value: Math.min(p.flood, 5), goal: 5 };
    case "earthquake-expert":
      return { value: Math.min(p.earthquake, 5), goal: 5 };
    case "firstaid-expert":
      return { value: Math.min(p.firstaid, 5), goal: 5 };

    // Streaks
    case "streak-1":
      return { value: Math.min(streak, 1), goal: 1 };
    case "streak-3":
      return { value: Math.min(streak, 3), goal: 3 };
    case "streak-5":
      return { value: Math.min(streak, 5), goal: 5 };
    case "streak-7":
      return { value: Math.min(streak, 7), goal: 7 };
    case "streak-14":
      return { value: Math.min(streak, 14), goal: 14 };
    case "streak-21":
      return { value: Math.min(streak, 21), goal: 21 };

    default:
      // Unknown badge -> no progress
      return { value: 0, goal: 1 };
  }
}

/* --------------------- awarding rules --------------------- */

function makeRules(summary, context) {
  // We can still accept lastQuiz, but expert badges now key off counts.
  const last = context?.lastQuiz || null;

  const q = Number(summary?.totalQuizzes || 0);
  const s = Number(summary?.streakDays || 0);
  const p = summary?.perfectByCategory || {
    fire: 0,
    flood: 0,
    earthquake: 0,
    firstaid: 0,
  };

  return [
    // Learning Achievements (total quizzes completed)
    { id: "first-step",    test: () => q >= 1 },
    { id: "quiz-explorer", test: () => q >= 5 },
    { id: "quiz-expert",   test: () => q >= 10 },
    { id: "quiz-scholar",  test: () => q >= 20 },

    // Disaster Specialist (need 5 perfect quizzes per category)
    { id: "fire-expert",       test: () => p.fire >= 5 },
    { id: "flood-expert",      test: () => p.flood >= 5 },
    { id: "earthquake-expert", test: () => p.earthquake >= 5 },
    { id: "firstaid-expert",   test: () => p.firstaid >= 5 },

    // Consistency / Streaks
    { id: "streak-1",  test: () => s >= 1 },
    { id: "streak-3",  test: () => s >= 3 },
    { id: "streak-5",  test: () => s >= 5 },
    { id: "streak-7",  test: () => s >= 7 },
    { id: "streak-14", test: () => s >= 14 },
    { id: "streak-21", test: () => s >= 21 },
  ];
}

/* ---------------- award + metadata exports ---------------- */

export async function checkAndAwardBadges(supabase, { lastQuiz = null } = {}) {
  const userId = await getUserId(supabase);
  if (!userId) return { newlyAwarded: [], alreadyHad: [] };

  // load what the user already has
  const { data: ownedRows, error: ownErr } = await supabase
    .from("user_disaster_badges")
    .select("badge_id")
    .eq("user_id", userId);
  if (ownErr) throw ownErr;
  const owned = new Set((ownedRows || []).map((r) => r.badge_id));

  // build rules from current summary
  const summary = await getProgressSummary(supabase);
  const rules = makeRules(summary, { lastQuiz });

  const toAward = rules
    .filter((r) => !owned.has(r.id))
    .filter((r) => {
      try {
        return !!r.test();
      } catch {
        return false;
      }
    })
    .map((r) => r.id);

  if (toAward.length) {
    const { error } = await supabase
      .from("user_disaster_badges")
      .insert(toAward.map((badge_id) => ({ user_id: userId, badge_id })));
    // ignore "duplicate key" races
    if (error && !String(error.message || "").includes("duplicate key")) {
      throw error;
    }
  }

  return { newlyAwarded: toAward, alreadyHad: [...owned] };
}

export function getBadgeMeta(badgeId) {
  return (
    BADGE_CATALOG.find((b) => b.id === badgeId) || { id: badgeId, title: badgeId }
  );
}
