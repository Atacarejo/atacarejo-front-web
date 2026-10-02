import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { connect, ErrorBoundary } from "@tiendanube/nexo";
import { Box, ToastProvider } from "@nimbus-ds/components";
import ErrorState from "./components/ErrorState";
import nexo from "./nexoClient";
import NexoSync from "./components/NexoSync";
import HomePage from "./pages/HomePage";
import ConfigPage from "./pages/ConfigPage";
import { I18nProvider, createTranslator, loadStoreLocale, localeFromNavigator, type StoreLocale } from "./i18n";

type State = { status: "connecting" } | { status: "ready"; store: StoreLocale } | { status: "error" };

export default function App() {
  const [state, setState] = useState<State>({ status: "connecting" });

  useEffect(() => {
    connect(nexo)
      // idioma/moeda da loja antes de montar as páginas (nunca rejeita: cai no Nexo e em "es").
      // iAmReady é chamado pelo NexoSync, depois de assinar a navegação do admin.
      .then(async () => setState({ status: "ready", store: await loadStoreLocale() }))
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
        <ToastProvider>
          <BrowserRouter>
            <NexoSync />
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/config" element={<ConfigPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}
