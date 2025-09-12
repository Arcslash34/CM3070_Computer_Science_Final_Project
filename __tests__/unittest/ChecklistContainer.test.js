// __tests__/unittest/ChecklistContainer.test.js

describe('ChecklistContainer (unit via view-model)', () => {
  // small helper dataset used by getChecklistData()
  const FIXTURE = {
    categories: [
      {
        id: 'cat-a',
        title: 'Go Bag',
        subcategories: [
          {
            id: 'sub-a1',
            title: 'Essentials',
            items: [
              { id: 'w', label: 'Water', desc: 'Bottled water' },
              { id: 'f', label: 'Food', desc: 'Canned food' },
            ],
          },
          {
            id: 'sub-a2',
            title: 'Docs',
            items: [{ id: 'p', label: 'Passport', desc: 'ID' }],
          },
        ],
      },
      {
        id: 'cat-b',
        title: 'Home',
        subcategories: [
          {
            id: 'sub-b1',
            title: 'Safety',
            items: [{ id: 'e', label: 'Extinguisher', desc: 'Fire' }],
          },
        ],
      },
    ],
  };

  async function renderWithMocks({
    lang = 'en',
    // seed some checks from storage
    storedChecked = { w: true, f: false, p: false, e: false },
  } = {}) {
    jest.resetModules();

    const React = require('react');
    const TestRenderer = require('react-test-renderer');
    const { act } = TestRenderer;

    // --- Mocks: react-native (Animated + Platform) -------------------------
    jest.doMock('react-native', () => {
      const timingMock = jest.fn((_value, _cfg) => ({
        start: (cb) => cb && cb(),
      }));
      class Value {
        constructor(v) { this._value = v; }
        setValue(v) { this._value = v; }
        interpolate() { return { __isInterpolated: true }; }
      }
      return {
        Animated: { Value, timing: timingMock },
        Platform: { OS: 'test' },
      };
    });

    // --- Mocks: AsyncStorage ----------------------------------------------
    const getItem = jest.fn(async () =>
      JSON.stringify({ checked: storedChecked })
    );
    const setItem = jest.fn(async () => {});
    jest.doMock('@react-native-async-storage/async-storage', () => ({
      __esModule: true,
      default: { getItem, setItem },
    }));

    // --- Mocks: react-navigation ------------------------------------------
    const goBack = jest.fn();
    jest.doMock('@react-navigation/native', () => ({
      __esModule: true,
      useNavigation: () => ({ goBack }),
    }));

    // --- Mocks: i18n + LanguageContext ------------------------------------
    const t = jest.fn((k) => k);
    const setLocale = jest.fn();
    const getChecklistData = jest.fn(() => FIXTURE);

    const ReactLib = require('react');
    const LanguageContext = ReactLib.createContext({ lang });
    jest.doMock('../../translations/language', () => ({
      __esModule: true,
      LanguageContext,
    }));
    jest.doMock('../../translations/translation', () => ({
      __esModule: true,
      t,
      setLocale,
      getChecklistData,
    }));

    // --- Mocks: app haptics/prefs -----------------------------------------
    const selection = jest.fn();
    const impact = jest.fn();
    const success = jest.fn();
    jest.doMock('../../utils/appPrefs', () => ({
      __esModule: true,
      selection,
      impact,
      success,
    }));

    // --- Capture vm through mocked presentational screen -------------------
    const vmHolder = { current: null };
    jest.doMock('../../screens/ChecklistScreen', () => ({
      __esModule: true,
      default: ({ vm }) => {
        vmHolder.current = vm;
        return null;
      },
    }));

    // Import SUT
    const ChecklistContainer = require('../../containers/ChecklistContainer').default;

    // Render under the mocked provider
    let testRenderer;
    await act(async () => {
      testRenderer = TestRenderer.create(
        React.createElement(
          LanguageContext.Provider,
          { value: { lang } },
          React.createElement(ChecklistContainer, {})
        )
      );
    });

    // Wait microtask queue to allow initial async storage load to settle
    await act(async () => {});

    const cleanup = () => {
      testRenderer.unmount();
    };

    // Expose some internals for assertions
    const RN = require('react-native');
    const Animated = RN.Animated;

    return {
      vm: vmHolder.current,              // initial snapshot
      getVm: () => vmHolder.current,     // always read latest vm after state updates
      mocks: {
        t,
        setLocale,
        getChecklistData,
        selection,
        impact,
        success,
        getItem,
        setItem,
        goBack,
        Animated,
      },
      cleanup,
      act,
    };
  }

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  test('loads from storage, syncs locale, and computes initial progress', async () => {
    const { vm, mocks, cleanup } = await renderWithMocks({
      storedChecked: { w: true, f: false, p: false, e: false },
    });

    // locale was synced from LanguageContext
    expect(mocks.setLocale).toHaveBeenCalledWith('en');

    // dataset surfaced
    expect(vm.categories.map(c => c.id)).toEqual(['cat-a', 'cat-b']);

    // overall: 4 total items, 1 done
    expect(vm.overallPercent).toBe(Math.round((1 / 4) * 100));

    // current category defaults to first
    expect(vm.currentCategory.id).toBe('cat-a');

    // cat-a has 3 items, 1 done (w)
    expect(vm.catTotal).toBe(3);
    expect(vm.catDone).toBe(1);
    expect(vm.catPercent).toBe(Math.round((1 / 3) * 100));

    cleanup();
  });

  test('toggle flips a single item and persists to storage', async () => {
    const { vm, mocks, cleanup, act } = await renderWithMocks({
      storedChecked: { w: false, f: false, p: false, e: false },
    });

    await act(async () => {
      vm.toggle('w'); // false -> true
    });

    expect(mocks.selection).toHaveBeenCalled();
    // setItem called with updated mapping
    const body = JSON.parse(mocks.setItem.mock.calls.at(-1)[1]);
    expect(body.checked.w).toBe(true);

    cleanup();
  });

  test('resetCurrentCategory clears only current category items and triggers impact()', async () => {
    const { vm, mocks, cleanup, act } = await renderWithMocks({
      storedChecked: { w: true, f: true, p: false, e: true }, // cat-a: w,f; cat-b: e
    });

    // ensure we are on cat-a
    expect(vm.currentCategory.id).toBe('cat-a');

    await act(async () => {
      vm.resetCurrentCategory();
    });

    expect(mocks.impact).toHaveBeenCalled();

    // After reset, cat-a items gone; cat-b (e) remains
    const saved = JSON.parse(mocks.setItem.mock.calls.at(-1)[1]).checked;
    expect(saved.w).toBeUndefined();
    expect(saved.f).toBeUndefined();
    expect(saved.p).toBe(false);
    expect(saved.e).toBe(true); // untouched

    cleanup();
  });

  test('filtering: matches label/desc and catHasMatches reflects query', async () => {
    const { vm, getVm, cleanup, act } = await renderWithMocks();

    // No query -> true
    expect(vm.catHasMatches).toBe(true);

    await act(async () => { vm.setQuery('bottled'); await Promise.resolve(); });
    // "Bottled water" (desc) should match
    expect(getVm().catHasMatches).toBe(true);
    expect(getVm().matchesQuery({ label: 'x', desc: 'Bottled WATER' })).toBe(true);

    await act(async () => { getVm().setQuery('zzz'); await Promise.resolve(); });
    expect(getVm().catHasMatches).toBe(false);

    cleanup();
  });

  test('congrats appears when a category reaches 100% and triggers success()', async () => {
    // Start with two of three done; finish the last to cross 100%
    const { vm, getVm, mocks, cleanup, act } = await renderWithMocks({
      storedChecked: { w: true, f: true, p: false, e: false }, // cat-a has 3 items
    });

    expect(vm.catPercent).toBe(Math.round((2 / 3) * 100));
    expect(vm.showCongrats).toBe(false);

    await act(async () => {
      getVm().toggle('p'); // now 3/3
      // allow effects to run
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getVm().catPercent).toBe(100);
    expect(getVm().showCongrats).toBe(true);
    expect(mocks.success).toHaveBeenCalledTimes(1);

    cleanup();
  });

  test('animations: Animated.timing invoked with new percent values', async () => {
    const { vm, getVm, mocks, cleanup, act } = await renderWithMocks({
      storedChecked: { w: false, f: false, p: false, e: false },
    });

    const timing = mocks.Animated.timing;

    // initial renders call timing for overall and category (to 0)
    expect(timing).toHaveBeenCalled();

    const callsBefore = timing.mock.calls.length;

    // Toggle one item -> category 1/3, overall 1/4
    await act(async () => { getVm().toggle('w'); });

    const callsAfter = timing.mock.calls.length;
    expect(callsAfter).toBeGreaterThan(callsBefore); // new animations fired

    // widths are interpolated objects from our mock (shape check only)
    expect(getVm().overallWidth).toEqual({ __isInterpolated: true });
    expect(getVm().categoryWidth).toEqual({ __isInterpolated: true });

    cleanup();
  });

  test('back navigation delegates to navigation.goBack()', async () => {
    const { vm, mocks, cleanup, act } = await renderWithMocks();
    await act(async () => { vm.onBack(); });
    expect(mocks.goBack).toHaveBeenCalled();
    cleanup();
  });
});
