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
  /** Request-ID dos erros 5xx, para o lojista informar ao suporte */
  requestId: string | null;
  constructor(status: number, code: string | null, apiMessage: string | null, requestId: string | null = null) {
    super(apiMessage ?? `HTTP ${status}`);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.apiMessage = apiMessage;
    this.requestId = requestId;
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
      typeof data?.requestId === "string" ? data.requestId : res.headers.get("x-request-id"),
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

/** Situação da assinatura (GET /api/billing). disabled/exempt/pending = a loja não paga (nada a mostrar). */
export type BillingStatus = "disabled" | "exempt" | "pending" | "trialing" | "active" | "past_due" | "blocked" | "closed";
export type BillingPayment = {
  id: string;
  dueDate: string;
  /** "69.99" */
  value: string;
  status: "paid" | "pending" | "overdue" | "refunded" | "other";
  paidOn: string | null;
  invoiceUrl: string | null;
};
/** Dados de quem paga a assinatura (vão para o Asaas). */
export type BillingCustomer = { name: string; cpfCnpj: string; email: string };
export type Billing = {
  status: BillingStatus;
  /** false = o atacado está pausado na loja (o admin mostra só a assinatura) */
  allowed: boolean;
  /** mensalidade em reais, "69.99" */
  price: string;
  /** datas "AAAA-MM-DD" */
  trialEndsOn: string | null;
  paidUntil: string | null;
  graceUntil: string | null;
  closesOn: string | null;
  closedOn: string | null;
  subscribed: boolean;
  /** fatura em aberto para pagar (abre numa nova aba) */
  invoiceUrl: string | null;
  invoiceDueDate: string | null;
  payments: BillingPayment[];
  /** dados da loja para preencher o formulário de assinatura */
  prefill: BillingCustomer | null;
};
