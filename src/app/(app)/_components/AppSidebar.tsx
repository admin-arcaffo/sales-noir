"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import {
  MessageSquare, Users, CheckCircle2, BarChart3,
  Settings, BrainCircuit, Sun, Moon, User, Contact
} from "lucide-react";
import { useFloatingChat } from "@/context/FloatingChatContext";
import { getNavItems, type NavItemDefinition } from "@/lib/nav-order";
import { getTaskNotifications } from "@/actions/crm";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  "/dashboard": BarChart3,
  "/conversations": MessageSquare,
  "/contacts": Contact,
  "/leads": Users,
  "/reports": BarChart3,
  "/tasks": CheckCircle2,
};

const NAV_BOTTOM = [
  { href: "/account", icon: User, label: "Minha Conta" },
  { href: "/settings", icon: Settings, label: "Configurações" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [navItems, setNavItems] = useState<NavItemDefinition[]>([]);
  const [taskCount, setTaskCount] = useState(0);

  const { conversations, lastReadMap } = useFloatingChat();

  const fetchTaskCount = async () => {
    try {
      const { count } = await getTaskNotifications();
      setTaskCount(count);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    setMounted(true);
    setNavItems(getNavItems());
    if (typeof window !== "undefined") {
      const isLight = document.documentElement.classList.contains("light");
      setTheme(isLight ? "light" : "dark");
    }
    
    fetchTaskCount();
    const interval = setInterval(fetchTaskCount, 5 * 60 * 1000); // 5 min
    return () => clearInterval(interval);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    if (nextTheme === "light") {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    }
    localStorage.setItem("theme", nextTheme);
    setTheme(nextTheme);
  };

  // Calculate unread count across all conversations
  const unreadCount = conversations.reduce((total, convo) => {
    const lastRead = lastReadMap[convo.id];
    if (!lastRead) {
      const lastMsg = convo.messages[convo.messages.length - 1];
      return total + ((lastMsg && lastMsg.direction === 'inbound') ? 1 : 0);
    }
    const lastReadTime = new Date(lastRead).getTime();
    const count = convo.messages.filter(m => 
      m.direction === 'inbound' && 
      new Date(m.timestamp).getTime() > lastReadTime
    ).length;
    return total + count;
  }, 0);

  return (
    <aside className="w-14 lg:w-[60px] border-r border-zinc-900 bg-[#070709] hidden md:flex flex-col items-center py-4 gap-4 shrink-0 z-30 transition-colors">
      <Link href="/dashboard" className="w-8 h-8 rounded bg-zinc-950 flex items-center justify-center border border-zinc-850 hover:bg-zinc-900 transition-colors relative group">
        <BrainCircuit className="text-zinc-400 w-4 h-4" />
        <div className="absolute left-full ml-3 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
          <span className="label-mono">Copilot</span>
        </div>
      </Link>

      <nav className="flex flex-col gap-1 w-full px-2">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = ICON_MAP[item.href];
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`p-2.5 rounded transition-all w-full flex justify-center items-center relative group
                ${isActive
                  ? "bg-zinc-900 border border-zinc-800 text-white"
                  : "text-zinc-500 hover:bg-zinc-900/40 hover:text-zinc-300 border border-transparent"
                }`}
            >
              {Icon && <Icon size={16} />}
              {item.href === "/conversations" && item.badge && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full text-[8px] font-bold text-white flex items-center justify-center animate-pulse border-2 border-[#070709]">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
              {item.href === "/tasks" && taskCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 rounded-full text-[8px] font-bold text-white flex items-center justify-center border-2 border-[#070709]">
                  {taskCount > 99 ? '99+' : taskCount}
                </span>
              )}
              {/* Tooltip */}
              <div className="absolute left-full ml-3 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                <span className="label-mono">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col items-center gap-2 w-full px-2">
        {mounted && (
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded transition-all w-full flex justify-center items-center relative group text-zinc-500 hover:bg-zinc-900/40 hover:text-zinc-300 cursor-pointer border border-transparent"
          >
            {theme === "dark" ? (
              <Sun size={16} className="text-amber-500 animate-spin-slow" />
            ) : (
              <Moon size={16} className="text-indigo-500 animate-pulse" />
            )}
            <div className="absolute left-full ml-3 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
              <span className="label-mono">{theme === "dark" ? "Modo Claro" : "Modo Escuro"}</span>
            </div>
          </button>
        )}

        {NAV_BOTTOM.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`p-2.5 rounded transition-all w-full flex justify-center items-center relative group
                ${isActive
                  ? "bg-zinc-900 border border-zinc-800 text-white"
                  : "text-zinc-500 hover:bg-zinc-900/40 hover:text-zinc-300 border border-transparent"
                }`}
            >
              <item.icon size={16} />
              <div className="absolute left-full ml-3 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                <span className="label-mono">{item.label}</span>
              </div>
            </Link>
          );
        })}
        {mounted && (
          <div className="border border-zinc-800 p-0.5 rounded bg-zinc-950 flex items-center justify-center mt-2 w-full max-w-[32px]">
            <UserButton 
              userProfileMode="navigation"
              userProfileUrl="/settings/profile"
              appearance={{ elements: { userButtonAvatarBox: "w-full h-full rounded-sm" } }} 
            />
          </div>
        )}
      </div>
    </aside>
  );
}
