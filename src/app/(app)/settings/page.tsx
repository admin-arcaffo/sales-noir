"use client";

import { useEffect, useState } from "react";
import { BrainCircuit, ChevronRight, Key, Palette, Save, Shield, Webhook } from "lucide-react";
import {
  getSettingsData,
  savePromptTemplateVersion,
  saveWhatsAppConnectionSettings,
  setActivePromptTemplate,
  type PromptTemplateData,
  type SettingsData,
} from "@/actions/crm";
import { WhatsAppQR } from "./_components/WhatsAppQR";

const CATEGORIES = ["orchestrator", "auxiliary"] as const;

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isSavingWhatsApp, setIsSavingWhatsApp] = useState(false);
  const [isActivatingId, setIsActivatingId] = useState<string | null>(null);
  const [whatsAppForm, setWhatsAppForm] = useState({
    phoneNumberId: "",
    wabaId: "",
    accessToken: "",
  });
  const [form, setForm] = useState({
    name: "Prompt Orquestrador",
    slug: "orchestrator-main",
    category: "orchestrator",
    content: "",
  });

  const loadSettings = () => {
    getSettingsData()
      .then((result) => {
        setData(result);
        setWhatsAppForm({
          phoneNumberId: result.whatsappConnection.phoneNumberId,
          wabaId: result.whatsappConnection.wabaId,
          accessToken: "",
        });
        const activeOrchestrator = result.promptTemplates.find((template) => template.category === "orchestrator" && template.isActive);
        if (activeOrchestrator) {
          setForm({
            name: activeOrchestrator.name,
            slug: activeOrchestrator.slug,
            category: activeOrchestrator.category,
            content: activeOrchestrator.content,
          });
        }
      })
      .catch((error) => {
        console.error("Failed to load settings:", error);
      });
  };

// ... inside return ...
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.2fr] gap-6 items-start">
          <section className="bg-[#0c0c0e] border border-white/[0.06] rounded-xl p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-200">Adicionar/Editar Conhecimento IA</h2>
              <p className="text-xs text-zinc-500 mt-1">Crie o <b>Prompt Orquestrador</b> (cérebro) ou adicione <b>Contextos Auxiliares</b> (políticas, objeções, tabelas).</p>
            </div>

            <div className="space-y-3">
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Nome do contexto (ex: Tabela de Preços)"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={form.slug}
                  onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                  placeholder="Slug (ex: precos)"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
                <select
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                >
                  <option value="orchestrator">Orquestrador (Principal)</option>
                  <option value="auxiliary">Contexto Auxiliar</option>
                </select>
              </div>
              <textarea
                value={form.content}
                onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
                placeholder="Cole o conteúdo aqui (suporta Markdown e Texto Puro)..."
                rows={16}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-3 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500 resize-y font-mono text-[11px]"
              />
              <button
                onClick={() => void handleTemplateSave()}
                disabled={isSavingTemplate || !form.name.trim() || !form.content.trim()}
                className="w-full px-4 py-2 bg-white text-black rounded-lg text-sm font-semibold hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {isSavingTemplate ? "Salvando..." : "Salvar no Cérebro da IA"}
              </button>
            </div>
          </section>

          <section className="bg-[#0c0c0e] border border-white/[0.06] rounded-xl p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-200">Templates salvos</h2>
              <p className="text-xs text-zinc-500 mt-1">Selecione uma versão para editar ou ativar como padrão.</p>
            </div>

            <div className="space-y-3">
              {data?.promptTemplates.length ? data.promptTemplates.map((template) => (
                <div key={template.id} className="border border-white/[0.06] rounded-xl p-4 bg-white/[0.02] space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-zinc-200">{template.name}</p>
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-white/10 bg-white/5 text-zinc-400">
                          {template.category}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-white/10 bg-white/5 text-zinc-400">
                          v{template.version}
                        </span>
                        {template.isActive && (
                          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                            ativo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 mt-1">Slug: {template.slug}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => setForm({
                          name: template.name,
                          slug: template.slug,
                          category: template.category,
                          content: template.content,
                        })}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                      >
                        Editar base
                      </button>
                      <button
                        onClick={() => void handleActivateTemplate(template)}
                        disabled={template.isActive || isActivatingId === template.id}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-white/10 bg-white text-black hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isActivatingId === template.id ? "Ativando..." : template.isActive ? "Ativo" : "Ativar"}
                      </button>
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/[0.05] bg-black/20 p-3 text-xs text-zinc-400 whitespace-pre-wrap line-clamp-6">
                    {template.content}
                  </div>
                </div>
              )) : (
                <div className="rounded-xl border border-dashed border-white/10 p-6 text-sm text-zinc-500">
                  Nenhum template salvo ainda. Crie a primeira versão do prompt de análise para substituir o prompt padrão do sistema.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
