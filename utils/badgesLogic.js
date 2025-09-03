// utils/badgesLogic.js
import { BADGE_CATALOG as BADGE_CATALOG_FN } from "./badgeCatalog";

/* ---------------------- helpers ---------------------- */

async function getUserId(supabase) {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id || null;
}

// Make category detection work for EN + ZH quiz titles
function categorizeTitle(title) {
  const s = String(title || "").toLowerCase();

  // English tokens
  if (s.includes("fire")) return "fire";
  if (s.includes("flood")) return "flood";
  if (s.includes("earth")) return "earthquake";
  if (s.includes("first") || s.includes("aid")) return "firstaid";

  // Chinese tokens
  if (title && /火|火灾|火警/.test(title)) return "fire";
  if (title && /洪|洪水|淹/.test(title)) return "flood";
  if (title && /地震|震/.test(title)) return "earthquake";
  if (title && /急救/.test(title)) return "firstaid";

  return null;
}

/* ------------------ progress summary ------------------ */
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

  // exact count
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

  // rows for perfect & streak
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

  // streak calc
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

    // Disaster Specialist — require 5 perfect scores
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
      return { value: 0, goal: 1 };
  }
}

/* --------------------- awarding rules --------------------- */

function makeRules(summary, context) {
  const q = Number(summary?.totalQuizzes || 0);
  const s = Number(summary?.streakDays || 0);
  const p = summary?.perfectByCategory || {
    fire: 0,
    flood: 0,
    earthquake: 0,
    firstaid: 0,
  };

  return [
    // Learning Achievements
    { id: "first-step", test: () => q >= 1 },
    { id: "quiz-explorer", test: () => q >= 5 },
    { id: "quiz-expert", test: () => q >= 10 },
    { id: "quiz-scholar", test: () => q >= 20 },

    // Disaster Specialist
    { id: "fire-expert", test: () => p.fire >= 5 },
    { id: "flood-expert", test: () => p.flood >= 5 },
    { id: "earthquake-expert", test: () => p.earthquake >= 5 },
    { id: "firstaid-expert", test: () => p.firstaid >= 5 },

    // Streaks
    { id: "streak-1", test: () => s >= 1 },
    { id: "streak-3", test: () => s >= 3 },
    { id: "streak-5", test: () => s >= 5 },
    { id: "streak-7", test: () => s >= 7 },
    { id: "streak-14", test: () => s >= 14 },
    { id: "streak-21", test: () => s >= 21 },
  ];
}

export async function checkAndAwardBadges(supabase, { lastQuiz = null } = {}) {
  const userId = await getUserId(supabase);
  if (!userId) return { newlyAwarded: [], alreadyHad: [] };

  const { data: ownedRows, error: ownErr } = await supabase
    .from("user_disaster_badges")
    .select("badge_id")
    .eq("user_id", userId);
  if (ownErr) throw ownErr;
  const owned = new Set((ownedRows || []).map((r) => r.badge_id));

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
    if (error && !String(error.message || "").includes("duplicate key")) {
      throw error;
    }
  }

  return { newlyAwarded: toAward, alreadyHad: [...owned] };
}

export function getBadgeMeta(badgeId) {
  return (
    (BADGE_CATALOG_FN() || []).find((b) => b.id === badgeId) || {
      id: badgeId,
      title: badgeId,
    }
  );
}
