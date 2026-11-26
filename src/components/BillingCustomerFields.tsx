// Campos de quem paga a assinatura (nome e e-mail): no formulário de assinatura e no modal de atualizar os dados. Sem
// CPF/CNPJ: não há nota fiscal. Erro por campo: o da validação local ou o que a API devolveu (fieldErrors).
import type { ChangeEvent } from "react";
import { Box, Text } from "@nimbus-ds/components";
import { FormField } from "@nimbus-ds/patterns";
import { useT } from "../i18n";
import type { BillingCustomer } from "../lib/api";
import { type CustomerField, type FieldErrors, looksLikeEmail, looksLikeName } from "../lib/billing";

type Props = {
  value: BillingCustomer;
  onChange: (value: BillingCustomer) => void;
  /** campos recusados pela API */
  fieldErrors?: FieldErrors;
  /** só mostra o erro de formato depois que o lojista mexeu no campo */
  touched?: Partial<Record<CustomerField, boolean>>;
  onTouch?: (field: CustomerField) => void;
  idPrefix: string;
};

export default function BillingCustomerFields({ value, onChange, fieldErrors = {}, touched = {}, onTouch, idPrefix }: Props) {
  const t = useT();
  const invalid = {
    name: Boolean(fieldErrors.name) || (Boolean(touched.name) && !looksLikeName(value.name)),
    email: Boolean(fieldErrors.email) || (Boolean(touched.email) && !looksLikeEmail(value.email)),
  };
  const set = (field: "name" | "email") => (e: ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [field]: e.target.value });

  return (
    <Box display="flex" flexDirection="column" gap="4">
      <FormField.Input
        id={`${idPrefix}-name`}
        label={t("billing.form.name")}
        autoComplete="organization"
        value={value.name}
        onChange={set("name")}
        onBlur={() => onTouch?.("name")}
        appearance={invalid.name ? "danger" : "none"}
        helpText={invalid.name ? t("billing.form.nameInvalid") : undefined}
        showHelpText={invalid.name}
      />
      <FormField.Input
        id={`${idPrefix}-email`}
        label={t("billing.form.email")}
        type="email"
        autoComplete="email"
        value={value.email}
        onChange={set("email")}
        onBlur={() => onTouch?.("email")}
        appearance={invalid.email ? "danger" : "none"}
        helpText={invalid.email ? t("billing.form.emailInvalid") : undefined}
        showHelpText={invalid.email}
      />
      <Text fontSize="caption">{t("billing.form.consent")}</Text>
    </Box>
  );
}
