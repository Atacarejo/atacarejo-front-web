// Configuração da loja: quantidade mínima do atacado e modelo de exibição na vitrine.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { navigateHeader, navigateHeaderRemove } from "@tiendanube/nexo";
import { Box, Button, Card, Skeleton, Spinner, Text, useToast } from "@nimbus-ds/components";
import { FormField, InteractiveList, Page } from "@nimbus-ds/patterns";
import { DisketteIcon } from "@nimbus-ds/icons";
import nexo from "../nexoClient";
import ErrorState from "../components/ErrorState";
import { api, type StoreConfig } from "../lib/api";
import { DESIGN_OPTIONS } from "../lib/design-options";
import { apiErrorMessage, useI18n } from "../i18n";

const MIN = 1;
const MAX = 999;

export default function ConfigPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const i18n = useI18n();
  const { t } = i18n;
  const [value, setValue] = useState("");
  const [savedValue, setSavedValue] = useState("");
  const [design, setDesign] = useState(DESIGN_OPTIONS[0].value);
  const [savedDesign, setSavedDesign] = useState(DESIGN_OPTIONS[0].value);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

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
      .then(() => setFailed(false), () => setFailed(true))
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

  return (
    <Page maxWidth="800px">
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
        {failed ? (
          <ErrorState onRetry={retry} />
        ) : (
          <Box display="flex" flexDirection="column" gap="4">
            <Card>
              <Card.Header title={t("config.minQuantity.title")} />
              <Card.Body>
                <Box display="flex" flexDirection="column" gap="4">
                  <Text>{t("config.minQuantity.text")}</Text>
                  {loading ? (
                    <Skeleton width="100%" height="4rem" />
                  ) : (
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
                      helpText={valid ? t("config.minQuantity.help") : t("config.minQuantity.invalid", { min: MIN, max: MAX })}
                      showHelpText
                    />
                  )}
                </Box>
              </Card.Body>
            </Card>
            <Card>
              <Card.Header title={t("config.design.title")} />
              <Card.Body>
                <Box display="flex" flexDirection="column" gap="4">
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
              </Card.Body>
            </Card>
          </Box>
        )}
      </Page.Body>
    </Page>
  );
}
