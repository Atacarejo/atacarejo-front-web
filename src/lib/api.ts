// Cliente da atacarejo-api. Pega um session token novo do Nexo a cada requisição
// (exigência da homologação) e manda como Bearer.
import { getSessionToken } from "@tiendanube/nexo";
import nexo from "../nexoClient";

const BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

export class ApiRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
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
    throw new ApiRequestError(data?.message ?? "Não foi possível falar com o servidor", res.status);
  }
  return data as T;
}

// Tipos das respostas da API

export type Variant = { id: number; name: string; price: string | null; sku: string | null; stock: number | null };
export type Product = { id: number; name: string; image: string | null; variants: Variant[] };
export type ProductsResponse = { products: Product[]; total: number; page: number; perPage: number };
export type WholesalePrice = { productId: number; variantId: number; price: string };
export type StoreConfig = {
  minQuantity: number;
  atcStoreType: "all" | "product" | "mixed";
  designOption: number;
  /** false = a promoção não foi criada na instalação (precisa "Concluir configuração") */
  ready: boolean;
  hasWholesalePrices: boolean;
};
