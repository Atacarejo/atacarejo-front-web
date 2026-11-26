// Assinatura do Atacarejo (Stripe): boas-vindas (começar o teste grátis), situação, assinar no cartão (Checkout do
// Stripe) ou no Pix (fatura mensal com QR Code), acompanhar o pagamento feito na aba do Stripe, pagar a fatura em
// aberto, cartão recusado (outro cartão ou Pix), trocar entre Pix e cartão, trocar o cartão (portal do cliente),
// atualizar os dados de cobrança, cancelar e o histórico. Tudo sem falar com o suporte nem reinstalar o app
// (diretriz 3.2 da Nuvemshop). Uma ação primária por tela.
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { navigateHeader, navigateHeaderRemove } from "@tiendanube/nexo";
import { Alert, Box, Button, Card, Link, Modal, Skeleton, Spinner, Tag, Text, useToast } from "@nimbus-ds/components";
import { DataList, EmptyMessage, InteractiveList, Page } from "@nimbus-ds/patterns";
import {
  ArrowsHorizontalIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ExternalLinkIcon,
  GiftBoxIcon,
  RedoIcon,
} from "@nimbus-ds/icons";
import nexo from "../nexoClient";
import ErrorState, { SUPPORT_EMAIL } from "../components/ErrorState";
import BillingCustomerFields from "../components/BillingCustomerFields";
import {
  api,
  ApiRequestError,
  type Billing,
  type BillingCustomer,
  type BillingPayment,
  type PaymentMethod,
  type SubscribeResult,
} from "../lib/api";
import {
  accessUntil,
  billingManageable,
  billingStatusInfo,
  customerIsValid,
  fieldErrorsOf,
  firstChargeOn,
  hasOpenInvoice,
  invoiceDeadline,
  methodOf,
  nextChargeOn,
  subscribedNotRequired,
  trialNotStarted,
  useBilling,
  type CustomerField,
  type FieldErrors,
} from "../lib/billing";
import { useBillingActions } from "../lib/billing-actions";
import { daysBetween } from "../lib/dates";
import { isMobileApp, openExternal, openPendingTab } from "../lib/external";
import { apiErrorMessage, useI18n } from "../i18n";
import type { MessageKey } from "../i18n/types";

const EMPTY_CUSTOMER: BillingCustomer = { name: "", cpfCnpj: "", email: "" };
const ALL_TOUCHED = { name: true, cpfCnpj: true, email: true };
/** billing_busy: a outra aba está criando a assinatura; olha de novo depois disso */
const BUSY_RETRY_MS = 5000;

type TagAppearance = "success" | "primary" | "danger" | "neutral" | "warning";
const PAYMENT_TAG: Record<BillingPayment["status"], { key: MessageKey; appearance: TagAppearance }> = {
  paid: { key: "billing.payment.paid", appearance: "success" },
  pending: { key: "billing.payment.pending", appearance: "primary" },
  overdue: { key: "billing.payment.overdue", appearance: "danger" },
  refunded: { key: "billing.payment.refunded", appearance: "neutral" },
  other: { key: "billing.payment.other", appearance: "warning" },
};

