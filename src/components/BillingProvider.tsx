// Guarda a situação da assinatura para o app inteiro (avisos, bloqueio e tela de assinatura).
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Billing } from "../lib/api";
import { BillingContext, loadBilling } from "../lib/billing";

/** Voltar para a aba (ex.: depois de pagar a fatura) atualiza, no máximo uma vez a cada 30 s. */
const REFRESH_ON_FOCUS_MS = 30_000;

export default function BillingProvider({ initial, children }: { initial: Billing | null; children: ReactNode }) {
  const [billing, setState] = useState<Billing | null>(initial);
  // cada mudança ganha uma versão: resposta de um GET que saiu antes dela é descartada
  const version = useRef(0);
  const lastFocusRefresh = useRef(0);

  const setBilling = useCallback((next: Billing) => {
    version.current++;
    setState(next);
  }, []);

  const refresh = useCallback(async (options?: { prefill?: boolean; sync?: boolean }) => {
    const started = ++version.current;
    const next = await loadBilling(options);
    if (next && version.current === started) setState(next);
    return next;
  }, []);

  // começou sem dados (API lenta ou fora): tenta de novo em segundo plano
  useEffect(() => {
    if (initial === null) refresh();
  }, [initial, refresh]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastFocusRefresh.current < REFRESH_ON_FOCUS_MS) return;
      lastFocusRefresh.current = Date.now();
      refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  const value = useMemo(() => ({ billing, refresh, setBilling }), [billing, refresh, setBilling]);
  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}
