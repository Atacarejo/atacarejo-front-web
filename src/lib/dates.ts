// Datas de calendário da API ("AAAA-MM-DD", vencimentos no fuso de Brasília) para exibir no idioma da loja.
// Formata em UTC: a data é um dia, sem hora, e não pode mudar com o fuso do navegador.

export function formatDate(date: string | null, locale: string): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "—";
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  try {
    return new Intl.DateTimeFormat(locale, { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
  } catch {
    return date;
  }
}
