// Descobre a região da loja uma vez, logo depois do connect do Nexo:
// GET /api/store (a API lê o GET /store da Nuvemshop) → getStoreInfo do Nexo → "es".
import { getStoreInfo } from "@tiendanube/nexo";
import nexo from "../nexoClient";
import { api, type StoreInfo } from "../lib/api";
import { buildStoreLocale, type StoreLocale } from "./locale";

/** Evita que o app fique em branco se o admin ou a API não responderem. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export async function loadStoreLocale(): Promise<StoreLocale> {
  try {
    return buildStoreLocale(await withTimeout(api<StoreInfo>("/api/store"), 6000));
  } catch (err) {
    console.warn("[i18n] GET /api/store falhou, usando getStoreInfo do Nexo", err);
  }
  try {
    return buildStoreLocale(await withTimeout(getStoreInfo(nexo), 4000));
  } catch (err) {
    console.warn("[i18n] getStoreInfo falhou, usando idioma padrão", err);
  }
  return buildStoreLocale(null);
}
