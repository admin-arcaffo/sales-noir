"use client";

import { useEffect, useState } from "react";
import { BrainCircuit, ChevronRight, Key, Palette, Save, Shield, Webhook } from "lucide-react";
import {
  getSettingsData,
  savePromptTemplateVersion,
  saveWhatsAppConnectionSettings,
  setActivePromptTemplate,
  deletePromptTemplate,
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
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [whatsAppForm, setWhatsAppForm] = useState({
    phoneNumberId: "",
    wabaId: "",
    accessToken: "",
  });
  const [form, setForm] = useState({
    id: "",
    name: "",
    slug: "",
    category: "auxiliary",
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
        if (activeOrchestrator && !form.name) {
          setForm({
            id: activeOrchestrator.id,
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

  useEffect(() => {
    loadSettings();
  }, []);

  const settingsSections = [
    {
      title: "Integrações",
      items: [
        {
          icon: Webhook,
          label: "WhatsApp Business",
          desc: `Conexão: ${data?.whatsappConnectionStatus || "Carregando..."} • Último sync: ${data?.whatsappLastSync || "-"}`,
          status: data?.whatsappConnectionStatus === "CONNECTED" ? "Conectado" : "Desconectado",
        },
        {
          icon: Key,
          label: "OpenAI API",
          desc: "Configuração usada para análises e drafts de resposta",
          status: data?.openAIStatus || "Carregando...",
        },
        {
          icon: BrainCircuit,
          label: "Inngest",
          desc: "Filas e transcrição assíncrona de áudio",
          status: data?.inngestStatus || "Carregando...",
        },
      ],
    },
    {
      title: "Preferências",
      items: [
        { icon: Palette, label: "Aparência", desc: "Tema, tipografia e densidade visual", status: "" },
        { icon: BrainCircuit, label: "Prompts do Agente", desc: `Templates salvos: ${data?.promptTemplatesCount ?? 0}`, status: "" },
        { icon: Shield, label: "Segurança", desc: "Autenticação, permissões e logs", status: "" },
      ],
    },
  ];

  const handleTemplateSave = async () => {
    if (!form.name.trim() || !form.content.trim()) {
      return;
    }

    setIsSavingTemplate(true);
    try {
      await savePromptTemplateVersion(form);
      setForm({ id: "", name: "", slug: "", category: "auxiliary", content: "" });
      loadSettings();
    } catch (error) {
      console.error("Failed to save prompt template:", error);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleWhatsAppSave = async () => {
    setIsSavingWhatsApp(true);
    try {
      await saveWhatsAppConnectionSettings(whatsAppForm);
      loadSettings();
    } catch (error) {
      console.error("Failed to save WhatsApp settings:", error);
    } finally {
      setIsSavingWhatsApp(false);
    }
  };

  const handleActivateTemplate = async (template: PromptTemplateData) => {
    setIsActivatingId(template.id);
    try {
      await setActivePromptTemplate(template.id);
      loadSettings();
    } catch (error) {
      console.error("Failed to activate prompt template:", error);
    } finally {
      setIsActivatingId(null);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm("Tem certeza que deseja deletar este prompt?")) return;
    setIsDeletingId(templateId);
    try {
      await deletePromptTemplate(templateId);
      loadSettings();
    } catch (error) {
      console.error("Failed to delete prompt template:", error);
    } finally {
      setIsDeletingId(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-8 max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Configurações</h1>
          <p className="text-sm text-zinc-500 mt-1">Gerencie integrações, prompts e governança operacional</p>
        </div>

        {(data as any)?.errorMessage && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-red-400">
              <Shield className="w-4 h-4" />
              <p className="text-sm font-semibold">Erro de Conexão detectado</p>
            </div>
            <p className="text-xs text-red-300/70 font-mono break-all bg-black/20 p-2 rounded">
              {(data as any).errorMessage}
            </p>
            <p className="text-[10px] text-zinc-500">
              Dica: Verifique se a DATABASE_URL no Vercel está correta e se a senha do Supabase não contém caracteres especiais sem conversão (como @).
            </p>
          </div>
        )}

        {settingsSections.map((section) => (
          <div key={section.title} className="space-y-3">
            <h2 className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">{section.title}</h2>
            <div className="space-y-2">
              {section.items.map((item) => (
                <div
                  key={item.label}
                  className="bg-[#0c0c0e] border border-white/[0.06] rounded-xl p-4 flex items-center gap-4 hover:border-white/10 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                    <item.icon className="w-5 h-5 text-zinc-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200">{item.label}</p>
                    <p className="text-xs text-zinc-500">{item.desc}</p>
                  </div>
                  {item.status && (
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${
                      item.status === "Configurado" || item.status === "Ativo" || item.status === "Conectado"
                        ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                        : "text-zinc-500 bg-zinc-800 border-zinc-700"
                    }`}>
                      {item.status}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-zinc-700" />
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-[#0c0c0e] border border-white/[0.06] rounded-xl p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-200">Configuração API Oficial (Meta)</h2>
              <p className="text-xs text-zinc-500 mt-1">
                Use esta opção se você tiver uma conta no WhatsApp Business Platform da Meta.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <input
                value={whatsAppForm.phoneNumberId}
                onChange={(event) => setWhatsAppForm((current) => ({ ...current, phoneNumberId: event.target.value }))}
                placeholder="Phone Number ID"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
              <input
                value={whatsAppForm.wabaId}
                onChange={(event) => setWhatsAppForm((current) => ({ ...current, wabaId: event.target.value }))}
                placeholder="WABA ID"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
              <input
                value={whatsAppForm.accessToken}
                onChange={(event) => setWhatsAppForm((current) => ({ ...current, accessToken: event.target.value }))}
                placeholder={data?.whatsappConnection.hasAccessToken ? "Token atual preservado" : "Access Token"}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
            </div>

            <button
              onClick={() => void handleWhatsAppSave()}
              disabled={isSavingWhatsApp}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 text-white rounded-lg text-sm font-semibold hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSavingWhatsApp ? "Salvando..." : "Salvar Configuração Meta"}
            </button>
          </section>

          <WhatsAppQR 
            currentStatus={data?.whatsappConnection.status || 'DISCONNECTED'} 
            instanceName={data?.whatsappConnection.instanceName}
            instanceToken={data?.whatsappConnection.instanceToken}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.2fr] gap-6 items-start">
          <section className="bg-[#0c0c0e] border border-white/[0.06] rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-sm font-semibold text-zinc-200">Adicionar/Editar Conhecimento IA</h2>
                <p className="text-xs text-zinc-500 mt-1">Crie o <b>Prompt Orquestrador</b> (cérebro) ou adicione <b>Contextos Auxiliares</b> (políticas, objeções, tabelas).</p>
              </div>
              <button
                onClick={() => setForm({ id: "", name: "", slug: "", category: "auxiliary", content: "" })}
                className="text-[11px] font-medium px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
              >
                + Novo Contexto
              </button>
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
                  disabled
                  placeholder="Slug (Gerado Automaticamente)"
                  className="w-full bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2 text-sm text-zinc-500 cursor-not-allowed"
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
                          id: template.id,
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
                        disabled={template.isActive || isActivatingId === template.id || isDeletingId === template.id}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-white/10 bg-white text-black hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isActivatingId === template.id ? "Ativando..." : template.isActive ? "Ativo" : "Ativar"}
                      </button>
                      <button
                        onClick={() => void handleDeleteTemplate(template.id)}
                        disabled={isDeletingId === template.id}
                        className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-40"
                        title="Deletar template"
                      >
                        {isDeletingId === template.id ? "..." : "🗑️"}
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
