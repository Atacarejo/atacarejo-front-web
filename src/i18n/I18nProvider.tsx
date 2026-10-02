import { useEffect, useMemo, type ReactNode } from "react";
import { I18nContext } from "./context";
import { createI18n } from "./i18n";
import type { StoreLocale } from "./locale";

export default function I18nProvider({ store, children }: { store: StoreLocale; children: ReactNode }) {
  const value = useMemo(() => createI18n(store), [store]);

  // leitores de tela e corretor do navegador seguem o idioma da loja
  useEffect(() => {
    document.documentElement.lang = store.locale;
  }, [store.locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
