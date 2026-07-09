"use client";

import { useEffect } from "react";

type ShortcutAction = (e: KeyboardEvent) => void;

interface Shortcuts {
  onEscape?: ShortcutAction;
  onSearch?: ShortcutAction; // Ctrl/Cmd + K
  onNew?: ShortcutAction; // Ctrl/Cmd + N
  onSend?: ShortcutAction; // Ctrl/Cmd + Enter
  onSave?: ShortcutAction; // Ctrl/Cmd + Shift + S
}

export function useKeyboardShortcuts(actions: Shortcuts) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (e.key === "Escape") {
        if (actions.onEscape) {
          e.preventDefault();
          actions.onEscape(e);
        }
      }

      if (cmdOrCtrl && e.key.toLowerCase() === "k") {
        if (actions.onSearch) {
          e.preventDefault();
          actions.onSearch(e);
        }
      }

      if (cmdOrCtrl && e.key.toLowerCase() === "n" && !e.shiftKey) {
        if (actions.onNew) {
          e.preventDefault();
          actions.onNew(e);
        }
      }

      // Cmd+Enter or Ctrl+Enter works even inside textarea
      if (cmdOrCtrl && e.key === "Enter") {
        if (actions.onSend) {
          e.preventDefault();
          actions.onSend(e);
        }
      }

      if (cmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "s") {
        if (actions.onSave) {
          e.preventDefault();
          actions.onSave(e);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [actions]);
}
