"use client";

import { useEffect } from "react";

const activeModals: { id: number; close: () => void }[] = [];
let nextId = 1;

if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Escape" && activeModals.length > 0) {
      // Pega o último modal da pilha (o mais recente / topo) e chama a função de fechar
      const topModal = activeModals[activeModals.length - 1];
      topModal.close();
    }
  });
}

/**
 * Hook para fechar modais usando a tecla ESC respeitando a ordem de abertura (pilha)
 * @param isOpen Se o modal está aberto
 * @param onClose Função para fechar o modal
 * @param closeDisabled Opcional, previne que o modal seja fechado (ex: carregando)
 */
export function useEscapeKey(isOpen: boolean, onClose: () => void, closeDisabled: boolean = false) {
  useEffect(() => {
    if (!isOpen || closeDisabled) return;

    const id = nextId++;
    const entry = { id, close: onClose };
    activeModals.push(entry);

    return () => {
      const index = activeModals.findIndex((m) => m.id === id);
      if (index > -1) {
        activeModals.splice(index, 1);
      }
    };
  }, [isOpen, onClose, closeDisabled]);
}
