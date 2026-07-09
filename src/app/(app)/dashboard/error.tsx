"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="surface-noir-muted flex w-full max-w-md flex-col items-center gap-6 p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-400">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-100">Erro no Dashboard</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Não foi possível carregar os dados do dashboard.
          </p>
          {error.digest && (
            <p className="mt-1 text-[10px] font-mono text-zinc-600">
              {error.digest}
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="btn-noir flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </button>
          <Link
            href="/conversations"
            className="btn-noir-secondary flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Ir para Conversas
          </Link>
        </div>
      </div>
    </div>
  );
}
