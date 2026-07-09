"use client";

import React, { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useFloatingChat } from "@/context/FloatingChatContext";
import {
  X, Send, Minimize2, Maximize2, Pin,
  User, MessageCircle, ArrowLeft
} from "lucide-react";
import { ContactAvatar } from "./ContactAvatar";

export function FloatingChatPopup() {
  const pathname = usePathname();
  const {
    conversations,
    activeConvoId,
    isPopupOpen,
    setIsPopupOpen,
    isFloating,
    setIsFloating,
    popupPosition,
    setPopupPosition,
    isMinimized,
    setIsMinimized,
    floatingView,
    setFloatingView,
    isFloatingChatEnabled,
    openFloatingConversationList,
    selectConversation,
    lastReadMap,
    sendMessage,
  } = useFloatingChat();

  const [inputMessage, setInputMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  
  const popupRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputMessageRef = useRef("");

  const activeConvo = conversations.find((c) => c.id === activeConvoId);
  const isListView = floatingView === "list" || !activeConvo;

  const getUnreadCount = (conversationId: string) => {
    const conversation = conversations.find((item) => item.id === conversationId);
    if (!conversation) return 0;

    const lastRead = lastReadMap[conversation.id];
    if (!lastRead) {
      const lastMsg = conversation.messages[conversation.messages.length - 1];
      return lastMsg && lastMsg.direction === "inbound" ? 1 : 0;
    }

    const lastReadTime = new Date(lastRead).getTime();
    return conversation.messages.filter((message) => (
      message.direction === "inbound" && new Date(message.timestamp).getTime() > lastReadTime
    )).length;
  };

  // Auto scroll to bottom of messages
  useEffect(() => {
    if (!isMinimized && !isListView && activeConvo?.messages) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeConvo?.messages, isListView, isMinimized]);

  useEffect(() => {
    inputMessageRef.current = "";
    setInputMessage("");
  }, [activeConvoId]);

  // Don't show the popup if we are on the main Conversations page
  // or if the popup is closed.
  if (!isFloatingChatEnabled || pathname.startsWith("/conversations") || !isPopupOpen) {
    return null;
  }

  // Pointer Event Handlers for Drag-and-Drop
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only drag with primary mouse button
    if (e.button !== 0) return;
    
    // Don't drag if clicking buttons
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input")) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);

    const rect = popupRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffsetRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const x = e.clientX - dragOffsetRef.current.x;
    const y = e.clientY - dragOffsetRef.current.y;
    
    // Bounds check to keep popup visible on screen
    const windowWidth = typeof window !== "undefined" ? window.innerWidth : 1000;
    const windowHeight = typeof window !== "undefined" ? window.innerHeight : 800;
    const popupWidth = popupRef.current?.offsetWidth || 380;
    const popupHeight = popupRef.current?.offsetHeight || 480;

    const boundedX = Math.max(10, Math.min(x, windowWidth - popupWidth - 10));
    const boundedY = Math.max(10, Math.min(y, windowHeight - popupHeight - 10));

    setPopupPosition({ x: boundedX, y: boundedY });
    setIsFloating(true);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDragging(false);
  };

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    const messageToSend = inputMessageRef.current.trim();
    if (!activeConvo || !messageToSend) return;

    const conversationId = activeConvo.id;
    inputMessageRef.current = "";
    setInputMessage("");
    void sendMessage(conversationId, messageToSend).catch((error) => {
      console.error("Failed to send message from popup:", error);
    });
  };

  const handleDockBack = () => {
    setPopupPosition(null);
    setIsFloating(false);
  };

  const handleSelectConversation = (conversationId: string) => {
    selectConversation(conversationId);
    setFloatingView("chat");
    setIsMinimized(false);
  };

  // Determine inline styles for floating vs docked positioning
  const popupStyle: React.CSSProperties = isFloating && popupPosition
    ? {
        position: "fixed",
        left: `${popupPosition.x}px`,
        top: `${popupPosition.y}px`,
        bottom: "auto",
        right: "auto",
      }
    : {};

  return (
    <div
      ref={popupRef}
      style={popupStyle}
      className={`surface-noir fixed z-50 flex w-[calc(100vw-24px)] max-h-[calc(100vh-96px)] flex-col overflow-hidden shadow-2xl transition-colors md:w-[380px]
        ${!isFloating ? "bottom-[76px] right-3 md:bottom-4 md:right-4" : ""}
        ${isMinimized ? "h-[52px]" : "h-[450px] md:h-[480px]"}`}
    >
      {/* Draggable Header */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`flex select-none items-center justify-between border-b border-white/5 bg-white/[0.02] px-4 py-3
          ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {!isListView && (
            <button
              onClick={openFloatingConversationList}
              title="Voltar para lista"
              className="rounded p-1 text-zinc-500 transition-all hover:bg-white/5 hover:text-white cursor-pointer"
            >
              <ArrowLeft size={13} />
            </button>
          )}

          {isListView ? (
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-white truncate max-w-[180px]">
                Conversas
              </h4>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider truncate">
                  Mais recentes
                </span>
              </div>
            </div>
          ) : (
            <>
              <div className="w-6 h-6 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400 shrink-0 overflow-hidden">
                <ContactAvatar
                  src={activeConvo.avatarUrl}
                  name={activeConvo.name || activeConvo.phone}
                  fallback={<User size={12} className="text-zinc-500" />}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-white truncate max-w-[120px] md:max-w-[150px]">
                  {activeConvo.name || activeConvo.phone}
                </h4>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider truncate">
                    Online
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {isFloating && (
            <button
              onClick={handleDockBack}
              title="Fixar no canto"
              className="rounded p-1 text-zinc-500 transition-all hover:bg-white/5 hover:text-white cursor-pointer"
            >
              <Pin size={13} />
            </button>
          )}
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? "Expandir" : "Minimizar"}
            className="rounded p-1 text-zinc-500 transition-all hover:bg-white/5 hover:text-white cursor-pointer"
          >
            {isMinimized ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
          </button>
          <button
            onClick={() => setIsPopupOpen(false)}
            title="Fechar chat"
            className="rounded p-1 text-zinc-500 transition-all hover:bg-red-500/10 hover:text-red-400 cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Message List and Footer (Hidden if minimized) */}
      {!isMinimized && (
        <>
          {isListView ? (
            <div className="flex-1 overflow-y-auto bg-[#09090b]/40 p-2">
              {conversations.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4">
                  <MessageCircle className="w-8 h-8 text-zinc-700 mb-2" />
                  <p className="text-[10px] text-zinc-500 max-w-[200px]">
                    Nenhuma conversa carregada ainda. Abra o chat principal para selecionar uma conversa.
                  </p>
                </div>
              ) : (
                conversations.map((conversation) => {
                  const unreadCount = getUnreadCount(conversation.id);
                  const isActive = conversation.id === activeConvoId;
                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => handleSelectConversation(conversation.id)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-all cursor-pointer ${
                        isActive ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="relative shrink-0">
                        <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400 overflow-hidden">
                          <ContactAvatar
                            src={conversation.avatarUrl}
                            name={conversation.name || conversation.phone}
                            fallback={<User size={13} className="text-zinc-500" />}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        {unreadCount > 0 && (
                          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-bold text-white ring-2 ring-[#09090b]">
                            {unreadCount > 9 ? "9+" : unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-[11px] font-bold text-zinc-100">
                            {conversation.name || conversation.phone}
                          </p>
                          <span className="shrink-0 text-[8px] font-mono uppercase tracking-wider text-zinc-600">
                            {conversation.time}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[10px] text-zinc-500">
                          {conversation.msg || "Sem mensagens ainda"}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          ) : activeConvo ? (
            <>
              {/* Scrollable Message List */}
              <div className="flex-1 space-y-3.5 overflow-y-auto bg-[#09090b]/40 p-4">
                {activeConvo.messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4">
                    <MessageCircle className="w-8 h-8 text-zinc-700 mb-2 animate-bounce" />
                    <p className="text-[10px] text-zinc-500 max-w-[180px]">
                      Nenhuma mensagem recente. Inicie o diálogo enviando uma mensagem.
                    </p>
                  </div>
                ) : (
                  activeConvo.messages.map((message, index) => {
                    const isOutbound = message.direction === "outbound";
                    const showTime = index === activeConvo.messages.length - 1;
                    return (
                      <div
                        key={message.id}
                        className={`flex flex-col max-w-[85%] ${
                          isOutbound ? "ml-auto items-end" : "mr-auto items-start"
                        }`}
                      >
                        <div
                          className={`px-3 py-2 text-xs leading-relaxed rounded-lg
                            ${
                              isOutbound
                                ? "bg-white text-black font-medium rounded-tr-none"
                                : "bg-zinc-900 border border-zinc-850 text-zinc-100 rounded-tl-none"
                            }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{message.text}</p>
                        </div>
                        {showTime && (
                          <span className="text-[8px] font-mono text-zinc-600 mt-1 uppercase tracking-widest px-1">
                            {message.time || new Date(message.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Footer Input Form */}
              <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-white/5 bg-white/[0.02] p-3">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => {
                    inputMessageRef.current = e.target.value;
                    setInputMessage(e.target.value);
                  }}
                  placeholder="Digite sua mensagem..."
                  className="input-noir flex-1 px-3 py-2 text-xs"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim()}
                  className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded bg-white text-black transition-all hover:bg-zinc-200 disabled:opacity-40"
                >
                  <Send size={12} />
                </button>
              </form>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
