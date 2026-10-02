import { createContext, useContext } from "react";
import { createI18n, type I18n } from "./i18n";
import { localeFromNavigator } from "./locale";

export const I18nContext = createContext<I18n | null>(null);

let navigatorI18n: I18n | null = null;

/** Idioma/moeda da loja. Fora do provider, cai no idioma do navegador. */
export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (value) return value;
  navigatorI18n ??= createI18n(localeFromNavigator());
  return navigatorI18n;
}

/** Atalho: `const t = useT(); t("home.title")`. */
export function useT(): I18n["t"] {
  return useI18n().t;
}
