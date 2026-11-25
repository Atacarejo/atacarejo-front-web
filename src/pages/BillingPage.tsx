// Assinatura do Atacarejo: situação, assinar (dados de quem paga → fatura do Asaas numa nova aba), pagar,
// atualizar os dados de cobrança, cancelar e o histórico de mensalidades. Tudo sem falar com o suporte
// nem reinstalar o app (diretriz 3.2 da Nuvemshop).
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { navigateHeader, navigateHeaderRemove } from "@tiendanube/nexo";
import { Box, Button, Card, Link, Modal, Skeleton, Spinner, Tag, Text, useToast } from "@nimbus-ds/components";
import { DataList, EmptyMessage, Page } from "@nimbus-ds/patterns";
import { CheckCircleIcon, ExternalLinkIcon, RedoIcon } from "@nimbus-ds/icons";
import nexo from "../nexoClient";
import ErrorState, { SUPPORT_EMAIL } from "../components/ErrorState";
import BillingCustomerFields from "../components/BillingCustomerFields";
import { api, ApiRequestError, type Billing, type BillingCustomer, type BillingPayment } from "../lib/api";
import {
  accessUntil,
  billingStatusInfo,
  billingVisible,
  customerIsValid,
  fieldErrorsOf,
  hasPaidBefore,
  useBilling,
  type CustomerField,
  type FieldErrors,
} from "../lib/billing";
import { openExternal } from "../lib/external";
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
  const { t, formatDate, formatBRL } = i18n;
  const { billing, refresh, setBilling } = useBilling();

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
  const [subscribing, setSubscribing] = useState(false);

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [canceling, setCanceling] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editData, setEditData] = useState<BillingCustomer>(EMPTY_CUSTOMER);
  const [editTouched, setEditTouched] = useState<Partial<Record<CustomerField, boolean>>>({});
  const [editErrors, setEditErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  // abrir o modal de novo antes de a busca anterior voltar: a resposta velha é ignorada
  const editRequest = useRef(0);

  /** Busca a situação com os dados do formulário; `sync` confere as mensalidades no Asaas antes. */
  const reload = useCallback(async (sync = false) => {
    const next = await refresh({ prefill: true, sync });
    if (next?.prefill) setPrefill(next.prefill);
    return next;
  }, [refresh]);

  // sempre mostra a situação atual ao abrir a tela
  const load = useCallback(async () => {
    const next = await reload();
    setFailed(next === null);
    setLoading(false);
  }, [reload]);

  useEffect(() => {
    load();
  }, [load]);

  // botão "voltar" no header do admin só quando o app está liberado (bloqueado, as outras telas trazem para cá)
  const allowed = billing?.allowed ?? true;
  useEffect(() => {
    if (!allowed) return;
    navigateHeader(nexo, { goTo: "/", text: t("billing.backLink") });
    return () => navigateHeaderRemove(nexo);
  }, [allowed, t]);

  // a assinatura sumiu (cancelada em outra aba): o modal de cancelar não faz mais sentido
  const showCancel = confirmCancel && (billing?.subscribed ?? false);

  /** Depois de um erro, a situação pode ter mudado (POST processado, outra aba): busca de novo. */
  const recoverAfter = (err: unknown) => {
    reload();
    if (err instanceof ApiRequestError && err.code === "billing_busy") setTimeout(() => reload(), BUSY_RETRY_MS);
  };

  const resetForm = () => {
    setEdited(null);
    setTouched({});
    setFieldErrors({});
  };

  const refreshNow = async () => {
    setRefreshing(true);
    // acabou de pagar: confere direto no Asaas (não depende do webhook)
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
    setSubscribing(true);
    setFieldErrors({});
    try {
      setBilling(await api<Billing>("/api/billing/subscribe", { method: "POST", body: JSON.stringify(customer) }));
      resetForm();
      addToast({ id: "billing-subscribed", type: "success", text: t("billing.toast.subscribed"), duration: 8000 });
    } catch (err) {
      setFieldErrors(fieldErrorsOf(err));
      addToast({ id: "billing-subscribe-error", type: "danger", text: apiErrorMessage(err, i18n, "billing.toast.subscribeError"), duration: 8000 });
      recoverAfter(err);
    } finally {
      setSubscribing(false);
    }
  };

  const cancel = async () => {
    setCanceling(true);
    try {
      setBilling(await api<Billing>("/api/billing/cancel", { method: "POST" }));
      setConfirmCancel(false);
      resetForm();
      addToast({ id: "billing-canceled", type: "success", text: t("billing.toast.canceled"), duration: 8000 });
    } catch (err) {
      addToast({ id: "billing-cancel-error", type: "danger", text: apiErrorMessage(err, i18n, "billing.toast.cancelError"), duration: 8000 });
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
      addToast({ id: "billing-customer-error", type: "danger", text: apiErrorMessage(err, i18n, "billing.toast.customerError"), duration: 8000 });
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
      await api<BillingCustomer>("/api/billing/customer", { method: "PUT", body: JSON.stringify(editData) });
      closeEdit();
      // o formulário de assinar de novo usa os dados corrigidos, não os antigos
      setEdited(null);
      setPrefill(editData);
      addToast({ id: "billing-customer-saved", type: "success", text: t("billing.toast.customerSaved"), duration: 4000 });
    } catch (err) {
      setEditErrors(fieldErrorsOf(err));
      addToast({ id: "billing-customer-error", type: "danger", text: apiErrorMessage(err, i18n, "billing.toast.customerError"), duration: 8000 });
    } finally {
      setSaving(false);
    }
  };

  /** Texto do modal de cancelar, conforme o que acontece com o atacado. */
  const cancelText = (b: Billing) => {
    if (b.status === "trialing" || b.status === "active") return t("billing.cancel.text", { date: formatDate(accessUntil(b)) });
    if (b.status === "past_due") return t("billing.cancel.textNow");
    return t("billing.cancel.textPaused");
  };

  const renderStatus = (b: Billing) => {
    const info = billingStatusInfo(b, i18n);
    const canPay = b.subscribed && Boolean(b.invoiceUrl);
    return (
      <Card>
        <Card.Header title={t("billing.plan.title")} />
        <Card.Body>
          <Box display="flex" flexDirection="column" gap="4">
            <Box display="flex" flexDirection="column" gap="2">
              <Text fontWeight="bold">{t("billing.plan.name", { price: formatBRL(b.price) })}</Text>
              <Text>{info.text}</Text>
              {(b.status === "blocked" || b.status === "closed") && b.closesOn && (
                <Text>{t("billing.text.closesOn", { date: formatDate(b.closesOn) })}</Text>
              )}
              {canPay && <Text fontSize="caption">{t("billing.text.boleto")}</Text>}
            </Box>
            {b.subscribed && (
              <Box display="flex" gap="2" flexWrap="wrap">
                {canPay && (
                  <Button
                    as="a"
                    appearance="primary"
                    href={b.invoiceUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={openExternal(b.invoiceUrl!)}
                  >
                    <ExternalLinkIcon />
                    {t("billing.payInvoice")}
                  </Button>
                )}
                <Button appearance="neutral" disabled={refreshing} onClick={refreshNow}>
                  {refreshing ? <Spinner size="small" /> : <RedoIcon />}
                  {t("billing.refresh")}
                </Button>
                <Button appearance="neutral" onClick={openEdit}>
                  {t("billing.editCustomer")}
                </Button>
                <Button appearance="neutral" onClick={() => setConfirmCancel(true)}>
                  {t("billing.cancelAction")}
                </Button>
              </Box>
            )}
          </Box>
        </Card.Body>
      </Card>
    );
  };

  const renderForm = (b: Billing) => (
    <Card>
      <Card.Header title={t("billing.form.title")} />
      <Card.Body>
        <Box display="flex" flexDirection="column" gap="4">
          <Text>{t("billing.form.text")}</Text>
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
      </Card.Body>
      <Card.Footer>
        <Button appearance="primary" disabled={subscribing} onClick={subscribe}>
          {subscribing ? <Spinner size="small" /> : <CheckCircleIcon />}
          {hasPaidBefore(b) ? t("billing.resubscribe") : t("billing.subscribe")}
        </Button>
      </Card.Footer>
    </Card>
  );

  const renderHistory = (b: Billing) => (
    <Card>
      <Card.Header title={t("billing.history.title")} />
      <Card.Body>
        <DataList>
          {b.payments.map((p) => {
            const tag = PAYMENT_TAG[p.status] ?? PAYMENT_TAG.other;
            return (
              <DataList.Row key={p.id}>
                <Box display="flex" justifyContent="space-between" alignItems="center" gap="2" width="100%" flexWrap="wrap">
                  <Box display="flex" flexDirection="column" gap="1">
                    <Text fontWeight="bold">{t("billing.history.due", { date: formatDate(p.dueDate) })}</Text>
                    <Text fontSize="caption">
                      {formatBRL(p.value)}
                      {p.paidOn ? ` · ${t("billing.history.paidOn", { date: formatDate(p.paidOn) })}` : ""}
                    </Text>
                  </Box>
                  <Box display="flex" gap="2" alignItems="center">
                    <Tag appearance={tag.appearance}>{t(tag.key)}</Tag>
                    {p.invoiceUrl && (
                      <Link as="a" href={p.invoiceUrl} target="_blank" rel="noopener noreferrer" onClick={openExternal(p.invoiceUrl)}>
                        {t("billing.history.invoice")}
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
    if (!billingVisible(billing)) {
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
        {renderStatus(billing)}
        {!billing.subscribed && renderForm(billing)}
        {billing.payments.length > 0 && renderHistory(billing)}
        <Text>
          {t("billing.support")} <Link as="a" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</Link>
        </Text>
      </Box>
    );
  };

  const statusTag = billingVisible(billing) ? billingStatusInfo(billing, i18n) : null;

  return (
    <Page maxWidth="800px">
      <Page.Header title={t("billing.title")}>
        {statusTag && <Tag appearance={statusTag.appearance}>{statusTag.label}</Tag>}
      </Page.Header>
      <Page.Body>{renderBody()}</Page.Body>

      <Modal open={showCancel} onDismiss={() => setConfirmCancel(false)}>
        <Modal.Header title={t("billing.cancel.title")} />
        <Modal.Body>
          <Box display="flex" flexDirection="column" gap="2">
            {billing && <Text>{cancelText(billing)}</Text>}
            <Text>{t("billing.cancel.closeNote")}</Text>
          </Box>
        </Modal.Body>
        <Modal.Footer>
          <Button appearance="neutral" onClick={() => setConfirmCancel(false)}>
            {t("billing.cancel.keep")}
          </Button>
          <Button appearance="danger" disabled={canceling} onClick={cancel}>
            {canceling && <Spinner size="small" />}
            {t("billing.cancel.confirm")}
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
