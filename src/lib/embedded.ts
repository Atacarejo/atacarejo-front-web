// O admin do Atacarejo só funciona embutido no admin da Nuvemshop (iframe, via Nexo).
// Aberto direto no navegador, a URL vai para o site da NextCube, como no app antigo.
export const SITE_URL = "https://nextcubeinc.com";

export function isEmbedded(win: Window = window): boolean {
  try {
    return win.self !== win.top;
  } catch {
    // acesso a window.top bloqueado: só acontece dentro de um iframe de outra origem
    return true;
  }
}
