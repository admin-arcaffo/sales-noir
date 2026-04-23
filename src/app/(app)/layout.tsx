"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import {
  MessageSquare, Users, CheckCircle2, BarChart3,
  Settings, BrainCircuit
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", icon: BarChart3, label: "Dashboard" },
  { href: "/conversations", icon: MessageSquare, label: "Conversas" },
  { href: "/leads", icon: Users, label: "Leads" },
  { href: "/tasks", icon: CheckCircle2, label: "Tarefas" },
];

const NAV_BOTTOM = [
  { href: "/settings", icon: Settings, label: "Configurações" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-16 lg:w-[72px] border-r border-border/60 bg-[#0a0a0c] flex flex-col items-center py-6 gap-8 shrink-0 z-30">
        <Link href="/dashboard" className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 hover:bg-white/10 transition-colors">
          <BrainCircuit className="text-zinc-300 w-5 h-5" />
        </Link>

        <nav className="flex flex-col gap-2 w-full">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`p-3 rounded-xl transition-all w-full flex justify-center items-center relative
                  ${isActive
                    ? "bg-white/[0.06] text-zinc-200"
                    : "text-zinc-600 hover:bg-white/[0.03] hover:text-zinc-400"
                  }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-zinc-400 rounded-r-full" />
                )}
                <item.icon size={20} />
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col items-center gap-4 w-full">
          {NAV_BOTTOM.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`p-3 rounded-xl transition-all w-full flex justify-center items-center
                  ${isActive
                    ? "bg-white/[0.06] text-zinc-200"
                    : "text-zinc-600 hover:bg-white/[0.03] hover:text-zinc-400"
                  }`}
              >
                <item.icon size={20} />
              </Link>
            );
          })}
          {mounted && <UserButton appearance={{ elements: { userButtonAvatarBox: "w-8 h-8 rounded-lg" } }} />}
        </div>
      </aside>

      {/* Page content */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
