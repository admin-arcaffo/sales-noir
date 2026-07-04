"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { MessageSquare, Users, CheckCircle2, BarChart3, Settings, Contact } from "lucide-react";
import { useFloatingChat } from "@/context/FloatingChatContext";
import { getNavItems, type NavItemDefinition } from "@/lib/nav-order";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  "/dashboard": BarChart3,
  "/conversations": MessageSquare,
  "/contacts": Contact,
  "/leads": Users,
  "/reports": BarChart3,
  "/tasks": CheckCircle2,
};

export function BottomNav() {
  const pathname = usePathname();
  const { conversations, lastReadMap } = useFloatingChat();
  const [navItems, setNavItems] = useState<NavItemDefinition[]>([]);

  useEffect(() => {
    setNavItems(getNavItems());
  }, []);

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
    <nav className="md:hidden flex items-center justify-around fixed bottom-0 left-0 w-full h-[60px] bg-[#070709]/90 backdrop-blur-md border-t border-zinc-900 z-50">
      {navItems.map((item) => {
        const isActive = pathname.startsWith(item.href);
        const Icon = ICON_MAP[item.href];
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center w-full h-full relative ${
              isActive ? "text-white" : "text-zinc-500"
            }`}
          >
            <div className={`p-1.5 rounded-full transition-all ${isActive ? "bg-zinc-800/80" : ""}`}>
              {Icon && <Icon size={20} />}
            </div>
            {item.badge && unreadCount > 0 && (
              <span className="absolute top-2 right-[20%] w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center animate-pulse border-2 border-[#070709]">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
            <span className="text-[10px] mt-0.5 font-medium">{item.label}</span>
          </Link>
        );
      })}
      <Link
        href="/settings"
        className={`flex flex-col items-center justify-center w-full h-full relative ${
          pathname.startsWith("/settings") ? "text-white" : "text-zinc-500"
        }`}
      >
        <div className={`p-1.5 rounded-full transition-all ${pathname.startsWith("/settings") ? "bg-zinc-800/80" : ""}`}>
          <Settings size={20} />
        </div>
        <span className="text-[10px] mt-0.5 font-medium">Config</span>
      </Link>
    </nav>
  );
}
