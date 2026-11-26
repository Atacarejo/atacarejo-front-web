// Aviso da assinatura no topo das telas do app (homologação: Alert para o que exige ação do lojista).
// Vermelho quando o preço de atacado está para sair da loja: teste acabando (últimos 3 dias), assinatura
// cancelada terminando e pagamento pendente (o app segue funcionando até o fim da tolerância). Azul no teste
// grátis e com a fatura do Pix em aberto. Bloqueada não chega aqui: o BillingGate leva para a assinatura.
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Box, Button, Text } from "@nimbus-ds/components";
import { ExternalLinkIcon } from "@nimbus-ds/icons";
import { useI18n } from "../i18n";
import { billingAttention, invoiceDeadline, methodOf, useBilling } from "../lib/billing";
import { formatDeadline } from "../lib/dates";
import { openExternal } from "../lib/external";

type Props = {
  /** Navegação da tela (a Home confere as alterações não salvas antes de sair). Padrão: navega direto. */
  onNavigate?: (path: string) => void;
  /** a tela já mostra o teste grátis (o resumo da Home): o aviso azul do teste não aparece */
  hideTrial?: boolean;
};

export default function BillingBanner({ onNavigate, hideTrial = false }: Props) {
  const { billing, today } = useBilling();
  const navigate = useNavigate();
  const { t, tp, formatDate, formatBRL } = useI18n();
  if (!billing) return null;

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
  const banner = (appearance: "primary" | "warning" | "danger", title: string, text: string, action: ReactNode) => (
    <Alert appearance={appearance} title={title}>
      <Box display="flex" flexDirection="column" gap="2" alignItems="flex-start">
        <Text>{text}</Text>
        {action}
      </Box>
    </Alert>
  );

  const attention = billingAttention(billing, today);
  switch (attention?.kind) {
    case "ending": {
      const date = formatDate(attention.until);
      if (attention.reason === "canceled") {
        return banner("danger", t("billing.banner.canceled.title", { date }), t("billing.banner.canceled.text"), goToBilling(t("billing.resubscribe")));
      }
      const title = attention.daysLeft === 0 ? t("billing.banner.endingToday.title") : tp("billing.banner.ending.title", attention.daysLeft);
      return banner("danger", title, t("billing.banner.ending.text", { date }), goToBilling(t("billing.subscribe")));
    }
    case "declined": {
      const text = billing.pixAvailable ? t("billing.declined.text") : t("billing.declined.textNoPix");
      const until = formatDeadline(invoiceDeadline(billing), formatDate, (date) => t("billing.declined.until", { date }));
      return banner("danger", t("billing.declined.title"), until ? `${text} ${until}` : text, (
        <Box display="flex" gap="2" flexWrap="wrap">
          {billing.invoiceUrl && (
            <Button
              as="a"
              appearance="neutral"
              href={billing.invoiceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={openExternal(billing.invoiceUrl)}
            >
              <ExternalLinkIcon />
              {t("billing.declined.otherCard")}
            </Button>
          )}
          {goToBilling(t("billing.banner.manage"))}
        </Box>
      ));
    }
    case "pastDue": {
      const date = formatDate(billing.graceUntil);
      const text = methodOf(billing) === "pix" ? t("billing.banner.pastDue.textPix", { date }) : t("billing.banner.pastDue.textCard", { date });
      return banner("danger", t("billing.banner.pastDue.title"), text, payInvoice);
    }
    case "invoice":
      return banner(
        "primary",
        t("billing.banner.invoice.title"),
        t("billing.banner.invoice.text", { date: formatDate(invoiceDeadline(billing)) }),
        payInvoice,
      );
    case "notRequired":
      return banner("warning", t("billing.banner.notRequired.title"), t("billing.text.notRequired"), goToBilling(t("billing.banner.manage")));
    case "paused":
      return null;
  }
  if (billing.status === "trialing" && !billing.subscribed && !hideTrial) {
    return banner(
      "primary",
      t("billing.banner.trial.title", { date: formatDate(billing.trialEndsOn) }),
      t("billing.banner.trial.text", { price: formatBRL(billing.price) }),
      goToBilling(t("billing.subscribe")),
    );
  }
  return null;
}
