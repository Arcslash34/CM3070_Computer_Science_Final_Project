// __tests__/unittest/ResourceHubContainer.test.js

describe('ResourceHubContainer (unit via view-model)', () => {
  const RES_FIXTURE_EN = {
    'cpr-aed-adult': {
      title: 'Adult CPR & AED',
      category: 'Cardiac',
      tags: ['CPR', 'AED', 'defibrillator'],
      body: 'steps...',
    },
    'severe-bleeding': {
      title: 'Stop Severe Bleeding',
      category: 'Trauma',
      tags: ['bleeding', 'tourniquet', 'pressure'],
      body: 'steps...',
    },
    flooding: {
      title: 'Flood Safety Basics',
      category: 'Flooding',
      tags: ['rain', 'evacuate', 'sandbags'],
      body: 'steps...',
    },
    burns: {
      title: 'Treat Burns Quickly',
      category: 'Burns',
      tags: ['cool water', 'first aid'],
      body: 'steps...',
    },
  };

  const RES_FIXTURE_TA = {
    ...RES_FIXTURE_EN,
    flooding: {
      ...RES_FIXTURE_EN.flooding,
      title: 'வெள்ள பாதுகாப்பு வழிகாட்டி',
    },
  };

  async function renderWithMocks({ lang = 'en' } = {}) {
    jest.resetModules();

    const React = require('react');
    const TestRenderer = require('react-test-renderer');
    const { act } = TestRenderer;

    jest.doMock('react-native-safe-area-context', () => ({
      useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    }));

    const setOptions = jest.fn();
    const navigate = jest.fn();
    jest.doMock('@react-navigation/native', () => ({
      __esModule: true,
      useNavigation: () => ({ setOptions, navigate }),
    }));

    const ReactLib = require('react');
    const LanguageContext = ReactLib.createContext({ lang });
    jest.doMock('../../translations/language', () => ({
      __esModule: true,
      LanguageContext,
    }));

    let currentLang = lang;
    const t = jest.fn((key, opts) => {
      if (key === 'resources' && opts?.returnObjects) {
        return currentLang === 'ta' ? RES_FIXTURE_TA : RES_FIXTURE_EN;
      }
      if (key === 'resourceHub.all') return currentLang === 'ta' ? 'அனைத்தும்' : 'All';
      if (key === 'resourceHub.guide') return currentLang === 'ta' ? 'வழிகாட்டி' : 'guide';
      if (key === 'resourceHub.guides') return currentLang === 'ta' ? 'வழிகாட்டிகள்' : 'guides';
      if (key === 'resourceHub.allTopics') return currentLang === 'ta' ? 'அனைத்து தலைப்புகள்' : 'All topics';
      if (key === 'resourceHub.matching') {
        const q = opts?.q ?? '';
        return currentLang === 'ta' ? `“${q}” பொருந்தும்` : `matching “${q}”`;
      }
      return key;
    });
    jest.doMock('../../translations/translation', () => ({
      __esModule: true,
      t,
    }));

    const vmHolder = { current: null };
    jest.doMock('../../screens/ResourceHubScreen', () => ({
      __esModule: true,
      default: ({ vm }) => {
        vmHolder.current = vm;
        return null;
      },
    }));

    const ResourceHubContainer = require('../../containers/ResourceHubContainer').default;

    let testRenderer;
    await act(async () => {
      testRenderer = TestRenderer.create(
        React.createElement(
          LanguageContext.Provider,
          { value: { lang: currentLang } },
          React.createElement(ResourceHubContainer, {})
        )
      );
    });

    const setLang = async (next) => {
      currentLang = next;
      await act(async () => {
        testRenderer.update(
          React.createElement(
            LanguageContext.Provider,
            { value: { lang: currentLang } },
            React.createElement(ResourceHubContainer, {})
          )
        );
      });
    };

    const cleanup = () => testRenderer.unmount();

    return {
      vm: () => vmHolder.current,
      mocks: { t, setOptions, navigate, LanguageContext, setLang },
      cleanup,
      act,
    };
  }

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('builds categories with localized "All" first and unique categories', async () => {
    const { vm, mocks, act, cleanup } = await renderWithMocks({ lang: 'en' });
    expect(mocks.setOptions).toHaveBeenCalledWith({ headerShown: false });

    const catList = vm().CATEGORIES;
    expect(catList[0]).toBe('All');
    expect(new Set(catList.slice(1))).toEqual(new Set(['Cardiac', 'Trauma', 'Flooding', 'Burns']));

    const ids = vm().items.map((x) => x.id).sort();
    expect(ids).toEqual(Object.keys(RES_FIXTURE_EN).sort());
    cleanup();
  });

  test('filters by category and free-text query; sorts alphabetically when enabled', async () => {
    const { vm, act, cleanup } = await renderWithMocks();

    await act(async () => { vm().setCategory('Trauma'); });
    expect(vm().items.map((x) => x.id)).toEqual(['severe-bleeding']);

    await act(async () => {
      vm().setCategory('All');
      vm().setQuery('rain');
    });
    expect(vm().items.map((x) => x.id)).toEqual(['flooding']);

    await act(async () => {
      vm().setQuery('');
      vm().setCategory('All');
      vm().setSortAlpha(true);
    });
    const titles = vm().items.map((x) => x.title);
    const sorted = [...titles].sort((a, b) => a.localeCompare(b));
    expect(titles).toEqual(sorted);

    cleanup();
  });

  test('header text and accent color reflect state (all vs category vs search)', async () => {
    const { vm, act, cleanup } = await renderWithMocks();

    expect(vm().headerText).toMatch(/^4 guides • All topics$/);
    expect(vm().headerAccent).toBe('#6B7280');

    await act(async () => { vm().setCategory('Cardiac'); });
    expect(vm().headerText).toMatch(/^1 guide • Cardiac$/);
    expect(vm().headerAccent).toBe('#B91C1C');

    await act(async () => {
      vm().setCategory('All');
      vm().setQuery('aed');
    });
    expect(vm().headerText).toBe('1 guide • matching “aed”');

    cleanup();
  });

  test('navigates to ResourceArticle with the selected item', async () => {
    const { vm, mocks, act, cleanup } = await renderWithMocks();
    const item = vm().items.find((x) => x.id === 'flooding');
    await act(async () => { vm().openArticle(item); });
    expect(mocks.navigate).toHaveBeenCalledWith('ResourceArticle', { article: item });
    cleanup();
  });

  test('reacts to language change: localized "All" label and translated titles', async () => {
    const { vm, mocks, cleanup, act } = await renderWithMocks({ lang: 'en' });

    expect(vm().CATEGORIES[0]).toBe('All');
    const titleEn = vm().items.find((x) => x.id === 'flooding').title;
    expect(titleEn).toBe('Flood Safety Basics');

    // Switch to Tamil via mocks.setLang
    await mocks.setLang('ta');

    // Update the selected category to the new localized "All"
    await act(async () => {
        vm().setCategory('அனைத்தும்'); // t('resourceHub.all') in TA
    });

    expect(vm().CATEGORIES[0]).toBe('அனைத்தும்');
    const titleTa = vm().items.find((x) => x.id === 'flooding').title;
    expect(titleTa).toBe('வெள்ள பாதுகாப்பு வழிகாட்டி');
    expect(vm().headerText).toMatch(/^4 வழிகாட்டிகள் • அனைத்து தலைப்புகள்$/);

    cleanup();
  });
});
