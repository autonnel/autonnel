
import React from 'react';
import { t as translate, type TranslationKey, type SupportedLanguage } from './translations';

type TranslationParams = Record<string, string | number>;

const DEFAULT_LANGUAGE: SupportedLanguage = 'en';
const LanguageContext = React.createContext<string>(DEFAULT_LANGUAGE);

export const LanguageProvider = LanguageContext.Provider;

function useCurrentLanguage(): string {
  return React.useContext(LanguageContext);
}


export function useLanguage(): string {
  return useCurrentLanguage();
}


export function useTranslation() {
  const lang = useCurrentLanguage();
  return React.useCallback((key: TranslationKey, params?: TranslationParams) => {
    return translate(lang, key, params);
  }, [lang]);
}
