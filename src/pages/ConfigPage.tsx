// Configuração da loja: quantidade mínima do atacado e modelo de exibição na vitrine, com a prévia ao lado.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { navigateHeader, navigateHeaderRemove } from "@tiendanube/nexo";
import {
  Box,
  Button,
  Card,
  Link,
  Modal,
  ProgressBar,
  Skeleton,
  Spinner,
  Tag,
  Text,
  useToast,
} from "@nimbus-ds/components";
import { FormField, InteractiveList, Page } from "@nimbus-ds/patterns";
import { ChevronLeftIcon, DisketteIcon } from "@nimbus-ds/icons";
import nexo from "../nexoClient";
import ErrorState from "../components/ErrorState";
import { api, type StoreConfig } from "../lib/api";
import { billingManageable, billingStatusInfo, useBilling } from "../lib/billing";
import { DESIGN_OPTIONS } from "../lib/design-options";
import { isMobileApp } from "../lib/external";
import { apiErrorMessage, useI18n } from "../i18n";

const MIN = 1;
const MAX = 999;

export default function ConfigPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const i18n = useI18n();
  const { t, tp } = i18n;
  const [value, setValue] = useState("");
  const [savedValue, setSavedValue] = useState("");
  const [design, setDesign] = useState(DESIGN_OPTIONS[0].value);
  const [savedDesign, setSavedDesign] = useState(DESIGN_OPTIONS[0].value);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const { billing, today } = useBilling();
  // destino de uma saída parada pelo aviso "Sair sem salvar?" (null = aviso fechado)
  const [leaveTo, setLeaveTo] = useState<string | null>(null);

  // botão "voltar" no header do admin
  useEffect(() => {
    navigateHeader(nexo, { goTo: "/", text: t("config.backLink") });
    return () => navigateHeaderRemove(nexo);
  }, [t]);

  const load = () => {
    api<StoreConfig>("/api/config")
      .then((c) => {
        setValue(String(c.minQuantity));
        setSavedValue(String(c.minQuantity));
        setDesign(c.designOption);
        setSavedDesign(c.designOption);
      })
      .then(
        () => setFailed(false),
        () => setFailed(true),
      )
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const retry = () => {
    setLoading(true);
    setFailed(false);
    load();
  };

  const n = Number(value);
  const valid = /^\d+$/.test(value) && n >= MIN && n <= MAX;
  const dirty = value !== savedValue || design !== savedDesign;
  const leave = (path: string) => (dirty ? setLeaveTo(path) : navigate(path));

  const save = async () => {
    setSaving(true);
    try {
      const c = await api<StoreConfig>("/api/config", {
        method: "PUT",
        body: JSON.stringify({ minQuantity: n, designOption: design }),
      });
      setSavedValue(String(c.minQuantity));
      setSavedDesign(c.designOption);
      addToast({ id: "config-saved", type: "success", text: t("config.toast.saved"), duration: 4000 });
      navigate("/");
    } catch (err) {
      addToast({
        id: "config-error",
        type: "danger",
        text: apiErrorMessage(err, i18n, "config.toast.saveError"),
        duration: 8000,
      });
    } finally {
      setSaving(false);
    }
  };

  /**
   * Prévia com os mesmos textos da vitrine (atacarejo-store-front/src/core/messages.ts) e um produto de exemplo:
   * a página do produto e o aviso do carrinho com uma unidade a menos que a quantidade mínima.
   */
  const renderPreview = () => {
    const need = valid ? n : Number(savedValue) || 3;
    const have = Math.max(0, need - 1);
    return (
      <Box display="flex" flexDirection="column" gap="4">
        <Box display="flex" flexDirection="column" gap="2">
          <Text fontSize="caption" color="neutral-textLow">
            {t("config.preview.product")}
          </Text>
          <Box
            display="flex"
            flexDirection="column"
            gap="1"
            padding="3"
            borderRadius="2"
            backgroundColor="neutral-surface"
          >
            <Text>{t("config.preview.example")}</Text>
            <Text fontWeight="bold" fontSize="highlight">
              {i18n.formatMoney("49.90")}
            </Text>
            <Box display="flex" flexDirection="column" gap="1" paddingTop="1">
              <Text fontWeight="bold" color="success-textLow">
                {t("config.preview.productTitle")}
              </Text>
              <Text>{t("config.preview.productPrice", { price: i18n.formatMoney("39.90") })}</Text>
              <Text fontSize="caption" color="neutral-textLow">
                {tp("config.preview.productHint", need)}
              </Text>
            </Box>
          </Box>
        </Box>
        {need > 1 && (
          <Box display="flex" flexDirection="column" gap="2">
            <Text fontSize="caption" color="neutral-textLow">
              {t("config.preview.cart")}
            </Text>
            <Box
              display="flex"
              flexDirection="column"
              gap="2"
              padding="3"
              borderRadius="2"
              backgroundColor="neutral-surface"
            >
              <Text fontWeight="bold">{tp("config.preview.cartMissing", need - have)}</Text>
              <ProgressBar value={Math.round((have / need) * 100)} appearance="success" />
              <Text fontSize="caption" color="neutral-textLow">
                {tp("config.preview.cartProgress", need, { have })}
              </Text>
            </Box>
          </Box>
        )}
        <Text fontSize="caption" color="neutral-textLow">
          {t("config.preview.note", { regular: i18n.formatMoney("49.90"), wholesale: i18n.formatMoney("39.90") })}
        </Text>
      </Box>
    );
  };

  return (
    <Page maxWidth="1200px">
      <Page.Header
        title={t("config.title")}
        buttonStack={
          <Button appearance="primary" disabled={!valid || !dirty || saving || loading} onClick={save}>
            {saving ? <Spinner size="small" /> : <DisketteIcon />}
            {t("config.save")}
          </Button>
        }
      />
      <Page.Body>
        {isMobileApp() && (
          <Box paddingBottom="4">
            <Link as="button" appearance="primary" textDecoration="none" onClick={() => leave("/")}>
              <ChevronLeftIcon />
              {t("config.backLink")}
            </Link>
          </Box>
        )}
        {failed ? (
          // "Salvar" já é a ação primária da página
          <ErrorState onRetry={retry} primary={false} />
        ) : (
          <Box display="flex" flexDirection="column" gap="4">
            <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "1fr 1fr" }} gridGap="4" alignItems="flex-start">
              <Card>
                <Card.Header title={t("config.minQuantity.title")} />
                <Card.Body>
                  <Box display="flex" flexDirection="column" gap="4">
                    <Text>{t("config.minQuantity.text")}</Text>
                    {loading ? (
                      <Skeleton width="100%" height="4rem" />
                    ) : (
                      <Box maxWidth="12rem">
                        <FormField.Input
                          id="min-quantity"
                          label={t("config.minQuantity.label")}
                          type="number"
                          inputMode="numeric"
                          min={MIN}
                          max={MAX}
                          value={value}
                          onChange={(e) => setValue((e.target as HTMLInputElement).value)}
                          appearance={valid ? "none" : "danger"}
                          helpText={
                            valid
                              ? t("config.minQuantity.help")
                              : t("config.minQuantity.invalid", { min: MIN, max: MAX })
                          }
                          showHelpText
                        />
                      </Box>
                    )}
                    {DESIGN_OPTIONS.length > 1 && (
                      <Box display="flex" flexDirection="column" gap="2">
                        <Text fontWeight="bold">{t("config.design.title")}</Text>
                        <Text>{t("config.design.text")}</Text>
                        {loading ? (
                          <Skeleton width="100%" height="4rem" />
                        ) : (
                          <InteractiveList>
                            {DESIGN_OPTIONS.map((option) => (
                              <InteractiveList.RadioItem
                                key={option.value}
                                title={t(option.titleKey)}
                                description={t(option.descriptionKey)}
                                radio={{
                                  name: "design-option",
                                  value: String(option.value),
                                  checked: design === option.value,
                                  onChange: () => setDesign(option.value),
                                }}
                              />
                            ))}
                          </InteractiveList>
                        )}
                      </Box>
                    )}
                  </Box>
                </Card.Body>
              </Card>
              <Card>
                <Card.Header title={t("config.preview.title")} />
                <Card.Body>{loading ? <Skeleton width="100%" height="12rem" /> : renderPreview()}</Card.Body>
              </Card>
            </Box>
            {billingManageable(billing) && (
              <Card>
                <Card.Header title={t("config.billing.title")} />
                <Card.Body>
                  <Box display="flex" justifyContent="space-between" alignItems="center" gap="4" flexWrap="wrap">
                    <Box display="flex" flexDirection="column" gap="1">
                      <Box display="flex" gap="2" alignItems="center" flexWrap="wrap">
                        <Text fontWeight="bold">
                          {t("billing.plan.name", { price: i18n.formatBRL(billing.price) })}
                        </Text>
                        <Tag appearance={billingStatusInfo(billing, i18n, today).appearance}>
                          {billingStatusInfo(billing, i18n, today).label}
                        </Tag>
                      </Box>
                      <Text>{billingStatusInfo(billing, i18n, today).text}</Text>
                    </Box>
                    <Link as="button" appearance="primary" textDecoration="none" onClick={() => leave("/billing")}>
                      {t("config.billing.manage")}
                    </Link>
                  </Box>
                </Card.Body>
              </Card>
            )}
          </Box>
        )}
      </Page.Body>

      <Modal open={leaveTo !== null} onDismiss={() => setLeaveTo(null)}>
        <Modal.Header title={t("config.leave.title")} />
        <Modal.Body>
          <Text>{t("config.leave.message")}</Text>
        </Modal.Body>
        <Modal.Footer>
          <Button appearance="neutral" onClick={() => setLeaveTo(null)}>
            {t("config.leave.keepEditing")}
          </Button>
          <Button appearance="danger" onClick={() => leaveTo && navigate(leaveTo)}>
            {t("config.leave.confirm")}
          </Button>
        </Modal.Footer>
      </Modal>
    </Page>
  );
}
