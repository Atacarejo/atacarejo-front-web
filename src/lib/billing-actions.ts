// Ações da assinatura usadas em mais de uma tela: abrir o portal do cliente do Stripe (trocar o cartão, ver
// recibos) e o "Já paguei, atualizar", com os avisos de erro.
import { useState } from "react";
import { useToast } from "@nimbus-ds/components";
import { apiErrorMessage, useI18n } from "../i18n";
import { api } from "./api";
import { hasOpenInvoice, useBilling } from "./billing";
import { openPendingTab } from "./external";

export function useBillingActions() {
  const { addToast } = useToast();
  const i18n = useI18n();
  const { t } = i18n;
  const { refresh, watchPayment } = useBilling();
  const [portalBusy, setPortalBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  // página que o navegador não deixou abrir sozinha (bloqueio de nova aba): a tela mostra um link
  const [blockedUrl, setBlockedUrl] = useState<string | null>(null);

  /** Portal do cliente do Stripe numa nova aba. `watch`: há fatura em aberto, então confere até ela ser paga. */
  const openPortal = async ({ watch = false } = {}) => {
    // a aba abre já no clique: depois da resposta da API o navegador bloquearia
    const tab = openPendingTab(t("billing.openingStripe"));
    setPortalBusy(true);
    setBlockedUrl(null);
    try {
      const { url } = await api<{ url: string }>("/api/billing/portal", {
        method: "POST",
        body: JSON.stringify({ locale: i18n.language }),
      });
      if (!tab.go(url)) setBlockedUrl(url);
      if (watch) watchPayment();
    } catch (err) {
      tab.close();
      addToast({
        id: "billing-portal-error",
        type: "danger",
        text: apiErrorMessage(err, i18n, "billing.toast.portalError"),
        duration: 8000,
      });
    } finally {
      setPortalBusy(false);
    }
  };

  /** "Já paguei, atualizar": confere no Stripe agora e continua conferindo por alguns minutos. */
  const checkPayment = async () => {
    setChecking(true);
    watchPayment();
    const next = await refresh({ sync: true });
    setChecking(false);
    if (!next) {
      addToast({ id: "billing-check-error", type: "danger", text: t("billing.toast.refreshError"), duration: 8000 });
    } else if (next.checkoutPending || hasOpenInvoice(next)) {
      addToast({ id: "billing-check-pending", type: "primary", text: t("billing.toast.notPaidYet"), duration: 8000 });
    }
    return next;
  };

  return { openPortal, portalBusy, checkPayment, checking, blockedUrl, clearBlockedUrl: () => setBlockedUrl(null) };
}
