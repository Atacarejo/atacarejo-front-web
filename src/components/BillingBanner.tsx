// Aviso da assinatura no topo das telas: teste grátis, primeira fatura, pagamento pendente e cancelada.
// Só aparece quando exige uma ação do lojista (homologação: Alert para o que exige ação).
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Box, Button, Text } from "@nimbus-ds/components";
import { ExternalLinkIcon } from "@nimbus-ds/icons";
import { useI18n } from "../i18n";
import { billingVisible, isCanceled, useBilling } from "../lib/billing";
import { openExternal } from "../lib/external";

type Props = {
  /** Navegação da tela (a Home confere as alterações não salvas antes de sair). Padrão: navega direto. */
  onNavigate?: (path: string) => void;
};

export default function BillingBanner({ onNavigate }: Props) {
  const { billing } = useBilling();
  const navigate = useNavigate();
  const { t, formatDate, formatBRL } = useI18n();
  if (!billingVisible(billing)) return null;

  const go = onNavigate ?? navigate;
  const goToBilling = (label: string) => (
    <Button appearance="neutral" onClick={() => go("/billing")}>
      {label}
    </Button>
  );
  const payInvoice = billing.invoiceUrl ? (
    <Button
      as="a"
      appearance="neutral"
      href={billing.invoiceUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={openExternal(billing.invoiceUrl)}
    >
      <ExternalLinkIcon />
      {t("billing.payInvoice")}
    </Button>
  ) : (
    goToBilling(t("billing.banner.manage"))
  );

  const banner = (appearance: "primary" | "warning", title: string, text: string, action: ReactNode) => (
    <Alert appearance={appearance} title={title}>
      <Box display="flex" flexDirection="column" gap="2" alignItems="flex-start">
        <Text>{text}</Text>
        {action}
      </Box>
    </Alert>
  );

  if (billing.status === "trialing" && !billing.subscribed) {
    return banner(
      "primary",
      t("billing.banner.trial.title", { date: formatDate(billing.trialEndsOn) }),
      t("billing.banner.trial.text", { price: formatBRL(billing.price) }),
      goToBilling(t("billing.subscribe")),
    );
  }
  if (billing.status === "trialing" && billing.invoiceUrl) {
    return banner(
      "primary",
      t("billing.banner.firstInvoice.title"),
      t("billing.banner.firstInvoice.text", { date: formatDate(billing.invoiceDueDate) }),
      payInvoice,
    );
  }
  if (billing.status === "past_due") {
    return banner(
      "warning",
      t("billing.banner.pastDue.title"),
      t("billing.banner.pastDue.text", { date: formatDate(billing.graceUntil) }),
      payInvoice,
    );
  }
  if (isCanceled(billing)) {
    return banner(
      "warning",
      t("billing.banner.canceled.title"),
      t("billing.banner.canceled.text", { date: formatDate(billing.paidUntil) }),
      goToBilling(t("billing.resubscribe")),
    );
  }
  return null;
}
