// Páginas do Stripe (checkout, fatura do Pix, portal do cliente) abertas numa nova aba, a partir do iframe do
// admin. No app da Nuvemshop no celular (WebView), uma nova aba pode não abrir nada: lá a página vai para o
// navegador do aparelho pelo Nexo (openInDefaultBrowser).
import type { MouseEvent } from "react";
import { getIsMobileDevice, openInDefaultBrowser } from "@tiendanube/nexo";
import nexo from "../nexoClient";

let mobile = false;

/** O admin está no app da Nuvemshop no celular (lá o navigateHeader do Nexo não aparece: a tela mostra o "voltar"). */
export function isMobileApp(): boolean {
  return mobile;
}

/**
 * Descobre uma vez, logo depois do connect, se o admin está no app do celular. Resolve quando sabe, ou depois de
 * `timeoutMs` (admin que não responde: segue como web), para o App esperar antes de montar as páginas.
 */
export function detectMobile(timeoutMs = 1500): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    const done = (value: boolean) => {
      mobile = value;
      clearTimeout(timer);
      resolve();
    };
    getIsMobileDevice(nexo).then(done, () => done(false));
  });
}

/** onClick de um link externo (target="_blank" rel="noopener noreferrer"): no celular, vai para o navegador do aparelho. */
export function openExternal(url: string) {
  return (event: MouseEvent) => {
    if (!mobile) return;
    event.preventDefault();
    openInDefaultBrowser(nexo, url);
  };
}

/** Só https: o endereço vem da API e vira destino de navegação. */
function isHttps(url: string): boolean {
  return /^https:\/\//i.test(url);
}

export type PendingTab = {
  /** Leva a aba para a página; false = a aba não abriu (bloqueada pelo navegador): mostre um link. */
  go: (url: string) => boolean;
  /** Fecha a aba (a API falhou ou não há página para abrir). */
  close: () => void;
};

/**
 * Abre a nova aba já no clique, antes da resposta da API: o navegador bloqueia uma aba aberta depois de um
 * `await`. Como a aba precisa ser levada ao endereço depois, ela não pode nascer com "noopener"; o vínculo
 * com o admin é cortado à mão (opener = null) antes de sair do about:blank, com o mesmo efeito.
 */
export function openPendingTab(loadingText: string): PendingTab {
  if (mobile) {
    return {
      go: (url) => {
        if (!isHttps(url)) return false;
        openInDefaultBrowser(nexo, url);
        return true;
      },
      close: () => {},
    };
  }
  let tab: Window | null = null;
  try {
    tab = window.open("about:blank", "_blank");
    if (tab) {
      tab.opener = null;
      tab.document.title = loadingText;
      tab.document.body.textContent = loadingText;
    }
  } catch {
    // aba aberta mas sem acesso ao documento: segue só com a navegação
  }
  return {
    go: (url) => {
      if (!tab || tab.closed || !isHttps(url)) return false;
      try {
        tab.location.replace(url);
        return true;
      } catch {
        return false;
      }
    },
    close: () => {
      try {
        tab?.close();
      } catch {
        // já fechada
      }
    },
  };
}

/** Sem clique por perto (resposta que chegou depois): só o celular abre sozinho; no computador, mostre um link. */
export function openWithoutGesture(url: string): boolean {
  if (!mobile || !isHttps(url)) return false;
  openInDefaultBrowser(nexo, url);
  return true;
}
