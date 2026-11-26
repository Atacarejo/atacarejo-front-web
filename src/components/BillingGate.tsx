// Loja sem pagamento (atacado pausado) ou que ainda não começou o teste grátis: as telas do app levam para a
// assinatura (lá fica a tela de boas-vindas).
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { trialNotStarted, useBilling } from "../lib/billing";

export default function BillingGate({ children }: { children: ReactNode }) {
  const { billing } = useBilling();
  // sem resposta da API, o app segue liberado (a cobrança nunca trava o lojista por erro)
  if (billing && (!billing.allowed || trialNotStarted(billing))) return <Navigate to="/billing" replace />;
  return <>{children}</>;
}
