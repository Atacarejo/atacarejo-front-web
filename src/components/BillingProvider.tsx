// Guarda a situação da assinatura para o app inteiro (avisos, bloqueio e telas de assinatura) e acompanha o
// pagamento feito na aba do Stripe: com checkout aberto ou fatura sendo paga, confere direto no Stripe (?sync=1)
// ao voltar para a aba e a cada 5 s, por até 3 min. Para assim que a loja assina ou a fatura é paga.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Billing } from "../lib/api";
import { BillingContext, hasOpenInvoice, loadBilling } from "../lib/billing";
import { brasiliaToday } from "../lib/dates";

/** Sem pagamento em andamento, voltar para a aba atualiza no máximo uma vez a cada 30 s. */
const REFRESH_ON_FOCUS_MS = 30_000;
/** Pagamento em andamento: confere a cada 5 s, por até 3 min (o prazo recomeça quando o lojista volta para a aba). */
const POLL_MS = 5_000;
const WATCH_MS = 3 * 60_000;
/** focus e visibilitychange chegam juntos ao voltar para a aba: conta uma vez só. */
const RETURN_DEBOUNCE_MS = 2_000;

type State = { billing: Billing | null; today: string };

export default function BillingProvider({ initial, children }: { initial: Billing | null; children: ReactNode }) {
  const [state, setState] = useState<State>(() => ({ billing: initial, today: brasiliaToday() }));
  // o lojista abriu uma página de pagamento: espera a fatura em aberto ser paga
  const [awaiting, setAwaiting] = useState(false);
  // cada mudança ganha uma versão: resposta de um GET que saiu antes dela é descartada
  const version = useRef(0);
  // GETs em andamento: a conferência periódica não empilha pedidos (o sync com o Stripe pode demorar)
  const inFlight = useRef(0);
  const watchUntil = useRef(0);
  const lastReturn = useRef(0);

  const apply = useCallback((next: Billing) => {
    setState({ billing: next, today: brasiliaToday() });
    // fatura paga (ou assinatura cancelada): não há mais o que esperar
    if (!hasOpenInvoice(next)) setAwaiting(false);
  }, []);

  const setBilling = useCallback(
    (next: Billing) => {
      version.current++;
      apply(next);
    },
    [apply],
  );

  const refresh = useCallback(
    async (options?: { prefill?: boolean; sync?: boolean }) => {
      const started = ++version.current;
      inFlight.current++;
      try {
        const next = await loadBilling(options);
        if (next && version.current === started) apply(next);
        return next;
      } finally {
        inFlight.current--;
      }
    },
    [apply],
  );

  const watchPayment = useCallback(() => {
    watchUntil.current = Date.now() + WATCH_MS;
    setAwaiting(true);
  }, []);

  const { billing } = state;
  const pending = billing !== null && (billing.checkoutPending || (awaiting && hasOpenInvoice(billing)));
  // fatura em aberto ou checkout: ao voltar para a aba, confere no Stripe (pode ter sido paga em outra aba)
  const unpaid = billing !== null && (billing.checkoutPending || hasOpenInvoice(billing));

  // começou sem dados (API lenta ou fora): tenta de novo em segundo plano
  useEffect(() => {
    if (initial === null) refresh();
  }, [initial, refresh]);

  // pagamento em andamento: confere a cada 5 s enquanto a aba está visível e o prazo não acabou
  useEffect(() => {
    if (!pending) return;
    watchUntil.current = Math.max(watchUntil.current, Date.now() + WATCH_MS);
    const timer = setInterval(() => {
      if (Date.now() > watchUntil.current || document.visibilityState !== "visible" || inFlight.current > 0) return;
      refresh({ sync: true });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [pending, refresh]);

  // voltou para a aba (ex.: depois de pagar na aba do Stripe)
  useEffect(() => {
    const onReturn = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (pending) {
        watchUntil.current = now + WATCH_MS;
        if (now - lastReturn.current < RETURN_DEBOUNCE_MS) return;
      } else if (now - lastReturn.current < REFRESH_ON_FOCUS_MS) {
        return;
      }
      lastReturn.current = now;
      refresh({ sync: unpaid });
    };
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    return () => {
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, [pending, unpaid, refresh]);

  const value = useMemo(
    () => ({ billing, today: state.today, refresh, setBilling, watchPayment, pending }),
    [billing, state.today, refresh, setBilling, watchPayment, pending],
  );
  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}
