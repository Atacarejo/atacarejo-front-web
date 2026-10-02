// Mantém a URL do admin da Nuvemshop e a rota do app sincronizadas (exigência da homologação).
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ACTION_NAVIGATE_SYNC, iAmReady, syncPathname, type NavigateSyncResponse } from "@tiendanube/nexo";
import nexo from "../nexoClient";

export default function NexoSync() {
  const location = useLocation();
  const navigate = useNavigate();
  const ready = useRef(false);

  // app → admin: avisa o admin a cada troca de rota
  useEffect(() => {
    syncPathname(nexo, location.pathname);
  }, [location.pathname]);

  // admin → app: rota inicial, botão voltar/avançar do navegador, links do admin.
  // A doc do Nexo exige assinar ACTION_NAVIGATE_SYNC ANTES do iAmReady, senão a rota inicial se perde.
  useEffect(() => {
    const unsubscribe = nexo.suscribe(ACTION_NAVIGATE_SYNC, ({ path, replace }: NavigateSyncResponse) => {
      navigate(path, { replace });
    });
    if (!ready.current) {
      ready.current = true;
      iAmReady(nexo);
    }
    return unsubscribe;
  }, [navigate]);

  return null;
}
