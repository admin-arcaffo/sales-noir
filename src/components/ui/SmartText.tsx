"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { Phone, Copy, MessageSquare, ExternalLink, Mail, Check } from "lucide-react";
import { detectAll, type DetectedEntity } from "@/lib/detect-entities";

interface SmartTextProps {
  text: string;
  onPhoneAction?: (phone: string, phoneNormalized: string) => void;
  contactId?: string;
}

export function SmartText({ text, onPhoneAction, contactId }: SmartTextProps) {
  const fragments = useMemo(() => {
    const entities = detectAll(text);
    if (entities.length === 0) return [{ type: 'text' as const, content: text }];

    const parts: { type: 'text' | 'url' | 'email' | 'phone'; content: string; entity?: DetectedEntity }[] = [];
    let cursor = 0;

    for (const entity of entities) {
      if (entity.start > cursor) {
        parts.push({ type: 'text', content: text.slice(cursor, entity.start) });
      }
      parts.push({ type: entity.type, content: entity.value, entity });
      cursor = entity.end;
    }

    if (cursor < text.length) {
      parts.push({ type: 'text', content: text.slice(cursor) });
    }

    return parts;
  }, [text]);

  return (
    <span className="text-[14px] leading-snug whitespace-pre-wrap">
      {fragments.map((fragment, i) => {
        if (fragment.type === 'url') {
          return (
            <a
              key={i}
              href={fragment.content.startsWith('http') ? fragment.content : `https://${fragment.content}`}
              target="_blank"
              rel="noreferrer"
              className="text-blue-400 hover:text-blue-300 underline underline-offset-2 decoration-blue-500/30"
            >
              {fragment.content}
            </a>
          );
        }

        if (fragment.type === 'email') {
          return (
            <a
              key={i}
              href={`mailto:${fragment.content}`}
              className="text-blue-400 hover:text-blue-300 underline underline-offset-2 decoration-blue-500/30"
            >
              {fragment.content}
            </a>
          );
        }

        if (fragment.type === 'phone' && fragment.entity?.phoneNormalized) {
          return (
            <PhoneLink
              key={i}
              display={fragment.content}
              normalized={fragment.entity.phoneNormalized}
              onPhoneAction={onPhoneAction}
              contactId={contactId}
            />
          );
        }

        return <span key={i}>{fragment.content}</span>;
      })}
    </span>
  );
}

function PhoneLink({
  display,
  normalized,
  onPhoneAction,
  contactId,
}: {
  display: string;
  normalized: string;
  onPhoneAction?: (phone: string, phoneNormalized: string) => void;
  contactId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [open]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(normalized);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const handleWhatsApp = () => {
    window.open(`https://wa.me/${normalized}`, '_blank', 'noreferrer');
    setOpen(false);
  };

  const handleSave = () => {
    onPhoneAction?.(display, normalized);
    setOpen(false);
  };

  return (
    <span className="relative inline" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 decoration-emerald-500/30 font-medium cursor-pointer"
      >
        {display}
      </button>

      {open && (
        <span className="absolute z-50 bottom-full left-0 mb-1.5 flex items-center gap-1 rounded-lg border border-white/10 bg-[#0c0c0e] px-1.5 py-1 shadow-2xl backdrop-blur-md">
          <button
            onClick={handleWhatsApp}
            className="p-1.5 rounded-md hover:bg-emerald-500/20 text-emerald-400 transition-colors"
            title="Conversar no WhatsApp"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md hover:bg-zinc-700/50 text-zinc-400 transition-colors"
            title="Copiar número"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          {contactId && (
            <button
              onClick={handleSave}
              className="p-1.5 rounded-md hover:bg-zinc-700/50 text-zinc-400 transition-colors"
              title="Salvar no contato"
            >
              <Phone className="w-3.5 h-3.5" />
            </button>
          )}
        </span>
      )}
    </span>
  );
}
