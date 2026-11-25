// Links externos (fatura do Asaas). No computador, o target="_blank" abre uma nova aba a partir do iframe
// do admin. No app da Nuvemshop no celular (WebView), o _blank pode não abrir nada: lá o link vai para o
// navegador do aparelho pelo Nexo (openInDefaultBrowser).
import type { MouseEvent } from "react";
import { getIsMobileDevice, openInDefaultBrowser } from "@tiendanube/nexo";
import nexo from "../nexoClient";

let mobile = false;

/** Descobre uma vez, logo depois do connect, se o admin está no app do celular. */
export function detectMobile(): void {
  getIsMobileDevice(nexo).then(
    (value) => {
      mobile = value;
    },
    () => {
      mobile = false;
    },
  );
}

/** onClick do link externo: no celular, troca o _blank pelo navegador do aparelho. */
export function openExternal(url: string) {
  return (event: MouseEvent) => {
    if (!mobile) return;
    event.preventDefault();
    openInDefaultBrowser(nexo, url);
  };
}
