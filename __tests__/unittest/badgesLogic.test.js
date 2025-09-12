// __tests__/unittest/badgesLogic.test.js

// mock the badge catalog that badgesLogic reads.
jest.mock('../../utils/badgeCatalog', () => ({
  BADGE_CATALOG: () => ([
    { id: 'first-step', title: 'First Step' },
    { id: 'quiz-explorer', title: 'Quiz Explorer' },
    { id: 'quiz-expert', title: 'Quiz Expert' },
    { id: 'quiz-scholar', title: 'Quiz Scholar' },
    { id: 'fire-expert', title: 'Fire Expert' },
    { id: 'flood-expert', title: 'Flood Expert' },
    { id: 'earthquake-expert', title: 'Earthquake Expert' },
    { id: 'firstaid-expert', title: 'First Aid Expert' },
    { id: 'streak-1', title: 'Streak 1' },
    { id: 'streak-3', title: 'Streak 3' },
    { id: 'streak-5', title: 'Streak 5' },
    { id: 'streak-7', title: 'Streak 7' },
    { id: 'streak-14', title: 'Streak 14' },
    { id: 'streak-21', title: 'Streak 21' },
  ])
}));

import {
  getProgressSummary,
  computeBadgeProgress,
  checkAndAwardBadges,
  getBadgeMeta
} from '../../utils/badgesLogic';

/* ------------------------ Supabase double ------------------------ */

function createSupabaseDouble({
  sessionUserId = 'u1',
  quizCount = 0,
  quizRows = [],
  ownedBadgeIds = [],
  insertError = null,
  onInsert = () => {}
} = {}) {
  const api = {
    auth: {
      getSession: async () => ({
        data: sessionUserId ? { session: { user: { id: sessionUserId } } } : { session: null }
      }),
    },
    from(table) {
      const q = {
        _table: table,
        _selectArgs: null,
        _selectOpts: null,
        _eq: null,
        _order: null,
        select(args, opts) {
          this._selectArgs = args;
          this._selectOpts = opts;
          return this;
        },
        eq(col, val) {
          this._eq = { col, val };
          return this;
        },
        order(col, { ascending }) {
          this._order = { col, ascending };
          return this;
        },
        async insert(rows) {
          onInsert(rows);
          if (insertError) return { error: insertError };
          return { error: null };
        },
        async then(resolve) {
          resolve(this);
        },
        async catch() {},

        async _resolve() {
          if (this._table === 'quiz_results') {
            // Exact count branch
            if (this._selectArgs === 'id' && this._selectOpts?.count === 'exact' && this._selectOpts?.head) {
              return { count: quizCount, error: null };
            }
            // Rows branch
            if (this._selectArgs === 'quiz_title, score, created_at') {
              return { data: quizRows, error: null };
            }
          }

          if (this._table === 'user_disaster_badges') {
            if (typeof this._selectArgs === 'string' && this._selectArgs.includes('badge_id')) {
              return {
                data: ownedBadgeIds.map(badge_id => ({ badge_id })),
                error: null
              };
            }
          }

          return { data: [], error: null };
        },
      };

      return new Proxy(q, {
        get(target, prop) {
          if (prop === 'then') {
            return undefined;
          }
          return target[prop];
        },
        apply() { return q; }
      });
    },
  };

  // Patch select to return terminal objects when awaited
  const origFrom = api.from.bind(api);
  api.from = (table) => {
    const chain = origFrom(table);
    const origSelect = chain.select.bind(chain);
    chain.select = (args, opts) => {
      origSelect(args, opts);
      const facade = {
        _inner: chain,
        eq: (c, v) => { chain.eq(c, v); return facade; },
        order: (c, o) => { chain.order(c, o); return facade; },
        async then(resolve) { resolve(await chain._resolve()); },
        async catch() {},
        async _resolve() { return chain._resolve(); },
      };
      return facade;
    };
    return chain;
  };

  return api;
}

/* --------------------------- Tests --------------------------- */

