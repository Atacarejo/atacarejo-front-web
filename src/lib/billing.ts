// Assinatura do Atacarejo (cobrada pelo Stripe): estado compartilhado pelo admin e regras de exibição.
// Quem decide a situação é a API (GET /api/billing); aqui só se escolhe o que mostrar.
import { createContext, useContext } from "react";
import type { I18n } from "../i18n";
import type { MessageKey } from "../i18n/types";
import { api, ApiRequestError, type Billing, type BillingCustomer, type PaymentMethod } from "./api";
import { addDays, daysBetween } from "./dates";

export type BillingContextValue = {
  /** null = ainda não carregou ou a API falhou (o app segue liberado) */
  billing: Billing | null;
  /** hoje em Brasília (o calendário dos prazos), renovado a cada resposta da API */
  today: string;
  /**
   * Busca de novo; devolve null se falhar (o estado anterior fica). Uma resposta que chega depois de um
   * setBilling mais novo (ex.: o resultado do assinar) é descartada.
   */
  refresh: (options?: { prefill?: boolean; sync?: boolean }) => Promise<Billing | null>;
  setBilling: (billing: Billing) => void;
  /** O lojista abriu uma página de pagamento do Stripe: o app confere a situação até o pagamento chegar. */
  watchPayment: () => void;
  /** Checkout aberto ou fatura sendo paga: o app está conferindo a situação no Stripe. */
  pending: boolean;
};

export const BillingContext = createContext<BillingContextValue | null>(null);

export function useBilling(): BillingContextValue {
  const value = useContext(BillingContext);
  if (!value) throw new Error("useBilling fora do BillingProvider");
  return value;
}

/**
 * GET /api/billing. Falha ou demora → null: o app nunca trava por causa da cobrança.
 * `prefill`: traz os dados da loja para o formulário de assinatura (só a tela de assinar pede).
 * `sync`: a API confere o checkout e as faturas direto no Stripe antes (o webhook pode atrasar).
 */