export default function BillingPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const i18n = useI18n();
  const { t, tp, formatDate, formatBRL } = i18n;
  const { billing, today, refresh, setBilling, watchPayment, pending } = useBilling();
  const { openPortal, portalBusy, checkPayment, checking, blockedUrl, clearBlockedUrl } = useBillingActions();

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // dados da loja na Nuvemshop para o formulário (só esta tela pede; não somem quando o app atualiza a situação)
  const [prefill, setPrefill] = useState<BillingCustomer | null>(null);
  // null = o lojista ainda não mexeu no formulário: mostra o prefill
  const [edited, setEdited] = useState<BillingCustomer | null>(null);
  const customer = edited ?? prefill ?? EMPTY_CUSTOMER;
  const [touched, setTouched] = useState<Partial<Record<CustomerField, boolean>>>({});
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  // null = ainda não escolheu: Pix nas lojas do Brasil (tarifa menor), cartão fora dele
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  // página do Stripe que o navegador não deixou abrir sozinha: a tela mostra um link
  const [manualUrl, setManualUrl] = useState<string | null>(null);

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [resuming, setResuming] = useState(false);
  // no modal de cancelar, nos 7 dias: o lojista escolheu "agora, com reembolso"
  const [refundChosen, setRefundChosen] = useState(false);
  // dados de quem paga: começam como um resumo (já preenchido com os dados da loja); "Editar" abre os campos
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [starting, setStarting] = useState(false);

  // troca de forma de pagamento: para onde (modal aberto) e de onde (para o aviso quando a troca concluir)
  const [switchTarget, setSwitchTarget] = useState<PaymentMethod | null>(null);
  const [switching, setSwitching] = useState(false);
  const switchingFrom = useRef<PaymentMethod | null>(null);

  const [editing, setEditing] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editData, setEditData] = useState<BillingCustomer>(EMPTY_CUSTOMER);
  const [editTouched, setEditTouched] = useState<Partial<Record<CustomerField, boolean>>>({});
  const [editErrors, setEditErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  // abrir o modal de novo antes de a busca anterior voltar: a resposta velha é ignorada
  const editRequest = useRef(0);

  const brazil = billing?.pixAvailable ?? true;
  const chosen: PaymentMethod = method ?? (brazil ? "pix" : "card");

  /** Busca a situação com os dados do formulário; `sync` confere o checkout e as faturas no Stripe antes. */
  const reload = useCallback(
    async (sync = false) => {
      const next = await refresh({ prefill: true, sync });
      if (next?.prefill) setPrefill(next.prefill);
      return next;
    },
    [refresh],
  );

  // sempre mostra a situação atual ao abrir a tela (conferindo no Stripe: o lojista pode estar voltando de lá)
  const load = useCallback(async () => {
    const next = await reload(true);
    setFailed(next === null);
    setLoading(false);
  }, [reload]);

  useEffect(() => {
    load();
  }, [load]);

  // botão "voltar" no header do admin só quando o app está liberado (bloqueado, as outras telas trazem para cá)
  const allowed = (billing?.allowed ?? true) && !trialNotStarted(billing);
  useEffect(() => {
    if (!allowed) return;
    navigateHeader(nexo, { goTo: "/", text: t("billing.backLink") });
    return () => navigateHeaderRemove(nexo);
  }, [allowed, t]);

  // o pagamento chegou enquanto a tela esperava a aba do Stripe: avisa uma vez
  const wasPending = useRef(false);
  useEffect(() => {
    if (pending) {
      wasPending.current = true;
      return;
    }
    if (wasPending.current && billing?.subscribed && !hasOpenInvoice(billing)) {
      setManualUrl(null);
      clearBlockedUrl();
      const switched = switchingFrom.current !== null && billing.paymentMethod !== switchingFrom.current;
      const text = switched
        ? t(billing.paymentMethod === "pix" ? "billing.toast.switchedToPix" : "billing.toast.switchedToCard")
        : t("billing.toast.paid");
      addToast({ id: "billing-paid", type: "success", text, duration: 8000 });
      switchingFrom.current = null;
    }
    wasPending.current = false;
  }, [pending, billing, addToast, clearBlockedUrl, t]);

  // a assinatura sumiu (cancelada em outra aba): o modal de cancelar não faz mais sentido
  const showCancel = confirmCancel && (billing?.subscribed ?? false);

  /** Depois de um erro, a situação pode ter mudado (POST processado, outra aba): busca de novo. */
  const recoverAfter = (err: unknown) => {
    reload(true);
    if (err instanceof ApiRequestError && err.code === "billing_busy") setTimeout(() => reload(true), BUSY_RETRY_MS);
  };

  const resetForm = () => {
    setEdited(null);
    setTouched({});
    setFieldErrors({});
  };

  const refreshNow = async () => {
    setRefreshing(true);
    // acabou de pagar: confere direto no Stripe (não depende do webhook)
    const next = await reload(true);
    setRefreshing(false);
    addToast(
      next
        ? { id: "billing-refreshed", type: "success", text: t("billing.toast.refreshed"), duration: 4000 }
        : { id: "billing-refresh-error", type: "danger", text: t("billing.toast.refreshError"), duration: 8000 },
    );
  };

  const subscribe = async () => {
    setTouched(ALL_TOUCHED);
    if (!customerIsValid(customer)) return;
    // a aba abre já no clique: depois da resposta da API o navegador bloquearia
    const tab = openPendingTab(t("billing.openingStripe"));
    setSubscribing(true);
    setFieldErrors({});
    setManualUrl(null);
    try {
      const body = {
        ...customer,
        cpfCnpj: "",
        method: chosen,
        locale: i18n.language,
      };
      const { paymentUrl, ...next } = await api<SubscribeResult>("/api/billing/subscribe", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setBilling(next);
      resetForm();
      if (paymentUrl) {
        if (!tab.go(paymentUrl)) setManualUrl(paymentUrl);
        watchPayment();
      } else {
        tab.close();
        // Pix no teste grátis: a primeira fatura só sai no fim dele
        if (next.subscribed && next.paymentMethod === "pix") {
          addToast({
            id: "billing-subscribed",
            type: "success",
            text: t("billing.toast.subscribedPixLater", {
              date: formatDate(firstChargeOn(next, today) ?? next.trialEndsOn),
            }),
            duration: 16000,
          });
        }
      }
    } catch (err) {
      tab.close();
      setFieldErrors(fieldErrorsOf(err));
      addToast({
        id: "billing-subscribe-error",
        type: "danger",
        text: apiErrorMessage(err, i18n, "billing.toast.subscribeError"),
        duration: 8000,
      });
      recoverAfter(err);
    } finally {
      setSubscribing(false);
    }
  };

  /** Boas-vindas: começa o teste grátis de 7 dias e volta para a tela de preços. */
  const startTrial = async () => {
    setStarting(true);
    try {
      const next = await api<Billing>("/api/billing/trial", { method: "POST" });
      setBilling(next);
      addToast({
        id: "billing-trial",
        type: "success",
        text: t("billing.toast.trialStarted", { date: formatDate(next.trialEndsOn) }),
        duration: 8000,
      });
      navigate("/");
    } catch (err) {
      addToast({
        id: "billing-trial-error",
        type: "danger",
        text: apiErrorMessage(err, i18n, "billing.toast.trialError"),
        duration: 8000,
      });
      reload();
    } finally {
      setStarting(false);
    }
  };

  /**
   * Troca Pix ↔ cartão. Cartão: abre o Checkout do Stripe (a assinatura do Pix só sai quando ele for concluído).
   * Pix: a troca acontece na hora; se já há o que pagar (em atraso), abre a fatura do Pix.
   */
  const switchMethod = async (b: Billing, target: PaymentMethod) => {
    const tab = openPendingTab(t("billing.openingStripe"));
    setSwitching(true);
    setManualUrl(null);
    const from = b.paymentMethod;
    try {
      const { paymentUrl, ...next } = await api<SubscribeResult>("/api/billing/switch", {
        method: "POST",
        body: JSON.stringify({ method: target, locale: i18n.language }),
      });
      setBilling(next);
      setSwitchTarget(null);
      if (paymentUrl) {
        switchingFrom.current = from;
        if (!tab.go(paymentUrl)) setManualUrl(paymentUrl);
        watchPayment();
      } else {
        tab.close();
        if (next.paymentMethod === target) {
          addToast({
            id: "billing-switched",
            type: "success",
            text: t(target === "pix" ? "billing.toast.switchedToPix" : "billing.toast.switchedToCard"),
            duration: 8000,
          });
        }
      }
    } catch (err) {
      tab.close();
      addToast({
        id: "billing-switch-error",
        type: "danger",
        text: apiErrorMessage(err, i18n, "billing.toast.switchError"),
        duration: 8000,
      });
      recoverAfter(err);
    } finally {
      setSwitching(false);
    }
  };

  /** Texto do modal de troca: quando a nova forma começa a cobrar. */
  const switchText = (b: Billing, target: PaymentMethod) => {
    const first = firstChargeOn(b, today);
    if (target === "pix")
      return first ? t("billing.switch.textToPix", { date: formatDate(first) }) : t("billing.switch.textToPixNow");
    return first ? t("billing.switch.textToCard", { date: formatDate(first) }) : t("billing.switch.textToCardNow");
  };

  /** Desfaz o cancelamento agendado: a assinatura volta a renovar. */
  const resume = async () => {
    setResuming(true);
    try {
      setBilling(await api<Billing>("/api/billing/resume", { method: "POST" }));
      addToast({ id: "billing-resumed", type: "success", text: t("billing.toast.resumed"), duration: 8000 });
    } catch (err) {
      addToast({
        id: "billing-resume-error",
        type: "danger",
        text: apiErrorMessage(err, i18n, "billing.toast.resumeError"),
        duration: 8000,
      });
      recoverAfter(err);
    } finally {
      setResuming(false);
    }
  };

  /** `refund`: cancela agora e devolve o valor pago (só nos 7 dias depois do primeiro pagamento). */
  const cancel = async (refund = false) => {
    setCanceling(true);
    try {
      const next = await api<Billing>("/api/billing/cancel", { method: "POST", body: JSON.stringify({ refund }) });
      setBilling(next);
      setConfirmCancel(false);
      resetForm();
      const text = refund
        ? t("billing.toast.refunded")
        : next.cancelAtPeriodEnd
          ? t("billing.toast.canceledAtEnd", { date: formatDate(next.paidUntil) })
          : t("billing.toast.canceled");
      addToast({ id: "billing-canceled", type: "success", text, duration: 8000 });
    } catch (err) {
      addToast({
        id: "billing-cancel-error",
        type: "danger",
        text: apiErrorMessage(err, i18n, "billing.toast.cancelError"),
        duration: 8000,
      });
      recoverAfter(err);
    } finally {
      setCanceling(false);
    }
  };

  const openEdit = async () => {
    const request = ++editRequest.current;
    setEditing(true);
    setEditLoading(true);
    setEditTouched({});
    setEditErrors({});
    try {
      const data = await api<BillingCustomer>("/api/billing/customer");
      if (request === editRequest.current) setEditData(data);
    } catch (err) {
      if (request !== editRequest.current) return;
      setEditing(false);
      addToast({
        id: "billing-customer-error",
        type: "danger",
        text: apiErrorMessage(err, i18n, "billing.toast.customerError"),
        duration: 8000,
      });
    } finally {
      if (request === editRequest.current) setEditLoading(false);
    }
  };

  const closeEdit = () => {
    editRequest.current++;
    setEditing(false);
  };

  const saveEdit = async () => {
    setEditTouched(ALL_TOUCHED);
    if (!customerIsValid(editData)) return;
    setSaving(true);
    setEditErrors({});
    try {
      // sem nota fiscal: o documento não vai (e sai da fatura de quem tinha um)
      const body = { ...editData, cpfCnpj: "", locale: i18n.language };
      await api<BillingCustomer>("/api/billing/customer", { method: "PUT", body: JSON.stringify(body) });
      closeEdit();
      // o formulário de assinar de novo usa os dados corrigidos, não os antigos
      setEdited(null);
      setPrefill(editData);
      addToast({
        id: "billing-customer-saved",
        type: "success",
        text: t("billing.toast.customerSaved"),
        duration: 4000,
      });
    } catch (err) {
      setEditErrors(fieldErrorsOf(err));
      addToast({
        id: "billing-customer-error",
        type: "danger",
        text: apiErrorMessage(err, i18n, "billing.toast.customerError"),
        duration: 8000,
      });
    } finally {
      setSaving(false);
    }
  };

  /** Texto do modal de cancelar, conforme o que acontece com o atacado. */
  const cancelText = (b: Billing) => {
    if (subscribedNotRequired(b)) return t("billing.cancel.textNotRequired");
    if (b.status === "active") return t("billing.cancel.textAtEnd", { date: formatDate(b.paidUntil) });
    if (b.status === "trialing") return t("billing.cancel.text", { date: formatDate(accessUntil(b)) });
    if (b.status === "past_due") return t("billing.cancel.textNow");
    return t("billing.cancel.textPaused");
  };

  /** Link para a fatura em aberto: abre a página do Stripe numa nova aba e passa a conferir o pagamento. */
  const invoiceButton = (url: string, appearance: "primary" | "neutral") => (
    <Button
      as="a"
      appearance={appearance}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => {
        watchPayment();
        openExternal(url)(event);
      }}
    >
      <ExternalLinkIcon />
      {t("billing.payInvoice")}
    </Button>
  );

  /** Boas-vindas (estado inicial): o teste grátis começa no clique; não pede cartão nem Pix. */
  const renderWelcome = (b: Billing) => (
    <EmptyMessage
      icon={<GiftBoxIcon size={32} />}
      title={t("billing.welcome.title")}
      text={t("billing.welcome.text", { price: formatBRL(b.price) })}
      actions={
        <Button appearance="primary" disabled={starting} onClick={startTrial}>
          {starting && <Spinner size="small" />}
          {t("billing.welcome.start")}
        </Button>
      }
    />
  );

  /** Cartão recusado: pagar a fatura com outro cartão (página do Stripe), trocar o cartão ou passar para o Pix. */
  const renderDeclined = (b: Billing) => {
    const text = b.pixAvailable ? t("billing.declined.text") : t("billing.declined.textNoPix");
    const deadline = invoiceDeadline(b);
    return (
      <Alert appearance="danger" title={t("billing.declined.title")}>
        <Box display="flex" flexDirection="column" gap="2" alignItems="flex-start">
          <Text>
            {text}
            {deadline ? ` ${t("billing.declined.until", { date: formatDate(deadline) })}` : ""}
          </Text>
          <Box display="flex" gap="2" flexWrap="wrap">
            {b.invoiceUrl && (
              <Button
                as="a"
                appearance="primary"
                href={b.invoiceUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => {
                  watchPayment();
                  openExternal(b.invoiceUrl!)(event);
                }}
              >
                <ExternalLinkIcon />
                {t("billing.declined.otherCard")}
              </Button>
            )}
            <Button appearance="neutral" disabled={portalBusy} onClick={() => openPortal({ watch: true })}>
              {portalBusy ? <Spinner size="small" /> : <ExternalLinkIcon />}
              {t("billing.manageCard")}
            </Button>
            {b.pixAvailable && (
              <Button appearance="neutral" disabled={switching} onClick={() => switchMethod(b, "pix")}>
                {switching ? <Spinner size="small" /> : <ArrowsHorizontalIcon />}
                {t("billing.declined.pix")}
              </Button>
            )}
          </Box>
        </Box>
      </Alert>
    );
  };

  /** Aguardando o pagamento na aba do Stripe (checkout aberto ou fatura sendo paga). */
  const renderWaiting = (b: Billing) => {
    const url = manualUrl ?? blockedUrl;
    const pix = (b.paymentMethod ?? chosen) === "pix" && !b.checkoutPending;
    return (
      <Alert appearance="primary" title={t("billing.wait.title")}>
        <Box display="flex" flexDirection="column" gap="2" alignItems="flex-start">
          <Text>{pix ? t("billing.wait.pixText") : t("billing.wait.text")}</Text>
          {url && (
            <Text>
              {t("billing.wait.blocked")}{" "}
              <Link as="a" href={url} target="_blank" rel="noopener noreferrer" onClick={openExternal(url)}>
                {t("billing.openStripe")} <ExternalLinkIcon size={12} />
              </Link>
            </Text>
          )}
          <Button appearance="neutral" disabled={checking} onClick={checkPayment}>
            {checking ? <Spinner size="small" /> : <RedoIcon />}
            {t("billing.wait.check")}
          </Button>
        </Box>
      </Alert>
    );
  };

  /**
   * Linha do tempo da cobrança, como no protótipo: quando e quanto será cobrado. Aparece para quem ainda não assinou
   * e para quem assinou no teste grátis (a primeira cobrança ainda não aconteceu).
   */
  const renderSteps = (b: Billing) => {
    const first = firstChargeOn(b, today);
    if (b.subscribed && !(b.status === "trialing" && first)) return null;
    const price = formatBRL(b.price);
    const charge = !b.subscribed
      ? t("billing.how.firstChargeText", { price })
      : methodOf(b) === "card"
        ? t("billing.steps.chargeCard", { price })
        : t("billing.steps.chargePix", { price });
    const steps = first
      ? [
          { title: t("billing.how.todayFree"), text: t("billing.how.todayFreeText", { date: formatDate(first) }) },
          { title: t("billing.how.firstCharge", { date: formatDate(first) }), text: charge },
          { title: t("billing.how.monthly"), text: t("billing.how.monthlyText") },
        ]
      : [
          { title: t("billing.how.todayPaid"), text: t("billing.how.todayPaidText", { price }) },
          { title: t("billing.how.monthly"), text: t("billing.how.monthlyText") },
          { title: t("billing.how.refund"), text: t("billing.how.refundText") },
        ];
    return (
      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "1fr 1fr 1fr" }} gridGap="3">
        {steps.map((step, i) => (
          <Card key={step.title} padding="small">
            <Box display="flex" flexDirection="column" gap="1">
              <Box
                width="1.5rem"
                height="1.5rem"
                borderRadius="6"
                display="flex"
                alignItems="center"
                justifyContent="center"
                backgroundColor={i === 0 ? "primary-interactive" : "primary-surface"}
              >
                <Text fontSize="caption" fontWeight="bold" color={i === 0 ? "neutral-background" : "primary-textLow"}>
                  {String(i + 1)}
                </Text>
              </Box>
              <Text fontWeight="bold">{step.title}</Text>
              <Text fontSize="caption" color="neutral-textLow">
                {step.text}
              </Text>
            </Box>
          </Card>
        ))}
      </Box>
    );
  };

  /** Quem não assinou e não está no teste: cancelada (ainda no período pago), pausada ou encerrada. */
  const renderStatus = (b: Billing) => {
    if (b.status === "trialing") return null;
    const info = billingStatusInfo(b, i18n, today);
    return (
      <Alert appearance={b.status === "blocked" || b.status === "closed" ? "danger" : "warning"} title={info.label}>
        <Box display="flex" flexDirection="column" gap="1">
          <Text>{info.text}</Text>
          {b.status === "blocked" && b.closesOn && (
            <Text>{t("billing.text.closesOn", { date: formatDate(b.closesOn) })}</Text>
          )}
        </Box>
      </Alert>
    );
  };

  /** Uma linha de detalhe: rótulo à esquerda, valor (e o atalho, se houver) à direita. */
  const detailRow = (label: string, value: ReactNode, first = false) => (
    <Box
      display="flex"
      justifyContent="space-between"
      alignItems="baseline"
      gap="2"
      flexWrap="wrap"
      paddingY="3"
      borderStyle="solid"
      borderColor="neutral-surfaceHighlight"
      borderWidth="none"
      borderTopWidth={first ? "none" : "1"}
    >
      <Text color="neutral-textLow">{label}</Text>
      <Box display="flex" gap="1" alignItems="baseline" flexWrap="wrap" justifyContent="flex-end">
        {value}
      </Box>
    </Box>
  );

  /** Atalho dentro da linha ("· trocar para cartão"). */
  const rowLink = (
    text: string,
    onClick: () => void,
    appearance: "primary" | "danger" = "primary",
    separator = true,
  ) => (
    <>
      {separator && <Text color="neutral-textLow">·</Text>}
      <Link as="button" appearance={appearance} textDecoration="none" onClick={onClick}>
        {text}
      </Link>
    </>
  );

  /** Assinatura: o aviso de cancelada (com "Manter assinatura"), os detalhes e as ações. */
  const renderSubscription = (b: Billing) => {
    // cobrança não exigida (desligada ou isenta): a ação é cancelar, não pagar nem conferir pagamento
    const notRequired = subscribedNotRequired(b);
    const card = methodOf(b) === "card";
    const next = nextChargeOn(b);
    const canPay = Boolean(b.invoiceUrl) && !notRequired;
    // cartão recusado: o aviso acima já tem a ação primária (uma por tela)
    const declined = b.cardDeclined && !notRequired;
    // cancelada, terminando no fim do período: a única troca possível é manter a assinatura. Com o checkout da troca
    // aberto, o atalho reabre o mesmo checkout (a API reaproveita): desistiu, não fica preso
    const switchTo: PaymentMethod | null =
      notRequired || b.cancelAtPeriodEnd ? null : card ? (b.pixAvailable ? "pix" : null) : "card";
    // "Atualizar situação" só quando há o que esperar: fatura em aberto ou checkout da troca
    const waiting = !notRequired && (canPay || b.checkoutPending);
    const deadline = invoiceDeadline(b);
    return (
      <Box display="flex" flexDirection="column" gap="4">
        {b.cancelAtPeriodEnd && (
          <Alert appearance="warning" title={t("billing.canceling.title", { date: formatDate(b.paidUntil) })}>
            <Box display="flex" flexDirection="column" gap="2" alignItems="flex-start">
              <Text>{t("billing.canceling.text")}</Text>
              <Button appearance="primary" disabled={resuming} onClick={resume}>
                {resuming && <Spinner size="small" />}
                {t("billing.resumeAction")}
              </Button>
            </Box>
          </Alert>
        )}
        {notRequired && <Alert appearance="warning">{billingStatusInfo(b, i18n, today).text}</Alert>}
        <Card>
          <Card.Body>
            <Box display="flex" flexDirection="column">
              {detailRow(
                t("billing.manage.plan"),
                <Text fontWeight="bold">{t("billing.plan.name", { price: formatBRL(b.price) })}</Text>,
                true,
              )}
              {detailRow(
                t("billing.manage.method"),
                <>
                  <Text fontWeight="bold">{card ? t("billing.manage.methodCard") : t("billing.manage.methodPix")}</Text>
                  {switchTo &&
                    !switching &&
                    rowLink(switchTo === "pix" ? t("billing.manage.toPix") : t("billing.manage.toCard"), () =>
                      setSwitchTarget(switchTo),
                    )}
                </>,
              )}
              {canPay &&
                detailRow(
                  t("billing.manage.invoiceOpen"),
                  <Text fontWeight="bold">
                    {deadline
                      ? t("billing.manage.invoiceDue", { price: formatBRL(b.price), date: formatDate(deadline) })
                      : formatBRL(b.price)}
                  </Text>,
                )}
              {!canPay &&
                next &&
                !notRequired &&
                detailRow(t("billing.manage.nextCharge"), <Text fontWeight="bold">{formatDate(next)}</Text>)}
              {b.cancelAtPeriodEnd &&
                b.paidUntil &&
                detailRow(t("billing.manage.paidUntil"), <Text fontWeight="bold">{formatDate(b.paidUntil)}</Text>)}
              {detailRow(
                t("billing.manage.customer"),
                <Link as="button" appearance="primary" textDecoration="none" onClick={openEdit}>
                  {t("billing.manage.customerLink")}
                </Link>,
              )}
              {b.refundableUntil &&
                !notRequired &&
                detailRow(
                  t("billing.manage.refund"),
                  <>
                    <Text>{t("billing.manage.refundUntil", { date: formatDate(b.refundableUntil) })}</Text>
                    {rowLink(
                      t("billing.manage.refundLink", { price: formatBRL(b.price) }),
                      () => {
                        setRefundChosen(true);
                        setConfirmCancel(true);
                      },
                      "danger",
                    )}
                  </>,
                )}
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                gap="3"
                flexWrap="wrap"
                paddingTop="3"
              >
                <Box display="flex" gap="2" flexWrap="wrap">
                  {canPay && !declined && invoiceButton(b.invoiceUrl!, "primary")}
                  {card && !notRequired && !declined && (
                    <Button appearance="neutral" disabled={portalBusy} onClick={() => openPortal({ watch: canPay })}>
                      {portalBusy ? <Spinner size="small" /> : <ExternalLinkIcon />}
                      {t("billing.manage.portal")}
                    </Button>
                  )}
                  {waiting && (
                    <Button appearance="neutral" disabled={refreshing} onClick={refreshNow}>
                      {refreshing ? <Spinner size="small" /> : <RedoIcon />}
                      {t("billing.refresh")}
                    </Button>
                  )}
                </Box>
                {/* cancelada: o reembolso fica na linha "Reembolso" acima; cancelar é a ação mais discreta */}
                {!b.cancelAtPeriodEnd && (
                  <Link
                    as="button"
                    appearance="danger"
                    textDecoration="none"
                    onClick={() => {
                      setRefundChosen(false);
                      setConfirmCancel(true);
                    }}
                  >
                    {t("billing.cancelAction")}
                  </Link>
                )}
              </Box>
            </Box>
          </Card.Body>
        </Card>
      </Box>
    );
  };

  /** Assinar: forma de pagamento (Pix só no Brasil), quem paga e o botão com o valor e a data. */
  const renderForm = (b: Billing) => {
    const first = firstChargeOn(b, today);
    const price = formatBRL(b.price);
    const cta = first
      ? t(chosen === "card" ? "billing.form.ctaCardLater" : "billing.form.ctaPixLater", {
          price,
          date: formatDate(first),
        })
      : t(chosen === "card" ? "billing.form.ctaCardNow" : "billing.form.ctaPixNow", { price });
    // o resumo só vale com os dados completos e sem campo recusado pela API
    const showFields =
      editingCustomer || !customerIsValid(customer) || Object.keys(fieldErrors).length > 0;
    return (
      <Card>
        <Card.Header title={b.status === "closed" ? t("billing.restart") : t("billing.method.title")} />
        <Card.Body>
          <Box display="flex" flexDirection="column" gap="4">
            <InteractiveList>
              <InteractiveList.RadioItem
                title={t("billing.method.pix")}
                description={b.pixAvailable ? t("billing.method.pixText") : t("billing.method.pixAbroad")}
                radio={{
                  name: "billing-method",
                  value: "pix",
                  checked: chosen === "pix",
                  disabled: !b.pixAvailable,
                  onChange: () => setMethod("pix"),
                }}
              />
              <InteractiveList.RadioItem
                title={t("billing.method.card")}
                description={t("billing.method.cardText")}
                radio={{
                  name: "billing-method",
                  value: "card",
                  checked: chosen === "card",
                  onChange: () => setMethod("card"),
                }}
              />
            </InteractiveList>
            {!showFields &&
              detailRow(
                t("billing.form.payerLabel"),
                <>
                  <Text fontWeight="bold">{customer.name}</Text>
                  <Text color="neutral-textLow">·</Text>
                  <Text>{customer.email}</Text>
                  {rowLink(t("billing.form.customerEdit"), () => setEditingCustomer(true))}
                </>,
              )}
            {showFields && (
              <Box display="flex" flexDirection="column" gap="2">
                <Text fontWeight="bold">{t("billing.form.customerTitle")}</Text>
                <BillingCustomerFields
                  idPrefix="billing"
                  value={customer}
                  onChange={(c) => {
                    setEdited(c);
                    setFieldErrors({});
                  }}
                  fieldErrors={fieldErrors}
                  touched={touched}
                  onTouch={(f) => setTouched((prev) => ({ ...prev, [f]: true }))}
                />
              </Box>
            )}
            <Box display="flex" flexDirection="column" gap="2" alignItems="flex-start">
              <Button appearance="primary" disabled={subscribing} onClick={subscribe}>
                {subscribing ? (
                  <Spinner size="small" />
                ) : chosen === "card" ? (
                  <ExternalLinkIcon />
                ) : (
                  <CheckCircleIcon />
                )}
                {cta}
              </Button>
              <Text fontSize="caption" color="neutral-textLow">
                {first
                  ? t("billing.form.noteLater", { price, date: formatDate(first) })
                  : t("billing.form.noteNow", { price })}
              </Text>
            </Box>
          </Box>
        </Card.Body>
      </Card>
    );
  };

  const renderHistory = (b: Billing) => (
    <Card>
      <Card.Header title={t("billing.history.title")} />
      <Card.Body>
        <DataList>
          {b.payments.map((p) => {
            const tag = PAYMENT_TAG[p.status] ?? PAYMENT_TAG.other;
            const method =
              p.method === "pix"
                ? t("billing.history.methodPix")
                : p.method === "card"
                  ? t("billing.history.methodCard")
                  : null;
            return (
              <DataList.Row key={p.id}>
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  gap="2"
                  width="100%"
                  flexWrap="wrap"
                >
                  <Box display="flex" flexDirection="column" gap="1">
                    <Text fontWeight="bold">{t("billing.history.due", { date: formatDate(p.dueDate) })}</Text>
                    <Text fontSize="caption">
                      {formatBRL(p.value)}
                      {method ? ` · ${method}` : ""}
                      {p.paidOn ? ` · ${t("billing.history.paidOn", { date: formatDate(p.paidOn) })}` : ""}
                    </Text>
                  </Box>
                  <Box display="flex" gap="2" alignItems="center">
                    <Tag appearance={tag.appearance}>{t(tag.key)}</Tag>
                    {p.invoiceUrl && (
                      <Link
                        as="a"
                        href={p.invoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={openExternal(p.invoiceUrl)}
                      >
                        {t("billing.history.invoice")} <ExternalLinkIcon size={12} />
                      </Link>
                    )}
                  </Box>
                </Box>
              </DataList.Row>
            );
          })}
        </DataList>
      </Card.Body>
    </Card>
  );

  const renderBody = () => {
    if (loading && !billing) {
      return (
        <Box display="flex" flexDirection="column" gap="4">
          <Skeleton width="100%" height="10rem" />
          <Skeleton width="100%" height="16rem" />
        </Box>
      );
    }
    if (failed && !billing) {
      return (
        <ErrorState
          onRetry={() => {
            setLoading(true);
            load();
          }}
        />
      );
    }
    if (billing && trialNotStarted(billing)) return renderWelcome(billing);
    if (!billingManageable(billing)) {
      return (
        <EmptyMessage
          icon={<CheckCircleIcon size={32} />}
          title={t("billing.notRequired.title")}
          text={t("billing.notRequired.text")}
          actions={
            <Button appearance="neutral" onClick={() => navigate("/")}>
              {t("billing.notRequired.action")}
            </Button>
          }
        />
      );
    }
    return (
      <Box display="flex" flexDirection="column" gap="4">
        {pending && renderWaiting(billing)}
        {!pending &&
          billing.subscribed &&
          billing.cardDeclined &&
          !subscribedNotRequired(billing) &&
          renderDeclined(billing)}
        {!billing.subscribed && renderStatus(billing)}
        {renderSteps(billing)}
        {/* o formulário fica mesmo com o checkout aberto: fechou a aba do Stripe sem pagar, abre de novo (o mesmo
            checkout) ou escolhe o Pix */}
        {billing.subscribed ? renderSubscription(billing) : renderForm(billing)}
        {billing.payments.length > 0 && renderHistory(billing)}
        <Text>
          {t("billing.support")}{" "}
          <Link as="a" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </Link>
        </Text>
      </Box>
    );
  };

  /** Etiqueta do cabeçalho: a situação e a data que importa ("Teste grátis · faltam 5 dias"). */
  const headerTag = (b: Billing) => {
    const info = billingStatusInfo(b, i18n, today);
    let suffix: string | null = null;
    if (b.status === "trialing" && b.trialEndsOn) {
      const days = daysBetween(today, b.trialEndsOn);
      if (b.subscribed) suffix = t("billing.tag.firstCharge", { date: formatDate(b.trialEndsOn) });
      else if (days !== null) suffix = days <= 0 ? t("billing.tag.endsToday") : tp("billing.tag.daysLeft", days);
    } else if (b.status === "active" && b.paidUntil) {
      suffix =
        b.subscribed && !b.cancelAtPeriodEnd
          ? t("billing.tag.renews", { date: formatDate(b.paidUntil) })
          : t("billing.tag.activeUntil", { date: formatDate(b.paidUntil) });
    }
    return { appearance: info.appearance, label: info.label, subtitle: suffix };
  };
  const statusTag = billingManageable(billing) && !trialNotStarted(billing) ? headerTag(billing) : null;

  return (
    <Page maxWidth="800px">
      <Page.Header title={t("billing.title")} subtitle={statusTag?.subtitle ?? undefined}>
        {statusTag && <Tag appearance={statusTag.appearance}>{statusTag.label}</Tag>}
      </Page.Header>
      <Page.Body>
        <Box display="flex" flexDirection="column" gap="4">
          {/* no app do celular o "voltar" do cabeçalho do admin (navigateHeader) não aparece */}
          {isMobileApp() && (
            <Box>
              <Link as="button" appearance="primary" textDecoration="none" onClick={() => navigate("/")}>
                <ChevronLeftIcon />
                {t("billing.backLink")}
              </Link>
            </Box>
          )}
          {renderBody()}
        </Box>
      </Page.Body>

      <Modal open={showCancel} onDismiss={() => setConfirmCancel(false)}>
        <Modal.Header title={t("billing.cancel.title")} />
        <Modal.Body>
          <Box display="flex" flexDirection="column" gap="2">
            {billing && !billing.cancelAtPeriodEnd && <Text>{cancelText(billing)}</Text>}
            {billing?.refundableUntil && (
              <InteractiveList>
                {!billing.cancelAtPeriodEnd && (
                  <InteractiveList.RadioItem
                    title={
                      billing.status === "active" ? t("billing.cancel.optionAtEnd") : t("billing.cancel.optionNow")
                    }
                    description={
                      billing.status === "active"
                        ? t("billing.cancel.optionAtEndText", { date: formatDate(billing.paidUntil) })
                        : ""
                    }
                    radio={{
                      name: "cancel-option",
                      value: "end",
                      checked: !refundChosen,
                      onChange: () => setRefundChosen(false),
                    }}
                  />
                )}
                <InteractiveList.RadioItem
                  title={t("billing.cancel.optionRefund", { price: formatBRL(billing.price) })}
                  description={t("billing.cancel.refundText", {
                    date: formatDate(billing.refundableUntil),
                    price: formatBRL(billing.price),
                  })}
                  radio={{
                    name: "cancel-option",
                    value: "refund",
                    checked: refundChosen || billing.cancelAtPeriodEnd,
                    onChange: () => setRefundChosen(true),
                  }}
                />
              </InteractiveList>
            )}
            {billing && !subscribedNotRequired(billing) && !billing.cancelAtPeriodEnd && (
              <Text>{t("billing.cancel.closeNote")}</Text>
            )}
          </Box>
        </Modal.Body>
        <Modal.Footer>
          <Button appearance="neutral" onClick={() => setConfirmCancel(false)}>
            {t("billing.cancel.keep")}
          </Button>
          <Button
            appearance="danger"
            disabled={canceling}
            onClick={() =>
              cancel(Boolean(billing?.refundableUntil) && (refundChosen || Boolean(billing?.cancelAtPeriodEnd)))
            }
          >
            {canceling && <Spinner size="small" />}
            {t("billing.cancel.confirm")}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal open={switchTarget !== null && (billing?.subscribed ?? false)} onDismiss={() => setSwitchTarget(null)}>
        <Modal.Header title={t("billing.switch.title")} />
        <Modal.Body>{billing && switchTarget && <Text>{switchText(billing, switchTarget)}</Text>}</Modal.Body>
        <Modal.Footer>
          <Button appearance="neutral" onClick={() => setSwitchTarget(null)}>
            {t("billing.switch.keep")}
          </Button>
          <Button
            appearance="primary"
            disabled={switching}
            onClick={() => billing && switchTarget && switchMethod(billing, switchTarget)}
          >
            {switching && <Spinner size="small" />}
            {t("billing.switch.confirm")}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal open={editing} onDismiss={closeEdit}>
        <Modal.Header title={t("billing.customer.title")} />
        <Modal.Body>
          {editLoading ? (
            <Skeleton width="100%" height="12rem" />
          ) : (
            <BillingCustomerFields
              idPrefix="billing-edit"
              value={editData}
              onChange={(c) => {
                setEditData(c);
                setEditErrors({});
              }}
              fieldErrors={editErrors}
              touched={editTouched}
              onTouch={(f) => setEditTouched((prev) => ({ ...prev, [f]: true }))}
            />
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button appearance="neutral" onClick={closeEdit}>
            {t("billing.customer.cancel")}
          </Button>
          <Button appearance="primary" disabled={saving || editLoading} onClick={saveEdit}>
            {saving && <Spinner size="small" />}
            {t("billing.customer.save")}
          </Button>
        </Modal.Footer>
      </Modal>
    </Page>
  );
}
