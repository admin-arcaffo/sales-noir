"use client";

import { useState, useEffect } from "react";

export function MessageTime({ timestamp, fallback }: { timestamp: string; fallback: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <span className="text-[10px] font-mono uppercase tracking-widest">{fallback}</span>;
  }

  try {
    const formatted = new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
    return <span className="text-[10px] font-mono uppercase tracking-widest">{formatted}</span>;
  } catch {
    return <span className="text-[10px] font-mono uppercase tracking-widest">{fallback}</span>;
  }
}
