// __tests__/unittest/resultLocalization.test.js

jest.mock('../../utils/quizLoader', () => ({
  getQuiz: jest.fn(),
}));

jest.mock('../../translations/translation', () => {
  let currentLocale = 'en';
  return {
    __esModule: true,
    i18n: { get locale() { return currentLocale; }, set locale(v) { currentLocale = v; } },
    setLocale: (loc) => { currentLocale = loc; },
  };
});

import { getQuiz } from '../../utils/quizLoader';
import {
  getEnglishQuizDB,
  buildQuestionMap,
  relocalizeReviewItem,
} from '../../utils/resultLocalization';

describe('resultLocalization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getEnglishQuizDB forces EN without breaking locale', () => {
    // Fake quizzes
    const enQuiz = { categories: [{ id: 'c1', title: 'Fire Safety', sets: [] }] };
    const zhQuiz = { categories: [{ id: 'c1', title: '消防安全', sets: [] }] };

    let calls = 0;
    getQuiz.mockImplementation(() => {
      calls++;
      return calls === 1 ? enQuiz : zhQuiz; // first call EN, second call revert
    });

    const db = getEnglishQuizDB();
    expect(db.categories[0].title).toBe('Fire Safety');
  });

  test('buildQuestionMap links EN questions to localised ones', () => {
    getQuiz
      // local DB (current locale)
      .mockReturnValueOnce({
        categories: [
          {
            id: 'c1',
            sets: [
              {
                questions: [
                  { question: '你首先应该做什么？', options: ['拨打995'] },
                ],
              },
            ],
          },
        ],
      })
      // English DB returned inside getEnglishQuizDB()
      .mockReturnValueOnce({
        categories: [
          {
            id: 'c1',
            sets: [
              {
                questions: [
                  { question: 'What should you do first?', options: ['Call 995'] },
                ],
              },
            ],
          },
        ],
      });

    const map = buildQuestionMap();
    expect(map.has('What should you do first?')).toBe(true);
    const entry = map.get('What should you do first?');
    expect(entry.localQuestion).toBe('你首先应该做什么？');
  });

  test('relocalizeReviewItem maps answers correctly', () => {
    const map = new Map();
    map.set('What should you do first?', {
      enOptions: ['Call 995', 'Hide'],
      localQuestion: '你首先应该做什么？',
      localOptions: ['拨打995', '躲藏'],
    });

    const review = {
      question: 'What should you do first?',
      correctAnswer: 'Call 995',
      selectedAnswer: 'Hide',
    };

    const relocalized = relocalizeReviewItem(review, map);
    expect(relocalized.question).toBe('你首先应该做什么？');
    expect(relocalized.correctAnswer).toBe('拨打995');
    expect(relocalized.selectedAnswer).toBe('躲藏');
  });

  test('relocalizeReviewItem falls back gracefully when not in map', () => {
    const review = {
      question: 'Unknown Q',
      correctAnswer: 'A',
      selectedAnswer: 'B',
    };
    const out = relocalizeReviewItem(review, new Map());
    expect(out).toEqual(review); // unchanged
  });

  // NEW: edge-case relocalisation when answers are not found in EN options
  test('relocalizeReviewItem keeps original answers when indices are not found', () => {
    // Map entry exists for the question, but EN options don’t contain these answers
    const map = new Map();
    map.set('What should you do first?', {
      enOptions: ['Call 995', 'Hide'],
      localQuestion: '你首先应该做什么？',
      localOptions: ['拨打995', '躲藏'],
    });

    const review = {
      question: 'What should you do first?',
      correctAnswer: 'Stay calm',   // not in enOptions
      selectedAnswer: 'Run',        // not in enOptions
    };

    const out = relocalizeReviewItem(review, map);
    // Question still localised…
    expect(out.question).toBe('你首先应该做什么？');
    // …but answers fall back to the originals because indices were not found
    expect(out.correctAnswer).toBe('Stay calm');
    expect(out.selectedAnswer).toBe('Run');
  });
});
