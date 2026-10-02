import type { pt } from "./dictionaries/pt";
import type { Language } from "./locale";

/** Todas as chaves de texto do app (a fonte é o dicionário pt). */
export type MessageKey = keyof typeof pt;

/** Cada dicionário precisa ter exatamente as mesmas chaves do pt. */
export type Dictionary = Record<MessageKey, string>;

/** Chaves com plural: "x" quando existem "x.one" e "x.other". */
export type PluralKey = {
  [K in MessageKey]: K extends `${infer Base}.one` ? (`${Base}.other` extends MessageKey ? Base : never) : never;
}[MessageKey];

export type Params = Record<string, string | number>;

export type Translator = {
  language: Language;
  t: (key: MessageKey, params?: Params) => string;
  /** Plural: count === 1 usa ".one", senão ".other". {count} já vai nos params. */
  tp: (key: PluralKey, count: number, params?: Params) => string;
};
