"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Check, XCircle, Info } from "lucide-react";

export type ToastType = "success" | "error" | "info";

interface ToastProps {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextData {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextData | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "success", duration: number = 3000) => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Container Centralizado para os Toasts */}
      <div className="fixed inset-0 z-[150] pointer-events-none flex flex-col items-center justify-center gap-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="surface-noir pointer-events-auto flex min-w-[200px] max-w-[300px] flex-col items-center justify-center rounded-2xl p-6 text-center shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300"
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
              toast.type === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
              toast.type === "error" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
              "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
            }`}>
              {toast.type === "success" && <Check className="w-6 h-6 animate-in zoom-in duration-500 delay-100" />}
              {toast.type === "error" && <XCircle className="w-6 h-6 animate-in zoom-in duration-500 delay-100" />}
              {toast.type === "info" && <Info className="w-6 h-6 animate-in zoom-in duration-500 delay-100" />}
            </div>
            <p className="text-zinc-200 text-sm font-semibold tracking-wide leading-relaxed">
              {toast.message}
            </p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast deve ser usado dentro de um ToastProvider");
  }
  return context;
}
