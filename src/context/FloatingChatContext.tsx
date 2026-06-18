"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { type ConversationData, sendConversationMessage } from "@/actions/crm";

interface FloatingChatContextType {
  conversations: ConversationData[];
  setConversations: React.Dispatch<React.SetStateAction<ConversationData[]>>;
  activeConvoId: string | null;
  selectConversation: (id: string | null) => void;
  isPopupOpen: boolean;
  setIsPopupOpen: (open: boolean) => void;
  isFloating: boolean;
  setIsFloating: (floating: boolean) => void;
  popupPosition: { x: number; y: number } | null;
  setPopupPosition: (pos: { x: number; y: number } | null) => void;
  isMinimized: boolean;
  setIsMinimized: (min: boolean) => void;
  syncStatus: "idle" | "syncing" | "error";
  syncError: string | null;
  lastSyncAt: Date | null;
  lastReadMap: Record<string, string>;
  setLastReadMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  sendMessage: (convoId: string, content: string) => Promise<any>;
}

const FloatingChatContext = createContext<FloatingChatContextType | undefined>(undefined);

export function FloatingChatProvider({ children }: { children: React.ReactNode }) {
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isFloating, setIsFloating] = useState(false);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "error">("idle");
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastReadMap, setLastReadMap] = useState<Record<string, string>>({});

  const lastSyncTimeRef = useRef<string | null>(null);
  const hasDoneInitialSyncRef = useRef(false);

  // Load cached conversations and last read map on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("sales_arcaffo_conversations");
        const cachedSync = localStorage.getItem("sales_arcaffo_last_sync_time");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setConversations(parsed);
            if (cachedSync && cachedSync !== "undefined" && cachedSync !== "null") {
              lastSyncTimeRef.current = cachedSync;
            }
          }
        }

        const cachedRead = localStorage.getItem("sales_arcaffo_last_read_map");
        if (cachedRead) {
          setLastReadMap(JSON.parse(cachedRead));
        }
      } catch (e) {
        console.error("Failed to load cached conversations from localStorage", e);
      }
    }
  }, []);

  // Save lastReadMap to localStorage
  useEffect(() => {
    if (Object.keys(lastReadMap).length > 0 && typeof window !== "undefined") {
      try {
        localStorage.setItem("sales_arcaffo_last_read_map", JSON.stringify(lastReadMap));
      } catch (e) {
        console.error("Failed to save lastReadMap to localStorage", e);
      }
    }
  }, [lastReadMap]);

  // Save conversations to localStorage (limit to top 50 to avoid QuotaExceededError)
  useEffect(() => {
    if (conversations.length > 0 && typeof window !== "undefined") {
      try {
        const cacheFriendlyList = conversations.slice(0, 50).map((c) => ({
          ...c,
          messages: c.messages.slice(-5),
        }));
        localStorage.setItem("sales_arcaffo_conversations", JSON.stringify(cacheFriendlyList));
      } catch (e) {
        console.warn("Storage quota exceeded or error occurred while writing to localStorage", e);
        try {
          const metadataOnlyList = conversations.slice(0, 50).map((c) => ({
            ...c,
            messages: [],
          }));
          localStorage.setItem("sales_arcaffo_conversations", JSON.stringify(metadataOnlyList));
        } catch (innerErr) {
          console.error("Failed to store even metadata in localStorage", innerErr);
        }
      }
    }
  }, [conversations]);

  // Main Background Polling Effect
  useEffect(() => {
    let alive = true;
    let timeoutId: NodeJS.Timeout;

    async function refreshData() {
      if (!alive) return;
      setSyncStatus("syncing");
      setSyncError(null);
      try {
        const syncTime = hasDoneInitialSyncRef.current ? lastSyncTimeRef.current : null;
        const url = `/api/conversations${syncTime ? `?since=${encodeURIComponent(syncTime)}` : ""}`;
        const res = await fetch(url);
        if (res.status === 401) {
          setSyncStatus("idle");
          return;
        }
        if (res.status === 404) {
          console.warn("Floating chat: Conversations API not found (404). Server might be compiling.");
          setSyncStatus("idle");
          return;
        }
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        const result = (await res.json()) as {
          conversations: ConversationData[];
          orgId: string;
          syncTime: string;
        };
        if (!alive) return;

        // Check for workspace change
        if (typeof window !== "undefined") {
          try {
            const cachedOrgId = localStorage.getItem("sales_arcaffo_org_id");
            if (cachedOrgId && cachedOrgId !== result.orgId) {
              localStorage.removeItem("sales_arcaffo_conversations");
              localStorage.removeItem("sales_arcaffo_last_sync_time");
              lastSyncTimeRef.current = null;
              setConversations(result.conversations);
              localStorage.setItem("sales_arcaffo_org_id", result.orgId);
              localStorage.setItem("sales_arcaffo_last_sync_time", result.syncTime);
              lastSyncTimeRef.current = result.syncTime;

              hasDoneInitialSyncRef.current = true;
              setSyncStatus("idle");
              setLastSyncAt(new Date());
              return;
            }
            localStorage.setItem("sales_arcaffo_org_id", result.orgId);
          } catch (e) {
            console.error("Workspace cache validation error", e);
          }
        }

        setConversations((prev) => {
          let nextList: ConversationData[];
          if (!syncTime || prev.length === 0) {
            nextList = result.conversations;
          } else if (result.conversations.length === 0) {
            return prev;
          } else {
            const updatedMap = new Map(result.conversations.map((c) => [c.id, c]));
            const merged = prev.map((c) => (updatedMap.has(c.id) ? updatedMap.get(c.id)! : c));
            const newItems = result.conversations.filter((c) => !prev.some((p) => p.id === c.id));
            nextList = [...newItems, ...merged];
          }

          nextList.sort((a, b) => {
            const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return timeB - timeA;
          });

          return nextList;
        });

        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("sales_arcaffo_last_sync_time", result.syncTime);
          } catch (e) {
            console.error("Failed to write last sync time to localStorage", e);
          }
        }
        lastSyncTimeRef.current = result.syncTime;
        hasDoneInitialSyncRef.current = true;
        setSyncStatus("idle");
        setLastSyncAt(new Date());
      } catch (error: any) {
        if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
          console.warn("Floating chat polling: network offline or server restarting.");
          setSyncStatus("error");
          setSyncError("Sem conexão com o servidor");
        } else {
          console.error("Failed to load conversations in floating chat:", error);
          setSyncStatus("error");
          setSyncError(error instanceof Error ? error.message : "Erro desconhecido");
        }
      } finally {
        if (alive) {
          // Dynamic interval: 2 seconds if on conversations page OR if popup is open, 10 seconds otherwise
          const activeInConversationsPage =
            typeof window !== "undefined" && window.location.pathname.startsWith("/conversations");
          const interval = activeInConversationsPage || (isPopupOpen && activeConvoId) ? 2000 : 10000;
          timeoutId = setTimeout(refreshData, interval);
        }
      }
    }

    refreshData();

    return () => {
      alive = false;
      clearTimeout(timeoutId);
    };
  }, [isPopupOpen, activeConvoId]);

  // Wrapper to select active conversation and manage read/unread status
  const selectConversation = (id: string | null) => {
    setActiveConvoId(id);
    if (id) {
      setLastReadMap((prev) => ({
        ...prev,
        [id]: new Date().toISOString(),
      }));
    }
  };

  // Helper to send text message and update state optimistically
  const sendMessage = async (convoId: string, content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    const tempId = `temp-${Date.now()}`;
    const tempTime = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    const optimisticMessage = {
      id: tempId,
      direction: "outbound" as const,
      type: "TEXT" as const,
      text: trimmed,
      time: tempTime,
      timestamp: new Date().toISOString(),
    };

    // Optimistic Update
    setConversations((current) => {
      const updated = current.map((conversation) =>
        conversation.id === convoId
          ? {
              ...conversation,
              msg: trimmed,
              time: tempTime,
              timestamp: optimisticMessage.timestamp,
              messageCount: conversation.messageCount + 1,
              messages: [...conversation.messages, optimisticMessage],
            }
          : conversation
      );
      return [...updated].sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeB - timeA;
      });
    });

    try {
      const newMessage = await sendConversationMessage(convoId, trimmed);
      setConversations((current) => {
        const updated = current.map((conversation) =>
          conversation.id === convoId
            ? {
                ...conversation,
                msg: newMessage.text || conversation.msg,
                timestamp: newMessage.timestamp,
                messages: conversation.messages.map((m) => (m.id === tempId ? newMessage : m)),
              }
            : conversation
        );
        return [...updated].sort((a, b) => {
          const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return timeB - timeA;
        });
      });
      return newMessage;
    } catch (error) {
      console.error("Send message error in floating chat:", error);
      // Remove optimistic message on error
      setConversations((current) => {
        const updated = current.map((conversation) => {
          if (conversation.id === convoId) {
            const nextMessages = conversation.messages.filter((m) => m.id !== tempId);
            const lastMsg = nextMessages[nextMessages.length - 1];
            const prevTimestamp = lastMsg ? lastMsg.timestamp : conversation.timestamp;
            return {
              ...conversation,
              messages: nextMessages,
              timestamp: prevTimestamp,
            };
          }
          return conversation;
        });
        return [...updated].sort((a, b) => {
          const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return timeB - timeA;
        });
      });
      throw error;
    }
  };

  return (
    <FloatingChatContext.Provider
      value={{
        conversations,
        setConversations,
        activeConvoId,
        selectConversation,
        isPopupOpen,
        setIsPopupOpen,
        isFloating,
        setIsFloating,
        popupPosition,
        setPopupPosition,
        isMinimized,
        setIsMinimized,
        syncStatus,
        syncError,
        lastSyncAt,
        lastReadMap,
        setLastReadMap,
        sendMessage,
      }}
    >
      {children}
    </FloatingChatContext.Provider>
  );
}

export function useFloatingChat() {
  const context = useContext(FloatingChatContext);
  if (context === undefined) {
    throw new Error("useFloatingChat must be used within a FloatingChatProvider");
  }
  return context;
}
