"use client";

import { X } from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "@/components/ui/noir";
import { useEscapeKey } from "@/hooks/useEscapeKey";

type ModalProps = {
  isOpen?: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
  closeDisabled?: boolean;
  headerClassName?: string;
  contentClassName?: string;
  footerClassName?: string;
  overlayClassName?: string;
};

export function Modal({
  isOpen = true,
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  maxWidth = "max-w-lg",
  closeDisabled = false,
  headerClassName,
  contentClassName,
  footerClassName,
  overlayClassName,
}: ModalProps) {
  useEscapeKey(isOpen, onClose, closeDisabled);

  if (!isOpen) return null;

  return (
    <div className={cn("modal-overlay fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200", overlayClassName)}>
      <div className={cn("flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c0e] shadow-2xl", maxWidth)}>
        <header className={cn("flex items-start justify-between gap-4 border-b border-white/5 bg-white/[0.02] p-5", headerClassName)}>
          <div>
            <div className="flex items-center gap-2 text-zinc-100">
              {icon}
              <h3 className="font-bold">{title}</h3>
            </div>
            {description && <p className="mt-1 text-xs text-zinc-500">{description}</p>}
          </div>
          <button
            onClick={onClose}
            disabled={closeDisabled}
            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className={cn("flex-1 overflow-y-auto p-5", contentClassName)}>{children}</div>

        {footer && (
          <footer className={cn("flex justify-end gap-3 border-t border-white/5 bg-white/[0.02] p-5", footerClassName)}>
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
