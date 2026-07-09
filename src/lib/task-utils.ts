export function isOverdue(dueAt: string | null, status: string): boolean {
  if (status === "DONE" || !dueAt) return false;
  return new Date(dueAt).getTime() < Date.now();
}

export function isDueToday(dueAt: string | null): boolean {
  if (!dueAt) return false;
  const d = new Date(dueAt);
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}

export function isUpcoming(dueAt: string | null, status: string): boolean {
  if (status === "DONE" || !dueAt) return false;
  if (isDueToday(dueAt)) return false;
  return new Date(dueAt).getTime() > Date.now();
}

export function isSameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function formatTaskDate(iso: string | null): string {
  if (!iso) return "Sem data";
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  if (isSameCalendarDay(d, now)) return `Hoje ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameCalendarDay(d, yesterday)) return `Ontem ${time}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (isSameCalendarDay(d, tomorrow)) return `Amanhã ${time}`;

  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${time}`;
}