export async function loadBilling({ prefill = false, sync = false, timeoutMs = 8000 } = {}): Promise<Billing | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    const query = new URLSearchParams();
    if (prefill) query.set("prefill", "1");
    if (sync) query.set("sync", "1");
    const path = query.size ? `/api/billing?${query}` : "/api/billing";
    return await Promise.race([api<Billing>(path), timeout]);
  } catch (err) {
    console.warn("[billing] GET /api/billing falhou", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const NOT_REQUIRED: readonly string[] = ["disabled", "exempt", "pending"];

/** Cobrança ligada e o teste grátis ainda não começou: o admin mostra só a tela de boas-vindas. */
export function trialNotStarted(billing: Billing | null): boolean {
  return billing !== null && billing.status === "pending";
}

/** A loja paga assinatura? (cobrança ligada e loja não isenta) */
export function billingVisible(billing: Billing | null): billing is Billing {
  return billing !== null && !NOT_REQUIRED.includes(billing.status);
}

/**
 * Cobrança não exigida (desligada ou loja isenta), mas a assinatura no Stripe continua e pode gerar cobranças:
 * o lojista vê e cancela pelo app, sem precisar do suporte (diretriz 3.2 da Nuvemshop).
 */
export function subscribedNotRequired(billing: Billing): boolean {
  return billing.subscribed && NOT_REQUIRED.includes(billing.status);
}

/** A tela de assinatura e o card das configurações têm o que mostrar? (a loja paga, ou tem assinatura para cancelar) */
export function billingManageable(billing: Billing | null): billing is Billing {
  return billingVisible(billing) || (billing !== null && subscribedNotRequired(billing));
}

/** Assinatura cancelada, mas ainda dentro do período pago. */
export function isCanceled(billing: Billing): boolean {
  return billing.status === "active" && !billing.subscribed;
}

/** Já pagou alguma mensalidade (para dizer "assinar de novo" e não "assinar"). */
export function hasPaidBefore(billing: Billing): boolean {
  return billing.status === "closed" || billing.payments.some((p) => p.status === "paid");
}

/** Assinatura com fatura em aberto (Pix do mês ou cartão recusado): o lojista paga pelo link do Stripe. */
export function hasOpenInvoice(billing: Billing): boolean {
  return billing.subscribed && billing.invoiceUrl !== null;
}

/** Forma de pagamento da assinatura (a API sempre informa; sem ela, vale a cobrança automática). */
export function methodOf(billing: Billing): PaymentMethod {
  return billing.paymentMethod ?? "card";
}

/** Último dia em que o atacado funciona sem pagar mais nada (fim do teste ou do período pago). */
export function accessUntil(billing: Billing): string | null {
  const dates = [billing.trialEndsOn, billing.paidUntil].filter((d): d is string => Boolean(d));
  return dates.length ? dates.sort().at(-1)! : null;
}

/**
 * Primeira cobrança de uma assinatura nova: a API adia para o último dia do teste ou do período já pago (o
 * lojista não perde os dias que faltam). null = cobra na hora (teste e período pago já acabaram).
 */
export function firstChargeOn(billing: Billing, today: string): string | null {
  const until = accessUntil(billing);
  return until && until >= today ? until : null;
}

/** Dias de tolerância depois do vencimento (o mesmo PLAN.graceDays da API). */
const GRACE_DAYS = 7;

/** Até quando pagar a fatura em aberto sem o atacado pausar: o fim da tolerância. */
export function invoiceDeadline(billing: Billing): string | null {
  if (billing.graceUntil) return billing.graceUntil;
  const until = accessUntil(billing);
  return until ? addDays(until, GRACE_DAYS) : null;
}

/** Próxima cobrança de quem assinou: a primeira (no teste) ou a renovação (no último dia pago). */
export function nextChargeOn(billing: Billing): string | null {
  if (!billing.subscribed || billing.cancelAtPeriodEnd) return null;
  if (billing.status === "trialing") return billing.trialEndsOn;
  if (billing.status === "active") return billing.paidUntil;
  return null;
}

/** Aviso vermelho nos últimos 3 dias do teste (ou do período pago de quem cancelou), como no protótipo aprovado. */
const ENDING_DAYS = 3;

/** O que exige atenção do lojista agora (avisos das telas e da assinatura). */
export type BillingAttention =
  /** sem assinatura, e o teste grátis (ou o período pago de quem cancelou) acaba em até 3 dias */
  | { kind: "ending"; reason: "trial" | "canceled"; daysLeft: number; until: string }
  /** assinou no cartão e a mensalidade foi recusada: outro cartão ou Pix */
  | { kind: "declined" }
  /** assinou e a mensalidade venceu sem pagamento: o app funciona até graceUntil */
  | { kind: "pastDue" }
  /** assinou, mas o atacado está pausado (bloqueada ou encerrada) até a fatura ser paga */
  | { kind: "paused" }
  /** assinou e há fatura em aberto antes do vencimento (Pix do mês, ou cartão recusado) */
  | { kind: "invoice" }
  /** cobrança não exigida, mas a assinatura continua no Stripe e pode cobrar */
  | { kind: "notRequired" };

export function billingAttention(billing: Billing | null, today: string): BillingAttention | null {
  if (!billing) return null;
  if (subscribedNotRequired(billing)) return { kind: "notRequired" };
  if (!billingVisible(billing)) return null;
  if (billing.subscribed && !billing.cancelAtPeriodEnd) {
    if (billing.cardDeclined && billing.allowed) return { kind: "declined" };
    if (billing.status === "past_due") return { kind: "pastDue" };
    if (billing.status === "blocked" || billing.status === "closed") return { kind: "paused" };
    return billing.invoiceUrl ? { kind: "invoice" } : null;
  }
  if (billing.status !== "trialing" && !isCanceled(billing) && !billing.cancelAtPeriodEnd) return null;
  const until = accessUntil(billing);
  const days = until ? daysBetween(today, until) : null;
  if (!until || days === null || days > ENDING_DAYS) return null;
  // relógio do aparelho adiantado: a API ainda dá a loja como liberada, então é o último dia
  return { kind: "ending", reason: billing.status === "trialing" ? "trial" : "canceled", daysLeft: Math.max(0, days), until };
}

type TagAppearance = "primary" | "success" | "warning" | "danger" | "neutral";

/** Rótulo, cor e texto da situação (Tag da tela de assinatura e card nas configurações). */
export function billingStatusInfo(billing: Billing, i18n: Pick<I18n, "t" | "formatDate">, today: string) {
  const { t, formatDate } = i18n;
  const info = (labelKey: MessageKey, appearance: TagAppearance, text: string) => ({ label: t(labelKey), appearance, text });
  if (subscribedNotRequired(billing)) return info("billing.status.subscribed", "warning", t("billing.text.notRequired"));
  const card = methodOf(billing) === "card";
  switch (billing.status) {
    case "trialing": {
      const date = formatDate(billing.trialEndsOn);
      if (billing.subscribed) {
        return info("billing.status.subscribed", "success", t(card ? "billing.text.trialSubscribedCard" : "billing.text.trialSubscribedPix", { date }));
      }
      const ending = billingAttention(billing, today)?.kind === "ending";
      return info("billing.status.trialing", ending ? "danger" : "primary", t("billing.text.trial", { date }));
    }
    case "active": {
      const date = formatDate(billing.paidUntil);
      if (!billing.subscribed) return info("billing.status.canceled", "warning", t("billing.text.canceled", { date }));
      if (billing.cancelAtPeriodEnd) return info("billing.status.canceled", "warning", t("billing.text.canceling", { date }));
      return info("billing.status.subscribed", "success", t(card ? "billing.text.activeCard" : "billing.text.activePix", { date }));
    }
    case "past_due":
      return info("billing.status.pastDue", "danger", t("billing.text.pastDue", { date: formatDate(billing.graceUntil) }));
    case "blocked":
      if (billing.subscribed) return info("billing.status.blocked", "danger", t("billing.text.blockedSubscribed"));
      return hasPaidBefore(billing)
        ? info("billing.status.blocked", "danger", t("billing.text.blocked"))
        : info("billing.status.blocked", "danger", t("billing.text.trialEnded", { date: formatDate(billing.trialEndsOn) }));
    case "closed":
      return info("billing.status.closed", "danger", t("billing.text.closed", { date: formatDate(billing.closedOn) }));
    default:
      return info("billing.status.free", "success", t("billing.notRequired.text"));
  }
}

// Validação no navegador só para avisar cedo; quem decide é a API (dígitos do CPF/CNPJ etc.)
export function looksLikeName(value: string): boolean {
  const v = value.trim();
  return v.length >= 2 && v.length <= 100;
}

export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Nome e e-mail (o CPF/CNPJ não é pedido: não há nota fiscal). */
export function customerIsValid(c: BillingCustomer): boolean {
  return looksLikeName(c.name) && looksLikeEmail(c.email);
}

export type CustomerField = keyof BillingCustomer;
export type FieldErrors = Partial<Record<CustomerField, boolean>>;

/** Códigos de erro da API → campo com problema. */
const FIELD_OF_CODE: Record<string, CustomerField> = {
  invalid_billing_name: "name",
  invalid_cpf_cnpj: "cpfCnpj",
  invalid_email: "email",
};

/** Parâmetro que o Stripe recusou (params.field do invalid_billing_data) → campo do formulário; outro → null. */
export function customerFieldOfParam(param: unknown): CustomerField | null {
  if (typeof param !== "string") return null;
  if (/email/i.test(param)) return "email";
  // o CPF/CNPJ vai num campo da fatura (invoice_settings[custom_fields]) e na metadata
  if (/custom_fields|cpf|tax_id/i.test(param)) return "cpfCnpj";
  if (/(^|\[)name(\]|$)/i.test(param)) return "name";
  return null;
}

/** Campos recusados pela API (400 com o código do campo ou o campo que o Stripe recusou); outros erros → {}. */
export function fieldErrorsOf(err: unknown): FieldErrors {
  if (!(err instanceof ApiRequestError) || !err.code) return {};
  const field =
    err.code === "invalid_billing_data"
      ? customerFieldOfParam(err.params.field)
      : Object.hasOwn(FIELD_OF_CODE, err.code)
        ? FIELD_OF_CODE[err.code]
        : null;
  return field ? { [field]: true } : {};
}
