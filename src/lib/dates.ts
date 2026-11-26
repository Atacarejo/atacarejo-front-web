// Datas de calendário da API ("AAAA-MM-DD", vencimentos no fuso de Brasília) para exibir no idioma da loja.
// Formata em UTC: a data é um dia, sem hora, e não pode mudar com o fuso do navegador.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Brasília é sempre UTC-3 (sem horário de verão desde 2019), como na API. */
const BRASILIA_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function formatDate(date: string | null, locale: string): string {
  if (!date || !DATE_RE.test(date)) return "—";
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  try {
    return new Intl.DateTimeFormat(locale, { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
  } catch {
    return date;
  }
}

/** O dia de hoje em Brasília ("AAAA-MM-DD"): o mesmo calendário dos prazos da API. */
export function brasiliaToday(now: Date = new Date()): string {
  return new Date(now.getTime() - BRASILIA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Dias de `from` até `to` ("2026-11-26" → "2026-11-28" = 2); data inválida → null. */
export function daysBetween(from: string, to: string): number | null {
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return null;
  const diff = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Number.isNaN(diff) ? null : Math.round(diff / DAY_MS);
}

/** "2026-11-28" + 7 → "2026-12-05"; data inválida → null. */
export function addDays(date: string, days: number): string | null {
  if (!DATE_RE.test(date)) return null;
  const time = Date.parse(`${date}T00:00:00Z`);
  return Number.isNaN(time) ? null : new Date(time + days * DAY_MS).toISOString().slice(0, 10);
}

/** Texto com a data formatada (ou null sem data): "O app funciona até {date}." */
export function formatDeadline(
  date: string | null,
  formatDate: (date: string | null) => string,
  text: (formatted: string) => string,
): string | null {
  return date ? text(formatDate(date)) : null;
}
