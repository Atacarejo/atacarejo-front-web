// Cliente da atacarejo-api. Pega um session token novo do Nexo a cada requisição
// (exigência da homologação) e manda como Bearer.
import { getSessionToken } from "@tiendanube/nexo";
import nexo from "../nexoClient";

const BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

/** Valores que acompanham alguns erros (ex.: { max: 1000 }, { field: "email" }). */
export type ApiErrorParams = Record<string, string | number>;

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
  params: ApiErrorParams;
  constructor(
    status: number,
    code: string | null,
    apiMessage: string | null,
    requestId: string | null = null,
    params: ApiErrorParams = {},
  ) {
    super(apiMessage ?? `HTTP ${status}`);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.apiMessage = apiMessage;
    this.requestId = requestId;
    this.params = params;
  }
}

/** Só os params de texto ou número (o corpo de erro é dado externo). */
function paramsOf(value: unknown): ApiErrorParams {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string | number] =>
      typeof entry[1] === "string" || typeof entry[1] === "number",
    ),
  );
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
      paramsOf(data?.params),
    );
  }
  return data as T;
}

// Tipos das respostas da API

export type Variant = { id: number; name: string; price: string | null; sku: string | null; stock: number | null };
export type Product = { id: number; name: string; image: string | null; variants: Variant[] };
export type ProductsResponse = {
  products: Product[];
  total: number;
  page: number;
  perPage: number;
  /** busca por variante ou filtro que parou no limite de produtos percorridos: pode haver mais resultados */
  truncated?: boolean;
};
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
  /** quantos produtos têm algum preço de atacado (o resumo do topo) */
  wholesaleProducts: number;
};

/**
 * Situação da assinatura (GET /api/billing). disabled/exempt/pending = a loja não paga (nada a mostrar, a não ser
 * uma assinatura que ainda exista); closed = bloqueada e com os preços de atacado já apagados.
 */
export type BillingStatus = "disabled" | "exempt" | "pending" | "trialing" | "active" | "past_due" | "blocked" | "closed";
/** Forma de pagamento da assinatura no Stripe. */
export type PaymentMethod = "card" | "pix";
export type BillingPayment = {
  id: string;
  /** dia da cobrança da mensalidade, "AAAA-MM-DD" */
  dueDate: string;
  /** "69.99" */
  value: string;
  status: "paid" | "pending" | "overdue" | "refunded" | "other";
  paidOn: string | null;
  /** página da fatura no Stripe (abre numa nova aba) */
  invoiceUrl: string | null;
  method: PaymentMethod | null;
};
/** Dados de quem paga a assinatura (vão para o cliente no Stripe e aparecem nas faturas). */
export type BillingCustomer = { name: string; cpfCnpj: string; email: string };
export type Billing = {
  status: BillingStatus;
  /** false = o atacado está pausado na loja (o admin mostra só a assinatura) */
  allowed: boolean;
  /** mensalidade em reais, "69.99" */
  price: string;
  /** datas "AAAA-MM-DD" (dias de Brasília) */
  trialEndsOn: string | null;
  /** último dia pago: a renovação é cobrada nesse dia */
  paidUntil: string | null;
  /** past_due: último dia da tolerância */
  graceUntil: string | null;
  /** blocked: dia em que os preços de atacado serão apagados */
  closesOn: string | null;
  /** closed: dia em que os preços de atacado foram apagados */
  closedOn: string | null;
  subscribed: boolean;
  /** forma de pagamento da assinatura atual (null = sem assinatura) */
  paymentMethod: PaymentMethod | null;
  /** a loja pode pagar com Pix (só Brasil); fora dele, só cartão e o CPF/CNPJ é opcional */
  pixAvailable: boolean;
  /** o lojista abriu o Checkout do Stripe e ainda não concluiu (com assinatura: a troca para o cartão) */
  checkoutPending: boolean;
  /** o lojista cancelou: a assinatura segue até paidUntil, não renova, e dá para desfazer (POST /api/billing/resume) */
  cancelAtPeriodEnd: boolean;
  /** último dia em que cancelar devolve o valor pago (7 dias depois do primeiro pagamento); null = sem reembolso */
  refundableUntil: string | null;
  /** assinatura no cartão com a mensalidade recusada (outro cartão ou Pix) */
  cardDeclined: boolean;
  /** fatura em aberto mais antiga da assinatura (abre numa nova aba) */
  invoiceUrl: string | null;
  invoiceDueDate: string | null;
  payments: BillingPayment[];
  /** dados da loja para preencher o formulário de assinatura (GET /api/billing?prefill=1) */
  prefill: BillingCustomer | null;
};
/** POST /api/billing/subscribe: a situação + a página do Stripe para pagar (null = nada a pagar agora). */
export type SubscribeResult = Billing & { paymentUrl: string | null };
