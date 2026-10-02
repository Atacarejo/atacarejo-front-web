// Tradução sem biblioteca: dicionários tipados, interpolação {nome} e plural .one/.other.
import { en } from "./dictionaries/en";
import { es } from "./dictionaries/es";
import { pt } from "./dictionaries/pt";
import type { Language } from "./locale";
import type { Dictionary, MessageKey, Params, PluralKey, Translator } from "./types";

export const DICTIONARIES: Record<Language, Dictionary> = { pt, es, en };

/** "Olá, {name}" + { name: "Ana" } → "Olá, Ana". Placeholder sem valor fica como está. */
export function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : match,
  );
}

export function createTranslator(language: Language): Translator {
  const dict = DICTIONARIES[language];
  const t = (key: MessageKey, params?: Params) => interpolate(dict[key] ?? pt[key] ?? key, params);
  const tp = (key: PluralKey, count: number, params?: Params) => {
    const pluralKey: MessageKey = count === 1 ? `${key}.one` : `${key}.other`;
    return t(pluralKey, { count, ...params });
  };
  return { language, t, tp };
}
