// Loja sem pagamento (atacado pausado): as telas do app levam para a assinatura.
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useBilling } from "../lib/billing";

export default function BillingGate({ children }: { children: ReactNode }) {
  const { billing } = useBilling();
  // sem resposta da API, o app segue liberado (a cobrança nunca trava o lojista por erro)
  if (billing && !billing.allowed) return <Navigate to="/billing" replace />;
  return <>{children}</>;
}
