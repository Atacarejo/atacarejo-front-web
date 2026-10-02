// Cliente da atacarejo-api. Pega um session token novo do Nexo a cada requisição
// (exigência da homologação) e manda como Bearer.
import { getSessionToken } from "@tiendanube/nexo";
import nexo from "../nexoClient";

const BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

/**
 * Erro HTTP da API. `code` é estável (ex.: "invalid_price") e é o que a UI traduz
 * (i18n/api-errors.ts); `apiMessage` é o texto cru da API, em português.
 */
export class ApiRequestError extends Error {
  status: number;
  code: string | null;
  apiMessage: string | null;
  constructor(status: number, code: string | null, apiMessage: string | null) {
    super(apiMessage ?? `HTTP ${status}`);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.apiMessage = apiMessage;
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getSessionToken(nexo);
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiRequestError(
      res.status,
      typeof data?.code === "string" ? data.code : null,
      typeof data?.message === "string" ? data.message : null,
    );
  }
  return data as T;
}

// Tipos das respostas da API

export type Variant = { id: number; name: string; price: string | null; sku: string | null; stock: number | null };
export type Product = { id: number; name: string; image: string | null; variants: Variant[] };
export type ProductsResponse = { products: Product[]; total: number; page: number; perPage: number };
export type WholesalePrice = { productId: number; variantId: number; price: string };
/** GET /api/store: região da loja, para o admin se adaptar (idioma e moeda). */
export type StoreInfo = { language: string | null; country: string | null; currency: string | null };
export type StoreConfig = {
  minQuantity: number;
  atcStoreType: "all" | "product" | "mixed";
  designOption: number;
  /** false = a promoção não foi criada na instalação (precisa "Concluir configuração") */
  ready: boolean;
  hasWholesalePrices: boolean;
};
