// Campos de quem paga a assinatura (nome, CPF/CNPJ e e-mail): no formulário de assinatura e no modal de
// atualizar os dados. Erro por campo: o da validação local ou o que a API devolveu (fieldErrors).
import type { ChangeEvent } from "react";
import { Box, Text } from "@nimbus-ds/components";
import { FormField } from "@nimbus-ds/patterns";
import { useT } from "../i18n";
import type { BillingCustomer } from "../lib/api";
import { type CustomerField, type FieldErrors, looksLikeCpfCnpj, looksLikeEmail, looksLikeName } from "../lib/billing";

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
  const invalid: Record<CustomerField, boolean> = {
    name: Boolean(fieldErrors.name) || (Boolean(touched.name) && !looksLikeName(value.name)),
    cpfCnpj: Boolean(fieldErrors.cpfCnpj) || (Boolean(touched.cpfCnpj) && !looksLikeCpfCnpj(value.cpfCnpj)),
    email: Boolean(fieldErrors.email) || (Boolean(touched.email) && !looksLikeEmail(value.email)),
  };
  const set = (field: CustomerField) => (e: ChangeEvent<HTMLInputElement>) =>
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
      <Box maxWidth="20rem">
      <FormField.Input
        id={`${idPrefix}-document`}
        label={t("billing.form.document")}
        value={value.cpfCnpj}
        onChange={set("cpfCnpj")}
        onBlur={() => onTouch?.("cpfCnpj")}
        appearance={invalid.cpfCnpj ? "danger" : "none"}
        helpText={invalid.cpfCnpj ? t("billing.form.documentInvalid") : undefined}
        showHelpText={invalid.cpfCnpj}
      />
      </Box>
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
