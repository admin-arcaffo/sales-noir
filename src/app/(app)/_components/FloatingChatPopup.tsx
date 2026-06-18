"use client";

import React, { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useFloatingChat } from "@/context/FloatingChatContext";
import {
  X, Send, Minimize2, Maximize2, Pin, Move, PinOff,
  User, MessageCircle
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
    sendMessage,
  } = useFloatingChat();

  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const popupRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConvo = conversations.find((c) => c.id === activeConvoId);

  // Auto scroll to bottom of messages
  useEffect(() => {
    if (!isMinimized && activeConvo?.messages) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeConvo?.messages, isMinimized]);

  // Don't show the popup if we are on the main Conversations page
  // or if the popup is closed, or if there's no active conversation.
  if (pathname.startsWith("/conversations") || !isPopupOpen || !activeConvoId || !activeConvo) {
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

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputMessage.trim() || isSending) return;

    setIsSending(true);
    const messageToSend = inputMessage;
    setInputMessage("");

    try {
      await sendMessage(activeConvo.id, messageToSend);
    } catch (error) {
      console.error("Failed to send message from popup:", error);
      // Restore input on error
      setInputMessage(messageToSend);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };

  const handleDockBack = () => {
    setPopupPosition(null);
    setIsFloating(false);
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
      className={`fixed z-50 w-[360px] md:w-[380px] bg-[#0c0c0e]/95 border border-zinc-800 rounded-lg shadow-2xl flex flex-col overflow-hidden transition-colors glass-noir
        ${!isFloating ? "bottom-4 right-4" : ""}
        ${isMinimized ? "h-[52px]" : "h-[450px] md:h-[480px]"}`}
    >
      {/* Draggable Header */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`px-4 py-3 bg-zinc-950/80 border-b border-zinc-850 flex items-center justify-between select-none
          ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400 shrink-0 overflow-hidden">
            <ContactAvatar
              src={activeConvo.avatarUrl}
              name={activeConvo.name || activeConvo.phone}
              fallback={<User size={12} className="text-zinc-500" />}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white truncate max-w-[140px] md:max-w-[160px]">
              {activeConvo.name || activeConvo.phone}
            </h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider truncate">
                Online
              </span>
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {isFloating && (
            <button
              onClick={handleDockBack}
              title="Fixar no canto"
              className="p-1 rounded text-zinc-500 hover:bg-zinc-900 hover:text-white transition-all cursor-pointer"
            >
              <Pin size={13} />
            </button>
          )}
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? "Expandir" : "Minimizar"}
            className="p-1 rounded text-zinc-500 hover:bg-zinc-900 hover:text-white transition-all cursor-pointer"
          >
            {isMinimized ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
          </button>
          <button
            onClick={() => setIsPopupOpen(false)}
            title="Fechar chat"
            className="p-1 rounded text-zinc-500 hover:bg-zinc-900 hover:text-red-400 transition-all cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Message List and Footer (Hidden if minimized) */}
      {!isMinimized && (
        <>
          {/* Scrollable Message List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#09090b]/40">
            {activeConvo.messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <MessageCircle className="w-8 h-8 text-zinc-700 mb-2 animate-bounce" />
                <p className="text-[10px] text-zinc-500 max-w-[180px]">
                  Nenhuma mensagem recente. Inicie o diálogo enviando uma mensagem.
                </p>
              </div>
            ) : (
              activeConvo.messages.map((message) => {
                const isOutbound = message.direction === "outbound";
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
                    <span className="text-[8px] font-mono text-zinc-600 mt-1 uppercase tracking-widest px-1">
                      {message.time || new Date(message.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Footer Input Form */}
          <form onSubmit={handleSend} className="p-3 bg-zinc-950/90 border-t border-zinc-850 flex items-center gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua mensagem..."
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-700 placeholder:text-zinc-650"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isSending}
              className="w-8 h-8 rounded bg-white text-black hover:bg-zinc-200 flex items-center justify-center transition-all disabled:opacity-40 cursor-pointer shrink-0"
            >
              <Send size={12} />
            </button>
          </form>
        </>
      )}
    </div>
  );
}
