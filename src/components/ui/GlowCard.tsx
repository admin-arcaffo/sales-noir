"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/components/ui/noir";

type GlowCardProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  glowColor?: string;
};

export function GlowCard({
  children,
  className,
  contentClassName,
  glowColor = "rgba(255, 255, 255, 0.04)",
}: GlowCardProps) {
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setCoords({ x: event.clientX - rect.left, y: event.clientY - rect.top });
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "relative rounded border border-zinc-800/80 bg-zinc-900/60 p-[1px] transition-all duration-300 hover:border-zinc-700/80",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(180px circle at ${coords.x}px ${coords.y}px, ${glowColor}, transparent 70%)`,
        }}
      />
      <div className={cn("relative z-10 flex h-full w-full flex-col justify-between rounded bg-[#09090b] p-6", contentClassName)}>
        {children}
      </div>
    </div>
  );
}
