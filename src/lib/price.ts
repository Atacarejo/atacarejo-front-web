// Mesma regra da API (lib/wholesale/money.ts): até 2 casas, vírgula ou ponto, sem milhar.
const PRICE_RE = /^\d{1,10}([.,]\d{1,2})?$/;

export function isValidPrice(value: string): boolean {
  const v = value.trim();
  return v === "" || PRICE_RE.test(v);
}

/** "10.50" → "10,50" para exibir no input. */
export function toInputPrice(value: string | null | undefined): string {
  if (!value || Number(value) <= 0) return "";
  return value.replace(".", ",");
}

export function formatBRL(value: string | null): string {
  if (value === null || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : value;
}
