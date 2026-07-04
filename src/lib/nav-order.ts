const STORAGE_KEY = "nav:order";

export type NavItemDefinition = {
  href: string;
  label: string;
  badge?: boolean;
};

export const DEFAULT_NAV_ITEMS: NavItemDefinition[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/conversations", label: "Conversas", badge: true },
  { href: "/contacts", label: "Contatos" },
  { href: "/leads", label: "Leads" },
  { href: "/reports", label: "Relatórios" },
  { href: "/tasks", label: "Tarefas" },
];

export function getNavOrder(): string[] {
  if (typeof window === "undefined") return DEFAULT_NAV_ITEMS.map((i) => i.href);
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed: string[] = JSON.parse(stored);
      const validHrefs = new Set(DEFAULT_NAV_ITEMS.map((i) => i.href));
      const filtered = parsed.filter((h) => validHrefs.has(h));
      const missing = DEFAULT_NAV_ITEMS.map((i) => i.href).filter((h) => !filtered.includes(h));
      return [...filtered, ...missing];
    }
  } catch {}
  return DEFAULT_NAV_ITEMS.map((i) => i.href);
}

export function setNavOrder(order: string[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  }
}

export function getNavItems(): NavItemDefinition[] {
  const order = getNavOrder();
  const itemsByHref = new Map(DEFAULT_NAV_ITEMS.map((i) => [i.href, i]));
  return order.map((href) => itemsByHref.get(href)!).filter(Boolean);
}

export function getHomePage(): string {
  const order = getNavOrder();
  return order[0] || "/dashboard";
}
