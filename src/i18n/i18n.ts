// Objeto entregue pelo contexto: tradutor + formatação de dinheiro no locale/moeda da loja.
import { currencySymbol, decimalSeparator, formatMoney, pricePlaceholder } from "../lib/price";
import type { StoreLocale } from "./locale";
import { createTranslator } from "./translator";
import type { Translator } from "./types";

export type I18n = Translator &
  StoreLocale & {
    /** "10.50" → "R$ 10,50" / "$ 10,50" / "$10.50"; vazio → "—" */
    formatMoney: (value: string | null) => string;
    currencySymbol: string;
    decimalSeparator: string;
    pricePlaceholder: string;
  };

export function createI18n(store: StoreLocale): I18n {
  return {
    ...store,
    ...createTranslator(store.language),
    formatMoney: (value) => formatMoney(value, store.locale, store.currency),
    currencySymbol: currencySymbol(store.locale, store.currency),
    decimalSeparator: decimalSeparator(store.locale),
    pricePlaceholder: pricePlaceholder(store.locale),
  };
}
