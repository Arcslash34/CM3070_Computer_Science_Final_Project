import React, { createContext, useState, useContext } from 'react';
import * as Localization from 'expo-localization';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const defaultLang = Localization.locale.startsWith('zh') ? 'zh' : 'en';
  const [lang, setLang] = useState(defaultLang);

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);

export { LanguageContext };