describe('computeBadgeProgress (pure)', () => {
  it('maps quiz count thresholds correctly', () => {
    const summary = { totalQuizzes: 7, streakDays: 0, perfectByCategory: { fire:0, flood:0, earthquake:0, firstaid:0 } };
    expect(computeBadgeProgress('first-step', summary)).toEqual({ value: 1, goal: 1 });
    expect(computeBadgeProgress('quiz-explorer', summary)).toEqual({ value: 5, goal: 5 });
    expect(computeBadgeProgress('quiz-expert', summary)).toEqual({ value: 7, goal: 10 });
  });

  it('caps category experts at 5 perfects', () => {
    const summary = { totalQuizzes: 0, streakDays: 0, perfectByCategory: { fire: 8, flood: 5, earthquake: 2, firstaid: 0 } };
    expect(computeBadgeProgress('fire-expert', summary)).toEqual({ value: 5, goal: 5 });
    expect(computeBadgeProgress('flood-expert', summary)).toEqual({ value: 5, goal: 5 });
    expect(computeBadgeProgress('earthquake-expert', summary)).toEqual({ value: 2, goal: 5 });
  });

  it('handles streak thresholds', () => {
    const summary = { totalQuizzes: 0, streakDays: 6, perfectByCategory: { fire:0,flood:0,earthquake:0,firstaid:0 } };
    expect(computeBadgeProgress('streak-1', summary)).toEqual({ value: 1, goal: 1 });
    expect(computeBadgeProgress('streak-5', summary)).toEqual({ value: 5, goal: 5 });
    expect(computeBadgeProgress('streak-7', summary)).toEqual({ value: 6, goal: 7 });
  });
});

