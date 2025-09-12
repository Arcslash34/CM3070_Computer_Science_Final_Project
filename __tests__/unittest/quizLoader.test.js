// __tests__/unittest/quizLoader.test.js

// Helper: load SUT with a given locale, applying mocks before requiring the module.
function loadGetQuizWithLocale(locale) {
  jest.resetModules();

  // Mock the i18n module (named export) that quizLoader imports
  jest.doMock('../../translations/translation', () => ({
    __esModule: true,
    i18n: { locale },
  }));

  // Base EN quiz (minimal but structurally consistent)
  jest.doMock('../../assets/quiz.json', () => ({
    categories: [
      {
        id: 'c1',
        title: 'Fire Safety',
        sets: [
          {
            id: 's1',
            title: 'Basics',
            questions: [
              {
                question: 'What should you do first?',
                options: ['Call 995', 'Hide', 'Run blindly', 'Do nothing'],
                answer: 'Call 995',
                explanation: 'Dial emergency number for fire service.',
              },
              {
                question: 'Safe way to exit?',
                options: ['Use elevator', 'Use stairs'],
                answer: 'Use stairs',
                explanation: 'Avoid elevators during a fire.',
              },
            ],
          },
        ],
      },
    ],
  }), { virtual: true });

  // ZH overrides: full override for Q1; partial (bad options length) for Q2
  jest.doMock('../../translations/zh/quiz.json', () => ({
    categories: [
      {
        id: 'c1',
        title: '消防安全',
        sets: [
          {
            id: 's1',
            title: '基础',
            questions: [
              {
                question: '你首先应该做什么？',
                options: ['拨打995', '躲藏', '盲目逃跑', '什么也不做'],
                answer: '拨打995',
                explanation: '遇到火灾请拨打紧急电话。',
              },
              {
                // Only override question; wrong options length to force fallback
                question: '安全的撤离方式是？',
                options: ['随便'], // length mismatch -> fallback to EN
                // no answer/explanation -> fallback to EN
              },
            ],
          },
        ],
      },
    ],
  }), { virtual: true });

  // TA overrides: only category title, keep structure minimal
  jest.doMock('../../translations/ta/quiz.json', () => ({
    categories: [
      { id: 'c1', title: 'தீ பாதுகாப்பு', sets: [] },
    ],
  }), { virtual: true });

  // MS overrides: set title + override Q2 explanation
  jest.doMock('../../translations/ms/quiz.json', () => ({
    categories: [
      {
        id: 'c1',
        title: 'Keselamatan Kebakaran',
        sets: [
          {
            id: 's1',
            title: 'Asas',
            questions: [
              null, // keep index alignment; Q1 not overridden
              { explanation: 'Elakkan lif semasa kebakaran.' },
            ],
          },
        ],
      },
    ],
  }), { virtual: true });

  // Now load the SUT inside an isolated module context
  let getQuiz;
  jest.isolateModules(() => {
    ({ getQuiz } = require('../../utils/quizLoader'));
  });
  return getQuiz;
}

describe('quizLoader.getQuiz locale selection + merge', () => {
  test('returns EN unchanged for en locale', () => {
    const getQuiz = loadGetQuizWithLocale('en');
    const q = getQuiz();

    expect(q.categories[0].title).toBe('Fire Safety');
    expect(q.categories[0].sets[0].title).toBe('Basics');
    expect(q.categories[0].sets[0].questions[0].question)
      .toBe('What should you do first?');
  });

  test('merges ZH overrides and falls back when fields missing', () => {
    const getQuiz = loadGetQuizWithLocale('zh-CN');
    const q = getQuiz();

    // Category & set titles overridden
    expect(q.categories[0].title).toBe('消防安全');
    expect(q.categories[0].sets[0].title).toBe('基础');

    // Q1 fully overridden
    const q1 = q.categories[0].sets[0].questions[0];
    expect(q1.question).toBe('你首先应该做什么？');
    expect(q1.options).toEqual(['拨打995', '躲藏', '盲目逃跑', '什么也不做']);
    expect(q1.answer).toBe('拨打995');
    expect(q1.explanation).toBe('遇到火灾请拨打紧急电话。');

    // Q2: options length mismatch -> fallback to EN options/answer/explanation
    const q2 = q.categories[0].sets[0].questions[1];
    expect(q2.question).toBe('安全的撤离方式是？');
    expect(q2.options).toEqual(['Use elevator', 'Use stairs']); // fallback
    expect(q2.answer).toBe('Use stairs'); // fallback
    expect(q2.explanation).toBe('Avoid elevators during a fire.'); // fallback
  });

  test('uses TA data when locale starts with ta', () => {
    const getQuiz = loadGetQuizWithLocale('ta');
    const q = getQuiz();

    expect(q.categories[0].title).toBe('தீ பாதுகாப்பு'); // overridden
    expect(q.categories[0].sets[0].title).toBe('Basics'); // base EN remains
  });

  test('uses MS data for ms and id locales', () => {
    let getQuiz = loadGetQuizWithLocale('ms');
    let q = getQuiz();
    expect(q.categories[0].sets[0].title).toBe('Asas'); // overridden
    expect(q.categories[0].sets[0].questions[1].explanation)
      .toBe('Elakkan lif semasa kebakaran.');

    getQuiz = loadGetQuizWithLocale('id');
    q = getQuiz();
    expect(q.categories[0].sets[0].title).toBe('Asas');
  });

  test('falls back to EN for unknown locale (e.g., fr)', () => {
    const getQuiz = loadGetQuizWithLocale('fr');
    const q = getQuiz();
    expect(q.categories[0].title).toBe('Fire Safety');
  });
});
