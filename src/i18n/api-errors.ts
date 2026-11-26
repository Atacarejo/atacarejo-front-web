// Erros da API → texto no idioma da loja. Único lugar para mapear códigos novos:
// adicione o `code` em API_ERROR_KEYS e a chave nos três dicionários.
import { ApiRequestError } from "../lib/api";
import type { MessageKey, Translator } from "./types";

export const API_ERROR_KEYS: Readonly<Record<string, MessageKey>> = {
  invalid_design_option: "apiError.invalidDesignOption",
  invalid_min_quantity: "apiError.invalidMinQuantity",
  invalid_price: "apiError.invalidPrice",
  store_not_installed: "apiError.storeNotInstalled",
  rate_limited: "apiError.rateLimited",
  nuvemshop_unavailable: "apiError.nuvemshopUnavailable",
  invalid_token: "apiError.invalidToken",
  unauthorized: "apiError.unauthorized",
  invalid_billing_name: "apiError.invalidBillingName",
  invalid_cpf_cnpj: "apiError.invalidCpfCnpj",
  invalid_email: "apiError.invalidEmail",
  billing_not_required: "apiError.billingNotRequired",
  billing_busy: "apiError.billingBusy",
  no_subscription: "apiError.noSubscription",
  billing_unavailable: "apiError.billingUnavailable",
  invalid_payment_method: "apiError.invalidPaymentMethod",
  refund_unavailable: "apiError.refundUnavailable",
  subscription_canceling: "apiError.subscriptionCanceling",
  // a mensagem do Stripe vem em inglês: o texto é nosso (o campo recusado vai em params.field)
  invalid_billing_data: "apiError.invalidBillingData",
};

/**
 * Texto do toast para um erro de chamada à API.
 * 1. `code` conhecido → texto traduzido.
 * 2. Sem code conhecido → genérico pelo status (401/403, 429, 5xx).
 * 3. Outros 4xx: em pt mostra a mensagem da API (como antes); em es/en, 400/422 → dado inválido.
 * 4. Resto (erro de rede, 404...) → `fallback` (texto do contexto, ex.: "Não foi possível salvar").
 * A mensagem crua da API (em português) nunca aparece para lojas em es/en.
 */
export function apiErrorMessage(err: unknown, tr: Pick<Translator, "t" | "language">, fallback: MessageKey): string {
  if (!(err instanceof ApiRequestError)) return tr.t(fallback);
  const message = baseMessage(err, tr, fallback);
  // 5xx: o código do erro ajuda o suporte a achar o log
  return err.status >= 500 && err.requestId ? `${message} (${tr.t("apiError.requestId", { id: err.requestId })})` : message;
}

function baseMessage(err: ApiRequestError, tr: Pick<Translator, "t" | "language">, fallback: MessageKey): string {
  const key = err.code !== null && Object.hasOwn(API_ERROR_KEYS, err.code) ? API_ERROR_KEYS[err.code] : undefined;
  if (key) return tr.t(key);

  const { status } = err;
  if (status === 401 || status === 403) return tr.t("apiError.unauthorized");
  if (status === 429) return tr.t("apiError.rateLimited");
  if (status >= 500) return tr.t("apiError.server");
  if (tr.language === "pt" && status >= 400 && err.apiMessage) return err.apiMessage;
  if (status === 400 || status === 422) return tr.t("apiError.badRequest");
  return tr.t(fallback);
}