describe('getProgressSummary (supabase double)', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    // Freeze time so streak calculation is predictable
    jest.setSystemTime(new Date('2025-09-11T08:00:00+08:00'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('returns defaults when no user session', async () => {
    const supabase = createSupabaseDouble({ sessionUserId: null });
    const res = await getProgressSummary(supabase);
    expect(res.userId).toBeNull();
    expect(res.totalQuizzes).toBe(0);
    expect(res.perfectByCategory).toEqual({ fire:0, flood:0, earthquake:0, firstaid:0 });
    expect(res.streakDays).toBe(0);
  });

  it('counts quizzes, categorizes perfects (EN+ZH), and computes streak', async () => {
    // Build 3 consecutive days (today, -1d, -2d)
    const base = new Date('2025-09-11T06:00:00+08:00').getTime();
    const day = 24 * 60 * 60 * 1000;
    const rows = [
      { quiz_title: 'Fire Safety Basics', score: 100, created_at: new Date(base).toISOString() },             // fire + perfect
      { quiz_title: '洪水应对 (Flood Response)', score: 100, created_at: new Date(base - day).toISOString() }, // flood + perfect
      { quiz_title: '急救入门 (First Aid)', score: 60, created_at: new Date(base - 2*day).toISOString() },    // firstaid but not perfect
      { quiz_title: '地震常识', score: 100, created_at: new Date(base - 2*day).toISOString() },                // earthquake + perfect
    ];

    const supabase = createSupabaseDouble({
      sessionUserId: 'u1',
      quizCount: 7,
      quizRows: rows
    });

    const res = await getProgressSummary(supabase);
    expect(res.userId).toBe('u1');
    expect(res.totalQuizzes).toBe(7);
    expect(res.perfectByCategory).toEqual({ fire:1, flood:1, earthquake:1, firstaid:0 });
    expect(res.streakDays).toBe(3); // today + previous 2 days present
  });
});

describe('checkAndAwardBadges (unit with supabase double)', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-09-11T08:00:00+08:00'));
  });
  afterAll(() => {
    jest.useRealTimers();
  });

  it('awards only badges not already owned and inserts them', async () => {
    const inserted = [];
    const rows = [
      // enough to produce category perfects and streak >=3, totalQuizzes >=5
      { quiz_title: 'Fire Safety', score: 100, created_at: '2025-09-11T00:10:00+08:00' },
      { quiz_title: 'Fire Safety', score: 100, created_at: '2025-09-10T00:10:00+08:00' },
      { quiz_title: 'Fire Safety', score: 100, created_at: '2025-09-09T00:10:00+08:00' },
      { quiz_title: '洪水应对', score: 100, created_at: '2025-09-09T00:20:00+08:00' },
      { quiz_title: '地震常识', score: 100, created_at: '2025-09-09T00:30:00+08:00' },
    ];

    const supabase = createSupabaseDouble({
      sessionUserId: 'u1',
      quizCount: 6,
      quizRows: rows,
      ownedBadgeIds: ['first-step'], // already has this
      onInsert: (rows) => inserted.push(...rows)
    });

    const res = await checkAndAwardBadges(supabase, { lastQuiz: null });

    // Should propose explorer (>=5), some streak (>=1/3), and category experts only if >=5 perfects (not yet)
    // From our data: fire perfects = 3, flood=1, earthquake=1 => no *-expert yet.
    expect(res.alreadyHad).toContain('first-step');
    expect(res.newlyAwarded).toEqual(expect.arrayContaining([
      'quiz-explorer',
      'streak-1',
      'streak-3',
    ]));
    // Should NOT include category experts or higher streaks
    expect(res.newlyAwarded).not.toEqual(expect.arrayContaining([
      'fire-expert', 'flood-expert', 'earthquake-expert', 'firstaid-expert',
      'streak-5','streak-7','streak-14','streak-21'
    ]));

    // Insert rows must reflect only newly awarded ids for this user
    expect(inserted).toEqual(
      res.newlyAwarded.map(id => ({ user_id: 'u1', badge_id: id }))

    );
  });

  it('does not throw on duplicate key insert errors', async () => {
    const supabase = createSupabaseDouble({
      sessionUserId: 'u1',
      quizCount: 5,
      quizRows: [
        { quiz_title: 'Fire Safety', score: 100, created_at: '2025-09-11T00:10:00+08:00' },
        { quiz_title: 'Flood Response', score: 100, created_at: '2025-09-10T00:10:00+08:00' },
        { quiz_title: 'Earthquake Basics', score: 100, created_at: '2025-09-09T00:10:00+08:00' },
      ],
      ownedBadgeIds: [],
      insertError: { message: 'duplicate key value violates unique constraint' }
    });

    await expect(checkAndAwardBadges(supabase, {}))
      .resolves.toEqual(expect.objectContaining({ newlyAwarded: expect.any(Array) }));
  });

  it('returns empty when no session', async () => {
    const supabase = createSupabaseDouble({ sessionUserId: null });
    const res = await checkAndAwardBadges(supabase, {});
    expect(res).toEqual({ newlyAwarded: [], alreadyHad: [] });
  });
});

describe('getBadgeMeta (catalog lookup)', () => {
  it('returns catalog entry if found', () => {
    const meta = getBadgeMeta('quiz-explorer');
    expect(meta.title).toBe('Quiz Explorer');
  });

  it('falls back to id+title when unknown', () => {
    const meta = getBadgeMeta('non-existent');
    expect(meta).toEqual({ id: 'non-existent', title: 'non-existent' });
  });
});

/* --------------------------- Boundary tests --------------------------- */

