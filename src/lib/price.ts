// Mesma regra da API (lib/wholesale/money.ts): até 2 casas, vírgula ou ponto, sem milhar.
// O input aceita os dois separadores em qualquer idioma; só a exibição segue o locale da loja.
const PRICE_RE = /^\d{1,10}([.,]\d{1,2})?$/;

export function isValidPrice(value: string): boolean {
  const v = value.trim();
  return v === "" || PRICE_RE.test(v);
}

/** Separador decimal do locale: "," em pt-BR/es-AR, "." em en-US/es-MX. */
export function decimalSeparator(locale: string): string {
  try {
    return new Intl.NumberFormat(locale).formatToParts(1.5).find((p) => p.type === "decimal")?.value ?? ",";
  } catch {
    return ",";
  }
}

/** "10.50" → "10,50" (ou "10.50", conforme o separador) para exibir no input. */
export function toInputPrice(value: string | null | undefined, separator = ","): string {
  if (!value || Number(value) <= 0) return "";
  return value.replace(".", separator);
}

/** Placeholder do input de preço: "0,00" / "0.00". */
export function pricePlaceholder(locale: string): string {
  return `0${decimalSeparator(locale)}00`;
}

/** Símbolo curto da moeda no locale ("R$", "$", "US$"...), para o prefixo do input. */
export function currencySymbol(locale: string, currency: string): string {
  try {
    return (
      new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol" })
        .formatToParts(0)
        .find((p) => p.type === "currency")?.value ?? currency
    );
  } catch {
    return currency;
  }
}

/** Preço da API ("10.50") formatado na moeda e no locale da loja; vazio → "—". */
export function formatMoney(value: string | null, locale: string, currency: string): string {
  if (value === null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  try {
    return n.toLocaleString(locale, { style: "currency", currency });
  } catch {
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
}

/**
 * Desconto do preço de atacado sobre o preço normal, em % inteiro (ex.: 20). null se não dá para calcular
 * (campo vazio ou inválido, produto sem preço). Negativo = o atacado está mais caro que o preço normal.
 */
export function discountPercent(price: string | null, input: string): number | null {
  const regular = Number(price);
  const text = input.trim().replace(",", ".");
  if (!text || !isValidPrice(input) || !Number.isFinite(regular) || regular <= 0) return null;
  const wholesale = Number(text);
  if (!Number.isFinite(wholesale) || wholesale <= 0) return null;
  return Math.round((1 - wholesale / regular) * 100);
}
