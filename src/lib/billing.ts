// Assinatura do Atacarejo (cobrada pelo Asaas): estado compartilhado pelo admin e regras de exibição.
import { createContext, useContext } from "react";
import type { I18n } from "../i18n";
import type { MessageKey } from "../i18n/types";
import { api, ApiRequestError, type Billing, type BillingCustomer } from "./api";

export type BillingContextValue = {
  /** null = ainda não carregou ou a API falhou (o app segue liberado) */
  billing: Billing | null;
  /**
   * Busca de novo; devolve null se falhar (o estado anterior fica). Uma resposta que chega depois de um
   * setBilling mais novo (ex.: o resultado do assinar) é descartada.
   */
  refresh: (options?: { prefill?: boolean; sync?: boolean }) => Promise<Billing | null>;
  setBilling: (billing: Billing) => void;
};

export const BillingContext = createContext<BillingContextValue | null>(null);

export function useBilling(): BillingContextValue {
  const value = useContext(BillingContext);
  if (!value) throw new Error("useBilling fora do BillingProvider");
  return value;
}

/**
 * GET /api/billing. Falha ou demora → null: o app nunca trava por causa da cobrança.
 * `prefill`: traz os dados da loja para o formulário de assinatura (só a tela de assinatura pede).
 * `sync`: a API confere as mensalidades no Asaas antes (botão "Atualizar situação").
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

/** A loja paga assinatura? (cobrança ligada, loja do Brasil e não isenta) */
export function billingVisible(billing: Billing | null): billing is Billing {
  return billing !== null && !["disabled", "exempt", "pending"].includes(billing.status);
}

/** Assinatura cancelada, mas ainda dentro do período pago. */
export function isCanceled(billing: Billing): boolean {
  return billing.status === "active" && !billing.subscribed;
}

/** Já pagou alguma mensalidade (para dizer "assinar de novo" e não "assinar"). */
export function hasPaidBefore(billing: Billing): boolean {
  return billing.status === "closed" || billing.payments.some((p) => p.status === "paid");
}

type TagAppearance = "primary" | "success" | "warning" | "danger" | "neutral";

/** Rótulo, cor e texto da situação (tela de assinatura e card nas configurações). */
export function billingStatusInfo(billing: Billing, i18n: Pick<I18n, "t" | "formatDate">) {
  const { t, formatDate } = i18n;
  const info = (labelKey: MessageKey, appearance: TagAppearance, text: string) => ({ label: t(labelKey), appearance, text });
  // assinou, mas a fatura ainda não chegou do Asaas (aparece em instantes)
  const invoicePending = billing.subscribed && !billing.invoiceUrl;
  switch (billing.status) {
    case "trialing":
      if (invoicePending) return info("billing.status.trialing", "primary", t("billing.text.invoicePending"));
      return billing.subscribed && billing.invoiceDueDate
        ? info("billing.status.trialing", "primary", t("billing.text.trialSubscribed", { date: formatDate(billing.trialEndsOn), due: formatDate(billing.invoiceDueDate) }))
        : info("billing.status.trialing", "primary", t("billing.text.trial", { date: formatDate(billing.trialEndsOn) }));
    case "active":
      return isCanceled(billing)
        ? info("billing.status.canceled", "warning", t("billing.text.canceled", { date: formatDate(billing.paidUntil) }))
        : info("billing.status.active", "success", t("billing.text.active", { date: formatDate(billing.paidUntil) }));
    case "past_due":
      return info("billing.status.past_due", "warning", t("billing.text.pastDue", { date: formatDate(billing.graceUntil) }));
    case "blocked":
    case "closed": {
      const label: MessageKey = billing.status === "closed" ? "billing.status.closed" : "billing.status.blocked";
      if (billing.subscribed) {
        return info(label, "danger", invoicePending ? t("billing.text.invoicePending") : t("billing.text.blockedSubscribed"));
      }
      if (billing.status === "closed") return info(label, "danger", t("billing.text.closed", { date: formatDate(billing.closedOn) }));
      return hasPaidBefore(billing)
        ? info(label, "danger", t("billing.text.blocked"))
        : info(label, "danger", t("billing.text.trialEnded", { date: formatDate(billing.trialEndsOn) }));
    }
    default:
      return info("billing.status.active", "success", t("billing.notRequired.text"));
  }
}

/** Último dia em que o atacado funciona sem pagar mais nada (fim do teste ou do período pago). */
export function accessUntil(billing: Billing): string | null {
  const dates = [billing.trialEndsOn, billing.paidUntil].filter((d): d is string => Boolean(d));
  return dates.length ? dates.sort().at(-1)! : null;
}

// Validação no navegador só para avisar cedo; quem decide é a API (dígitos do CPF/CNPJ etc.)
export function looksLikeName(value: string): boolean {
  const v = value.trim();
  return v.length >= 2 && v.length <= 100;
}

/** CPF (11 dígitos) ou CNPJ (14 caracteres, numérico ou alfanumérico), com ou sem pontuação. */
export function looksLikeCpfCnpj(value: string): boolean {
  const v = value.replace(/[\s./-]/g, "").toUpperCase();
  return /^\d{11}$/.test(v) || /^[0-9A-Z]{12}\d{2}$/.test(v);
}

export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export type CustomerField = keyof BillingCustomer;
export type FieldErrors = Partial<Record<CustomerField, boolean>>;

/** Códigos de erro da API → campo com problema. */
const FIELD_OF_CODE: Record<string, CustomerField> = {
  invalid_billing_name: "name",
  invalid_cpf_cnpj: "cpfCnpj",
  invalid_email: "email",
};

/** Campos recusados pela API (400 com o código do campo); outros erros → {}. */
export function fieldErrorsOf(err: unknown): FieldErrors {
  const field = err instanceof ApiRequestError && err.code ? FIELD_OF_CODE[err.code] : undefined;
  return field ? { [field]: true } : {};
}

export function customerIsValid(c: BillingCustomer): boolean {
  return looksLikeName(c.name) && looksLikeCpfCnpj(c.cpfCnpj) && looksLikeEmail(c.email);
}
