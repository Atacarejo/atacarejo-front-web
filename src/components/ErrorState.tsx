// Template de página de erro do Nimbus: explica o problema, botão de recarregar e contato de suporte.
import { Button, Link, Text } from "@nimbus-ds/components";
import { EmptyMessage } from "@nimbus-ds/patterns";
import { ExclamationTriangleIcon, RedoIcon } from "@nimbus-ds/icons";
import { useT } from "../i18n";

export const SUPPORT_EMAIL = "suporte@nextcubeinc.com";

type Props = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  /** false quando a página já tem outra ação primária (só uma por página) */
  primary?: boolean;
};

export default function ErrorState({
  title,
  message,
  onRetry = () => window.location.reload(),
  primary = true,
}: Props) {
  const t = useT();
  return (
    <EmptyMessage
      icon={<ExclamationTriangleIcon size={32} />}
      title={title ?? t("errorState.title")}
      text={message ?? t("errorState.message")}
      actions={
        <>
          <Button appearance={primary ? "primary" : "neutral"} onClick={onRetry}>
            <RedoIcon />
            {t("errorState.retry")}
          </Button>
          <Text>
            {t("errorState.support")} <Link as="a" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</Link>
          </Text>
        </>
      }
    />
  );
}
