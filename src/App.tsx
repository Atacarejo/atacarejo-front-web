import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { connect, ErrorBoundary } from "@tiendanube/nexo";
import { Box, ToastProvider } from "@nimbus-ds/components";
import ErrorState from "./components/ErrorState";
import nexo from "./nexoClient";
import NexoSync from "./components/NexoSync";
import HomePage from "./pages/HomePage";
import ConfigPage from "./pages/ConfigPage";

export default function App() {
  const [status, setStatus] = useState<"connecting" | "ready" | "error">("connecting");

  useEffect(() => {
    connect(nexo)
      // iAmReady é chamado pelo NexoSync, depois de assinar a navegação do admin
      .then(() => setStatus("ready"))
      .catch((err) => {
        console.error("[nexo]", err);
        setStatus("error");
      });
  }, []);

  if (status === "connecting") return null;

  if (status === "error") {
    return (
      <Box padding="4">
        <ErrorState
          title="Não foi possível abrir o app"
          message="Abra o Atacarejo pelo admin da Nuvemshop, em Meus aplicativos."
        />
      </Box>
    );
  }

  return (
    // ErrorBoundary do Nexo: obrigatório para publicar (avisa o admin e mostra o fallback)
    <ErrorBoundary nexo={nexo}>
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
    </ErrorBoundary>
  );
}
