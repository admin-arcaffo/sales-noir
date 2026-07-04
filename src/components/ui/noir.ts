export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const hotBadge = "text-rose-400 bg-rose-500/10 border-rose-500/20";
const warmBadge = "text-amber-500 bg-amber-500/10 border-amber-500/20";
const coldBadge = "text-indigo-400 bg-indigo-500/10 border-indigo-500/20";

export const temperatureBadgeClasses: Record<string, string> = {
  hot: hotBadge,
  warm: warmBadge,
  cold: coldBadge,
  HOT: hotBadge,
  WARM: warmBadge,
  COLD: coldBadge,
};

export const temperatureDotClasses: Record<string, string> = {
  hot: "bg-rose-500",
  warm: "bg-amber-500",
  cold: "bg-indigo-500",
  HOT: "bg-rose-500",
  WARM: "bg-amber-500",
  COLD: "bg-indigo-500",
};

export const noir = {
  card: "bg-[#09090b] border border-zinc-900 rounded-xl",
  cardHover: "hover:border-zinc-700/80 transition-all",
  field: "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 outline-none transition-all placeholder:text-zinc-600 focus:border-white/20",
  select: "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300 outline-none transition-all focus:border-white/20",
  primaryButton: "rounded-lg bg-white px-4 py-2 text-sm font-bold text-black transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40",
  secondaryButton: "rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-300 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40",
  label: "text-[10px] font-bold uppercase tracking-wider text-zinc-500",
  pageTitle: "text-xl font-bold uppercase tracking-wider text-white",
} as const;
