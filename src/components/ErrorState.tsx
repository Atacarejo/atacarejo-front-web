// Template de página de erro do Nimbus: explica o problema, botão de recarregar e contato de suporte.
import { Button, Link, Text } from "@nimbus-ds/components";
import { EmptyMessage } from "@nimbus-ds/patterns";
import { ExclamationTriangleIcon, RedoIcon } from "@nimbus-ds/icons";

export const SUPPORT_EMAIL = "suporte@nextcubeinc.com";

type Props = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  /** false quando a página já tem outra ação primária (só uma por página) */
  primary?: boolean;
};

export default function ErrorState({
  title = "Não foi possível carregar as informações",
  message = "Pode ser uma instabilidade momentânea. Tente de novo em alguns instantes.",
  onRetry = () => window.location.reload(),
  primary = true,
}: Props) {
  return (
    <EmptyMessage
      icon={<ExclamationTriangleIcon size={32} />}
      title={title}
      text={message}
      actions={
        <>
          <Button appearance={primary ? "primary" : "neutral"} onClick={onRetry}>
            <RedoIcon />
            Tentar de novo
          </Button>
          <Text>
            Se continuar, fale com a gente: <Link as="a" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</Link>
          </Text>
        </>
      }
    />
  );
}
