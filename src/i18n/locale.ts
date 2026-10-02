// Idioma, locale (BCP 47) e moeda da loja. A homologação exige que o admin se adapte à
// região da loja (GET /store): Brasil em português, demais países em espanhol/inglês.

export const LANGUAGES = ["pt", "es", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

/** Idioma quando não dá para reconhecer o da loja (a maioria das lojas fora do Brasil é hispânica). */
export const DEFAULT_LANGUAGE: Language = "es";
export const DEFAULT_CURRENCY = "BRL";

/** Região padrão de cada idioma quando a loja não informa o país. */
const DEFAULT_REGION: Record<Language, string> = { pt: "BR", es: "AR", en: "US" };

/** Moeda pelo país, para quando a loja não informa a moeda. */
const COUNTRY_CURRENCY: Record<string, string> = {
  BR: "BRL",
  AR: "ARS",
  MX: "MXN",
  CO: "COP",
  CL: "CLP",
  UY: "UYU",
  PE: "PEN",
  US: "USD",
};

export type StoreLocale = {
  language: Language;
  /** BCP 47 usado no Intl (ex.: "pt-BR", "es-AR", "en-US") */
  locale: string;
  /** ISO 4217 (ex.: "BRL", "ARS") */
  currency: string;
  country: string | null;
};

/** Dados crus da loja, como vêm de GET /api/store ou do getStoreInfo do Nexo. */
export type StoreLocaleInput = {
  language?: string | null;
  country?: string | null;
  currency?: string | null;
};

function isLanguage(value: string): value is Language {
  return (LANGUAGES as readonly string[]).includes(value);
}

/** "ar" / " AR " → "AR"; qualquer coisa que não seja ISO 3166 alfa-2 → null. */
export function normalizeCountry(country: string | null | undefined): string | null {
  const c = (country ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : null;
}

/** Região de uma tag de idioma: "es-AR" / "pt_BR" → "AR" / "BR". */
function regionOf(tag: string | null | undefined): string | null {
  const parts = (tag ?? "").trim().split(/[-_]/);
  return parts.length > 1 ? normalizeCountry(parts[parts.length - 1]) : null;
}

/**
 * "pt_BR" / "es-AR" / "EN" → prefixo suportado. Idioma desconhecido: loja do Brasil → "pt",
 * senão "es".
 */
export function resolveLanguage(language: string | null | undefined, country?: string | null): Language {
  const prefix = (language ?? "").trim().toLowerCase().split(/[-_]/)[0];
  if (isLanguage(prefix)) return prefix;
  if (normalizeCountry(country) === "BR") return "pt";
  return DEFAULT_LANGUAGE;
}

/** Idioma + país → BCP 47 válido (ex.: es + MX → "es-MX"; es sem país → "es-AR"). */
export function resolveLocale(language: Language, country?: string | null): string {
  const region = normalizeCountry(country) ?? DEFAULT_REGION[language];
  try {
    return Intl.getCanonicalLocales(`${language}-${region}`)[0];
  } catch {
    return `${language}-${DEFAULT_REGION[language]}`;
  }
}

/** Moeda ISO 4217 da loja; sem moeda válida, usa a do país e por fim BRL. */
export function resolveCurrency(currency: string | null | undefined, country?: string | null): string {
  const c = (currency ?? "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(c)) return c;
  return COUNTRY_CURRENCY[normalizeCountry(country) ?? ""] ?? DEFAULT_CURRENCY;
}

export function buildStoreLocale(input: StoreLocaleInput | null | undefined): StoreLocale {
  const country = normalizeCountry(input?.country) ?? regionOf(input?.language);
  const language = resolveLanguage(input?.language, country);
  return {
    language,
    locale: resolveLocale(language, country),
    currency: resolveCurrency(input?.currency, country),
    country,
  };
}

/** Antes do Nexo conectar a loja ainda é desconhecida: usa o idioma do navegador. */
export function localeFromNavigator(): StoreLocale {
  const language = typeof navigator === "undefined" ? null : navigator.language;
  return buildStoreLocale({ language });
}