describe('computeBadgeProgress (boundaries)', () => {
  const baseP = { fire: 0, flood: 0, earthquake: 0, firstaid: 0 };

  test('quiz count exact thresholds (1, 5, 10, 20)', () => {
    expect(computeBadgeProgress('first-step',    { totalQuizzes: 1,  streakDays: 0, perfectByCategory: baseP }))
      .toEqual({ value: 1,  goal: 1 });
    expect(computeBadgeProgress('quiz-explorer', { totalQuizzes: 5,  streakDays: 0, perfectByCategory: baseP }))
      .toEqual({ value: 5,  goal: 5 });
    expect(computeBadgeProgress('quiz-expert',   { totalQuizzes: 10, streakDays: 0, perfectByCategory: baseP }))
      .toEqual({ value: 10, goal: 10 });
    expect(computeBadgeProgress('quiz-scholar',  { totalQuizzes: 20, streakDays: 0, perfectByCategory: baseP }))
      .toEqual({ value: 20, goal: 20 });
  });

  test('category experts at exactly 5 perfects', () => {
    const p = { fire: 5, flood: 5, earthquake: 5, firstaid: 5 };
    const summary = { totalQuizzes: 0, streakDays: 0, perfectByCategory: p };
    expect(computeBadgeProgress('fire-expert',       summary)).toEqual({ value: 5, goal: 5 });
    expect(computeBadgeProgress('flood-expert',      summary)).toEqual({ value: 5, goal: 5 });
    expect(computeBadgeProgress('earthquake-expert', summary)).toEqual({ value: 5, goal: 5 });
    expect(computeBadgeProgress('firstaid-expert',   summary)).toEqual({ value: 5, goal: 5 });
  });

  test('streak exact thresholds (1, 3, 5, 7, 14, 21)', () => {
    const mk = (s) => ({ totalQuizzes: 0, streakDays: s, perfectByCategory: baseP });
    expect(computeBadgeProgress('streak-1',  mk(1))).toEqual({ value: 1,  goal: 1 });
    expect(computeBadgeProgress('streak-3',  mk(3))).toEqual({ value: 3,  goal: 3 });
    expect(computeBadgeProgress('streak-5',  mk(5))).toEqual({ value: 5,  goal: 5 });
    expect(computeBadgeProgress('streak-7',  mk(7))).toEqual({ value: 7,  goal: 7 });
    expect(computeBadgeProgress('streak-14', mk(14))).toEqual({ value: 14, goal: 14 });
    expect(computeBadgeProgress('streak-21', mk(21))).toEqual({ value: 21, goal: 21 });
  });
});

describe('checkAndAwardBadges (awards at exact thresholds)', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-09-11T08:00:00+08:00'));
  });
  afterAll(() => {
    jest.useRealTimers();
  });

  test('awards quiz-expert (10), fire-expert (5 perfects), streak-7 (7 days) — but not higher', async () => {
    const base = new Date('2025-09-11T06:00:00+08:00').getTime();
    const day = 24 * 60 * 60 * 1000;

    // 7 consecutive days of perfect "Fire Safety" → fire perfects=7, streakDays=7
    const rows = [];
    for (let i = 0; i < 7; i++) {
      rows.push({
        quiz_title: 'Fire Safety',
        score: 100,
        created_at: new Date(base - i * day).toISOString(),
      });
    }
    // add 3 more quizzes (any titles) to reach totalQuizzes=10
    rows.push({ quiz_title: 'Flood Response', score: 60,  created_at: new Date(base - 7*day - 1000).toISOString() });
    rows.push({ quiz_title: 'Earthquake Basics', score: 100, created_at: new Date(base - 7*day - 2000).toISOString() });
    rows.push({ quiz_title: 'First Aid', score: 100, created_at: new Date(base - 7*day - 3000).toISOString() });

    const supabase = createSupabaseDouble({
      sessionUserId: 'u1',
      quizCount: 10,
      quizRows: rows,
      ownedBadgeIds: [],
    });

    const res = await checkAndAwardBadges(supabase, {});
    // Must include exact-threshold achievements
    expect(res.newlyAwarded).toEqual(expect.arrayContaining([
      'quiz-expert',   // q = 10
      'fire-expert',   // 5+ perfects in fire
      'streak-7',      // 7-day streak
    ]));
    // Includes lower streaks too (1,3,5), but not higher ones or 20-quiz scholar
    expect(res.newlyAwarded).not.toEqual(expect.arrayContaining([
      'streak-14', 'streak-21', 'quiz-scholar',
    ]));
  });
});
