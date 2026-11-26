import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { connect, ErrorBoundary } from "@tiendanube/nexo";
import { Box, ToastProvider } from "@nimbus-ds/components";
import ErrorState from "./components/ErrorState";
import nexo from "./nexoClient";
import NexoSync from "./components/NexoSync";
import BillingGate from "./components/BillingGate";
import BillingProvider from "./components/BillingProvider";
import HomePage from "./pages/HomePage";
import ConfigPage from "./pages/ConfigPage";
import BillingPage from "./pages/BillingPage";
import { I18nProvider, createTranslator, loadStoreLocale, localeFromNavigator, type StoreLocale } from "./i18n";
import type { Billing } from "./lib/api";
import { loadBilling } from "./lib/billing";
import { detectMobile } from "./lib/external";

type State =
  | { status: "connecting" }
  | { status: "ready"; store: StoreLocale; billing: Billing | null }
  | { status: "error" };

export default function App() {
  const [state, setState] = useState<State>({ status: "connecting" });

  useEffect(() => {
    connect(nexo)
      // idioma/moeda da loja e assinatura antes de montar as páginas, em paralelo (nenhum dos dois rejeita:
      // o idioma cai no Nexo e em "es"; a assinatura, em null = app liberado).
      // iAmReady é chamado pelo NexoSync, depois de assinar a navegação do admin.
      .then(async () => {
        // a assinatura tem timeout próprio: lenta ou fora, o app abre liberado e o provider tenta de novo. O
        // celular é detectado antes de montar as páginas (elas mostram o "voltar" no app do celular)
        const [store, billing] = await Promise.all([
          loadStoreLocale(),
          loadBilling({ timeoutMs: 5000 }),
          detectMobile(),
        ]);
        setState({ status: "ready", store, billing });
      })
      .catch((err) => {
        console.error("[nexo]", err);
        setState({ status: "error" });
      });
  }, []);

  if (state.status === "connecting") return null;

  if (state.status === "error") {
    // sem Nexo não dá para saber a loja: usa o idioma do navegador
    const store = localeFromNavigator();
    const { t } = createTranslator(store.language);
    return (
      <I18nProvider store={store}>
        <Box padding="4">
          <ErrorState title={t("app.connectError.title")} message={t("app.connectError.message")} />
        </Box>
      </I18nProvider>
    );
  }

  return (
    // ErrorBoundary do Nexo: obrigatório para publicar (avisa o admin e mostra o fallback)
    <ErrorBoundary nexo={nexo}>
      <I18nProvider store={state.store}>
        <BillingProvider initial={state.billing}>
          <ToastProvider offset="high">
            <BrowserRouter>
              <NexoSync />
              <Routes>
                {/* sem pagamento (atacado pausado), as telas levam para a assinatura */}
                <Route
                  path="/"
                  element={
                    <BillingGate>
                      <HomePage />
                    </BillingGate>
                  }
                />
                <Route
                  path="/config"
                  element={
                    <BillingGate>
                      <ConfigPage />
                    </BillingGate>
                  }
                />
                <Route path="/billing" element={<BillingPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </ToastProvider>
        </BillingProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}
