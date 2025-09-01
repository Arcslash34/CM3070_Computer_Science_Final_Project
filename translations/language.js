// translations/language.js
import React, { createContext, useState, useMemo } from 'react';
import i18n, { setLocale } from './translation';

export const LanguageContext = createContext({
  lang: 'en',
  setLang: () => {},
});

export function LanguageProvider({ children }) {
  // start with the already-detected device/app locale
  const [lang, _setLang] = useState(i18n.locale);

  const setLang = (l) => {
    if (!l || l === lang) return;
    setLocale(l);   // updates i18n.locale
    _setLang(l);    // triggers re-render across the app
  };

  const value = useMemo(() => ({ lang, setLang }), [lang]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
