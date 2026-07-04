"use client";

import { useEffect, useState } from "react";
import { BrainCircuit, ChevronRight, Key, Palette, Save, Shield, Webhook, Zap, Calendar, Settings, Users, UserPlus, Copy, Trash2, CheckCircle2, AlertTriangle, Loader2, ArrowUp, ArrowDown, GripVertical } from "lucide-react";
import {
  getSettingsData,
  savePromptTemplateVersion,
  saveWhatsAppConnectionSettings,
  setActivePromptTemplate,
  deletePromptTemplate,
  generateInviteLink,
  removeTeamMember,
  disconnectGoogleCalendar,
  setActiveWhatsAppProvider,
  type PromptTemplateData,
  type SettingsData,
} from "@/actions/crm";
import { WhatsAppQR } from "./_components/WhatsAppQR";
import { useToast } from "@/components/ui/Toast";
import { getNavItems, setNavOrder, DEFAULT_NAV_ITEMS } from "@/lib/nav-order";

type TabId = "integrations" | "ai" | "team" | "system" | "menu";

const TABS = [
  { id: "integrations", label: "Integrações", icon: Webhook, desc: "WhatsApp, Google, APIs", roles: ["owner", "member"] },
  { id: "ai", label: "Cérebro da IA", icon: BrainCircuit, desc: "Modelos e Contextos", roles: ["owner"] },
  { id: "team", label: "Equipe", icon: Users, desc: "Membros e Acesso", roles: ["owner"] },
  { id: "menu", label: "Menu", icon: Palette, desc: "Ordem dos itens", roles: ["owner", "member"] },
  { id: "system", label: "Sistema", icon: Shield, desc: "Status e Logs", roles: ["owner"] },
] as const;

export default function SettingsPage() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>("integrations");
  const [data, setData] = useState<SettingsData | null>(null);
  
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isSavingWhatsApp, setIsSavingWhatsApp] = useState(false);
  const [isActivatingId, setIsActivatingId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  
  const [isRemovingUser, setIsRemovingUser] = useState<string | null>(null);
  const [isDisconnectingGoogle, setIsDisconnectingGoogle] = useState(false);
  const [isChangingProvider, setIsChangingProvider] = useState(false);

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

  const [notificationForm, setNotificationForm] = useState({
    dealEmail: "",
    masterclassEmail: "",
  });
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [isReprocessingMedia, setIsReprocessingMedia] = useState(false);

  const [navOrder, setNavOrderState] = useState<string[]>(() => DEFAULT_NAV_ITEMS.map((i) => i.href));

  const moveNavItem = (index: number, direction: -1 | 1) => {
    const newOrder = [...navOrder];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    setNavOrderState(newOrder);
    setNavOrder(newOrder);
  };

  const loadSettings = () => {
    getSettingsData()
      .then((result) => {
        setData(result);
        setWhatsAppForm({
          phoneNumberId: result.whatsappConnectionMeta?.phoneNumberId || "",
          wabaId: result.whatsappConnectionMeta?.wabaId || "",
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
        
        setNotificationForm({
          dealEmail: result.dealNotificationEmail || "",
          masterclassEmail: result.masterclassNotificationEmail || "",
        });
      })
      .catch((error) => {
        console.error("Failed to load settings:", error);
      });
  };

  useEffect(() => {
    loadSettings();
    setNavOrderState(getNavItems().map((i) => i.href));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTemplateSave = async () => {
    if (!form.name.trim() || !form.content.trim()) return;
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

  const handleGenerateInvite = async () => {
    setIsGeneratingInvite(true);
    try {
      const token = await generateInviteLink();
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      setInviteUrl(`${origin}/invite/${token}`);
      setIsCopied(false);
    } catch (error: any) {
      showToast("Erro ao gerar convite: " + error.message, "error");
    } finally {
      setIsGeneratingInvite(false);
    }
  };

  const copyToClipboard = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 3000);
  };

  const handleRemoveTeamMember = async (userId: string) => {
    if (!confirm("Tem certeza que deseja remover este membro da equipe?")) return;
    setIsRemovingUser(userId);
    try {
      await removeTeamMember(userId);
      loadSettings();
    } catch (error: any) {
      showToast("Erro ao remover membro: " + error.message, "error");
    } finally {
      setIsRemovingUser(null);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!confirm("Tem certeza que deseja desconectar o Google Agenda?")) return;
    setIsDisconnectingGoogle(true);
    try {
      await disconnectGoogleCalendar();
      showToast("Google Agenda desconectado.", "success");
      loadSettings();
    } catch (error) {
      console.error("Disconnect Google error:", error);
      showToast("Erro ao desconectar Google Agenda.", "error");
    } finally {
      setIsDisconnectingGoogle(false);
    }
  };

  const handleSaveNotifications = async () => {
    setIsSavingNotifications(true);
    try {
      const { updateOrganizationNotificationSettings } = await import("@/actions/crm");
      await updateOrganizationNotificationSettings(
        notificationForm.dealEmail || null,
        notificationForm.masterclassEmail || null
      );
      showToast("Configurações de e-mail atualizadas com sucesso!", "success");
      loadSettings();
    } catch (error: any) {
      showToast(error.message || "Erro ao salvar configurações.", "error");
    } finally {
      setIsSavingNotifications(false);
    }
  };

  const handleReprocessMedia = async () => {
    setIsReprocessingMedia(true);
    try {
      const { reprocessMissingMedia } = await import("@/actions/crm");
      const result = await reprocessMissingMedia(50);
      showToast(`Mídias verificadas: ${result.checked}. Recuperadas: ${result.recovered}. Falhas: ${result.failed}.`, result.failed > 0 ? "info" : "success");
    } catch (error: any) {
      showToast(error.message || "Erro ao reprocessar mídias.", "error");
    } finally {
      setIsReprocessingMedia(false);
    }
  };

  const handleProviderChange = async (provider: 'META' | 'EVOLUTION') => {
    setIsChangingProvider(true);
    try {
      await setActiveWhatsAppProvider(provider);
      await loadSettings();
    } catch (error) {
      console.error("Erro ao trocar provedor:", error);
      showToast("Falha ao alterar provedor.", "error");
    } finally {
      setIsChangingProvider(false);
    }
  };

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center bg-[#040406]">
        <Loader2 className="w-8 h-8 text-zinc-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden bg-background">
      {/* Sidebar / Tabs Navigation */}
      <aside className="w-full md:w-64 lg:w-72 border-b md:border-b-0 md:border-r border-border bg-card shrink-0 flex flex-col">
        <div className="p-6 pb-4">
          <h1 className="heading-page">Configurações</h1>
          <p className="label-mono mt-2 text-muted-foreground">Sistema e Governança</p>
        </div>
        <div className="flex md:flex-col overflow-x-auto md:overflow-x-visible px-4 md:px-3 pb-4 md:pb-0 gap-2 no-scrollbar">
          {TABS.filter(t => (t.roles as readonly string[]).includes(data.currentUserRole)).map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-all shrink-0 md:shrink border ${
                  isActive 
                    ? "bg-white text-black border-transparent shadow-sm"
                    : "bg-transparent text-zinc-400 border-transparent hover:bg-white/5 hover:text-zinc-200"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-black" : "text-zinc-500"}`} />
                <div>
                  <p className={`text-sm font-bold ${isActive ? "" : ""}`}>{tab.label}</p>
                  <p className={`text-[10px] hidden lg:block ${isActive ? "text-zinc-600" : "text-zinc-500"}`}>{tab.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-8 pb-12">
          
          {/* TAB: INTEGRAÇÕES */}
          {activeTab === "integrations" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <header>
                <h2 className="heading-section flex items-center gap-2">
                  <Webhook className="w-5 h-5" /> Integrações & Canais
                </h2>
                <p className="text-xs text-muted-foreground mt-1">Gerencie a comunicação com o mundo externo.</p>
              </header>

              {/* WhatsApp Card */}
              <div className="card-noir space-y-5">
                <div className="flex items-center gap-3 pb-4 border-b border-zinc-900">
                  <div className="w-10 h-10 rounded bg-zinc-950 border border-zinc-850 flex items-center justify-center">
                    <Settings className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-200">WhatsApp Business API</h3>
                    <p className="text-[10px] text-zinc-500">Escolha o seu provedor preferido para automação</p>
                  </div>
                </div>

                {/* Provider Selector */}
                <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-900 w-full max-w-md">
                  <button 
                    onClick={() => handleProviderChange('EVOLUTION')}
                    disabled={isChangingProvider}
                    className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${
                      data.activeProvider === 'EVOLUTION' 
                    ? 'bg-white text-black shadow'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Instância Web (QR Code)
                  </button>
                  <button 
                    onClick={() => handleProviderChange('META')}
                    disabled={isChangingProvider}
                    className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${
                      data.activeProvider === 'META' 
                    ? 'bg-white text-black shadow'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Cloud API Oficial (Meta)
                  </button>
                </div>

                <div className="pt-2">
                  {data.activeProvider === 'EVOLUTION' ? (
                    <div className="glow-border rounded-xl">
                      <WhatsAppQR 
                        currentStatus={data.whatsappConnectionEvolution?.status || 'DISCONNECTED'} 
                        instanceName={data.whatsappConnectionEvolution?.instanceName}
                        instanceToken={data.whatsappConnectionEvolution?.instanceToken}
                        isActive={true}
                      />
                    </div>
                  ) : (
                    <div className="surface-noir-muted p-6 space-y-4">
                      <div>
                        <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Credenciais Meta Cloud</h4>
                        <p className="text-[11px] text-zinc-500 mt-1">Preencha com os dados do painel Meta for Developers.</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input
                          value={whatsAppForm.phoneNumberId}
                          onChange={(e) => setWhatsAppForm(c => ({ ...c, phoneNumberId: e.target.value }))}
                          placeholder="Phone Number ID"
                          className="input-noir py-2 text-xs"
                        />
                        <input
                          value={whatsAppForm.wabaId}
                          onChange={(e) => setWhatsAppForm(c => ({ ...c, wabaId: e.target.value }))}
                          placeholder="WhatsApp Business Account ID"
                          className="input-noir py-2 text-xs"
                        />
                        <input
                          value={whatsAppForm.accessToken}
                          onChange={(e) => setWhatsAppForm(c => ({ ...c, accessToken: e.target.value }))}
                          placeholder={data.whatsappConnectionMeta?.hasAccessToken ? "Token atual seguro/oculto" : "Permanent Access Token"}
                          className="input-noir py-2 text-xs md:col-span-2"
                        />
                      </div>
                      <button
                        onClick={() => void handleWhatsAppSave()}
                        disabled={isSavingWhatsApp}
                        className="btn-noir w-full sm:w-auto"
                      >
                        {isSavingWhatsApp ? <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" /> : null}
                        {isSavingWhatsApp ? "Salvando..." : "Salvar Configuração Meta"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Google Agenda Card */}
              <div className="card-noir flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded bg-zinc-950 border border-zinc-850 flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-200">Google Agenda</h3>
                    <p className="text-[10px] text-zinc-500 mt-0.5 max-w-sm">
                      Sincronização bidirecional de eventos. Permite ao sistema criar reuniões e disparar convites oficiais via e-mail.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {data.googleCalendarStatus ? (
                    <>
                      <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded">
                        Conectado
                      </span>
                      <button 
                        onClick={handleDisconnectGoogle}
                        disabled={isDisconnectingGoogle}
                         className="text-xs text-zinc-400 hover:text-red-400 hover:bg-white/5 px-3 py-1.5 rounded transition-all"
                      >
                        Desconectar
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-[10px] uppercase font-bold text-zinc-500 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded">
                        Desconectado
                      </span>
                      {data.googleOAuthUrl ? (
                        <a href={data.googleOAuthUrl} className="btn-noir">
                          Conectar Conta
                        </a>
                      ) : (
                        <button 
                          onClick={() => showToast("As variáveis GOOGLE_CLIENT_ID, SECRET e GOOGLE_REDIRECT_URI não estão no .env do servidor.", "error")}
                          className="btn-noir-outline"
                        >
                          Ajustar .env
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* System Services Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="card-noir flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0">
                    <Key className="w-4 h-4 text-zinc-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-300">OpenAI API</h4>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${data.openAIStatus === 'Configurado' ? 'bg-emerald-500 shadow-[0_0_5px_#10b981]' : 'bg-amber-500'}`} />
                      <span className="text-[10px] text-zinc-500">{data.openAIStatus}</span>
                    </div>
                  </div>
                </div>
                <div className="card-noir flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0">
                    <BrainCircuit className="w-4 h-4 text-zinc-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-300">Inngest Engine</h4>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${data.inngestStatus.includes('Ativo') ? 'bg-emerald-500 shadow-[0_0_5px_#10b981]' : 'bg-amber-500'}`} />
                      <span className="text-[10px] text-zinc-500">{data.inngestStatus}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: CÉREBRO DA IA */}
          {activeTab === "ai" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <header>
                <h2 className="heading-section flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5" /> Cérebro da IA
                </h2>
                <p className="text-xs text-muted-foreground mt-1">Programe a mente, contexto de vendas e objeções do seu agente inteligente.</p>
              </header>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                {/* Esquerda: Editor */}
                <section className="surface-noir p-5 space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-white/5">
                    <h3 className="text-sm font-bold text-zinc-200">Editor de Contexto</h3>
                    <button
                      onClick={() => setForm({ id: "", name: "", slug: "", category: "auxiliary", content: "" })}
                      className="text-[10px] uppercase font-bold text-zinc-400 hover:text-white transition-colors"
                    >
                      + Novo Prompt
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    <input
                      value={form.name}
                      onChange={(e) => setForm(c => ({ ...c, name: e.target.value }))}
                      placeholder="Nome da Diretriz (ex: Quebra de Objeções)"
                      className="input-noir py-2 text-xs"
                    />
                    <select
                      value={form.category}
                      onChange={(e) => setForm(c => ({ ...c, category: e.target.value }))}
                      className="select-noir py-2 text-xs"
                    >
                      <option value="orchestrator">Orquestrador (Comportamento Base)</option>
                      <option value="auxiliary">Contexto Auxiliar (Regras & Info)</option>
                    </select>
                    
                    <div className="relative group">
                      <div className="absolute -inset-0.5 bg-gradient-to-br from-indigo-500/20 to-purple-500/10 rounded blur opacity-0 group-focus-within:opacity-100 transition duration-500" />
                      <textarea
                        value={form.content}
                        onChange={(e) => setForm(c => ({ ...c, content: e.target.value }))}
                        placeholder="Insira as instruções em texto ou Markdown..."
                        rows={16}
                        className="input-noir relative resize-y rounded px-4 py-4 font-mono text-xs text-emerald-400/90"
                      />
                    </div>
                    
                    <button
                      onClick={() => void handleTemplateSave()}
                      disabled={isSavingTemplate || !form.name.trim() || !form.content.trim()}
                      className="btn-noir w-full shadow-[0_0_15px_rgba(255,255,255,0.05)]"
                    >
                      {isSavingTemplate ? "Gravando..." : "Salvar no Cérebro da IA"}
                    </button>
                  </div>
                </section>

                {/* Direita: Templates Salvos */}
                <section className="space-y-4">
                  <h3 className="text-sm font-bold text-zinc-200">Histórico & Versões</h3>
                  <div className="space-y-3 pr-2" style={{ maxHeight: "calc(100vh - 250px)", overflowY: "auto" }}>
                    {data.promptTemplates.length ? data.promptTemplates.map((template) => (
                      <div key={template.id} className="card-noir p-4 space-y-3 relative overflow-hidden group">
                        {template.isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 shadow-[0_0_10px_#10b981]" />}
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold text-zinc-200">{template.name}</p>
                              {template.isActive && (
                                <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 font-mono">
                                  Ativo
                                </span>
                              )}
                            </div>
                            <p className="label-mono mt-1">{template.category} • v{template.version}</p>
                          </div>
                          
                          <div className="flex gap-1.5 opacity-100 xl:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => void handleActivateTemplate(template)}
                              disabled={template.isActive || isActivatingId === template.id}
                              className="text-[10px] font-bold uppercase px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-zinc-300 disabled:opacity-30"
                            >
                              {template.isActive ? "Ativo" : "Ativar"}
                            </button>
                            <button
                              onClick={() => setForm({ id: template.id, name: template.name, slug: template.slug, category: template.category, content: template.content })}
                              className="text-[10px] font-bold uppercase px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-zinc-300"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => void handleDeleteTemplate(template.id)}
                              className="text-zinc-500 hover:text-red-400 p-1 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="rounded border border-white/5 bg-white/[0.03] p-2 text-[11px] text-zinc-500 font-mono whitespace-pre-wrap line-clamp-3">
                          {template.content}
                        </div>
                      </div>
                    )) : (
                      <div className="border border-dashed border-zinc-800 rounded-xl p-8 text-center">
                        <BrainCircuit className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
                        <p className="text-sm text-zinc-500">Nenhum conhecimento registrado.</p>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}

          {/* TAB: EQUIPE */}
          {activeTab === "team" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <header>
                <h2 className="heading-section flex items-center gap-2">
                  <Users className="w-5 h-5" /> Gestão de Equipe
                </h2>
                <p className="text-xs text-muted-foreground mt-1">Conecte vendedores à organização para compartilhar acesso a leads e funil.</p>
              </header>

              <div className="card-noir border-indigo-500/10 bg-indigo-500/[0.02]">
                <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
                        <UserPlus className="w-4 h-4" /> Convite de Acesso
                      </h3>
                      {(data as any).maxUsers !== undefined && (
                        <div className="px-2.5 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${(data as any).currentMemberCount >= (data as any).maxUsers ? 'bg-red-500' : 'bg-emerald-500'}`} />
                          <span className="text-[10px] font-mono text-indigo-300 font-bold">
                            {(data as any).currentMemberCount} / {(data as any).maxUsers} Vagas Ocupadas
                          </span>
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500 mb-3">
                      Gere um token temporário. Quem acessar o link será adicionado automaticamente ao seu Workspace.
                    </p>
                    
                    {(data as any).currentMemberCount >= (data as any).maxUsers ? (
                      <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg flex flex-col sm:flex-row items-center gap-4 justify-between">
                        <p className="text-[10px] text-red-300 flex-1">
                          Você atingiu o limite de {(data as any).maxUsers} usuários no seu plano atual. Para adicionar mais membros, conheça nosso plano Enterprise sob medida.
                        </p>
                        <a 
                          href="https://wa.me/5567982226166?text=Oi%2C%20quero%20saber%20mais%20do%20plano%20Enterprise%20do%20CRM%20para%20melhorar%20o%20meu%20time%20de%20vendas" 
                          target="_blank"
                          rel="noreferrer"
                          className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white rounded text-[10px] font-bold transition-all whitespace-nowrap"
                        >
                          Falar com Consultor
                        </a>
                      </div>
                    ) : (
                      <>
                        {inviteUrl ? (
                          <div className="flex items-center gap-2">
                            <input 
                              type="text" 
                              readOnly 
                              value={inviteUrl} 
                              className="input-noir flex-1 py-2 text-xs text-indigo-300 selection:bg-indigo-500/30 font-mono"
                            />
                            <button 
                              onClick={copyToClipboard}
                              className="flex items-center gap-1.5 rounded bg-white px-3 py-2 text-xs font-bold text-black transition-all hover:bg-zinc-200 shrink-0"
                            >
                              {isCopied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              {isCopied ? "Copiado!" : "Copiar Link"}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={handleGenerateInvite}
                            disabled={isGeneratingInvite}
                            className="btn-noir flex items-center gap-2 w-fit"
                          >
                            {isGeneratingInvite ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                            Gerar Link de Convite
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="surface-noir overflow-hidden">
                <table className="w-full text-left text-sm text-zinc-400">
                  <thead className="text-[10px] text-zinc-500 uppercase bg-zinc-950/50 border-b border-zinc-800 tracking-wider">
                    <tr>
                      <th className="px-5 py-4 font-bold">Membro da Equipe</th>
                      <th className="px-5 py-4 font-bold">Cargo & Acesso</th>
                      <th className="px-5 py-4 font-bold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.teamMembers?.map((member) => (
                      <tr key={member.id} className="border-b border-zinc-900/50 hover:bg-white/[0.01] transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-bold text-zinc-200">{member.name || "Usuário Pendente"}</p>
                          <p className="text-xs text-zinc-500 font-mono">{member.email}</p>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider border ${
                            member.role === "owner" 
                              ? "bg-amber-500/10 text-amber-500 border-amber-500/20" 
                              : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          }`}>
                            {member.role === "owner" ? "Dono" : "Membro/Closer"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          {member.role !== "owner" && (
                            <button
                              onClick={() => handleRemoveTeamMember(member.id)}
                              disabled={isRemovingUser === member.id}
                              className="text-red-400 hover:text-red-300 p-2 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50"
                              title="Remover acesso"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {(!data.teamMembers || data.teamMembers.length === 0) && (
                      <tr>
                        <td colSpan={3} className="px-5 py-8 text-center text-zinc-500 text-xs">
                          Nenhum membro encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "menu" && (
            <div className="space-y-6">
              <div className="surface-noir-muted p-6">
                <header className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-200">Ordenação do Menu</h3>
                    <p className="text-xs text-zinc-500 mt-1">Reordene os itens do menu lateral. O primeiro item será sua página inicial.</p>
                  </div>
                </header>

                <div className="space-y-2">
                  {navOrder.map((href, index) => {
                    const item = DEFAULT_NAV_ITEMS.find((i) => i.href === href);
                    if (!item) return null;
                    const isFirst = index === 0;
                    const isLast = index === navOrder.length - 1;
                    return (
                      <div
                        key={href}
                        className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                      >
                        <GripVertical className="w-4 h-4 text-zinc-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-zinc-200">
                            {item.label}
                            {isFirst && <span className="ml-2 text-[10px] text-emerald-400 font-bold">Página inicial</span>}
                          </p>
                          <p className="text-xs text-zinc-600">{href}</p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => moveNavItem(index, -1)}
                            disabled={isFirst}
                            className="p-1.5 rounded-lg text-zinc-500 hover:bg-white/5 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => moveNavItem(index, 1)}
                            disabled={isLast}
                            className="p-1.5 rounded-lg text-zinc-500 hover:bg-white/5 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p className="mt-4 text-[11px] text-zinc-600">
                  A ordem é salva automaticamente no seu navegador. Para sincronizar entre dispositivos, o primeiro item definido aqui será usado como página inicial após o login.
                </p>
              </div>
            </div>
          )}

          {activeTab === "system" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <header>
                <h2 className="heading-section flex items-center gap-2">
                  <Shield className="w-5 h-5" /> Sistema & Diagnóstico
                </h2>
                <p className="text-xs text-muted-foreground mt-1">Visão geral do ambiente e possíveis alertas de saúde da plataforma.</p>
              </header>

              {(data as any).errorMessage && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5 space-y-3 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertTriangle className="w-5 h-5" />
                    <h3 className="text-sm font-bold">Falha de Conexão com o Banco de Dados</h3>
                  </div>
                  <p className="text-xs text-red-300/70 font-mono bg-red-500/5 p-3 rounded-lg break-all border border-red-500/10">
                    {(data as any).errorMessage}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Diagnóstico: Verifique se a variável DATABASE_URL (Supabase/Prisma) está correta e evite caracteres especiais na senha.
                  </p>
                </div>
              )}

              <div className="card-noir space-y-4">
                <h3 className="text-sm font-bold text-zinc-200 border-b border-zinc-900 pb-2">Checklist de Ambiente</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-zinc-900/50">
                    <span className="text-xs text-zinc-400 font-mono">DATABASE_URL</span>
                    {(data as any).errorMessage ? (
                      <span className="text-[10px] text-red-400 font-bold uppercase">Erro</span>
                    ) : (
                      <span className="text-[10px] text-emerald-400 font-bold uppercase">OK</span>
                    )}
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-zinc-900/50">
                    <span className="text-xs text-zinc-400 font-mono">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</span>
                    <span className="text-[10px] text-emerald-400 font-bold uppercase">OK</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-zinc-900/50">
                    <span className="text-xs text-zinc-400 font-mono">OPENAI_API_KEY</span>
                    <span className={`text-[10px] font-bold uppercase ${data.openAIStatus === 'Configurado' ? 'text-emerald-400' : 'text-amber-500'}`}>{data.openAIStatus === 'Configurado' ? 'OK' : 'Pendente'}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-zinc-900/50">
                    <span className="text-xs text-zinc-400 font-mono">INNGEST_EVENT_KEY</span>
                    <span className={`text-[10px] font-bold uppercase ${data.inngestStatus?.includes('Ativo') ? 'text-emerald-400' : 'text-amber-500'}`}>{data.inngestStatus?.includes('Ativo') ? 'OK' : 'Pendente'}</span>
                  </div>
                </div>
              </div>

              <div className="card-noir space-y-4">
                <header className="border-b border-zinc-900 pb-2 flex justify-between items-center">
                  <h3 className="text-sm font-bold text-zinc-200">Notificações e Disparos de E-mail</h3>
                  {data.currentUserRole === 'owner' && (
                    <button
                      onClick={() => void handleSaveNotifications()}
                      disabled={isSavingNotifications}
                      className="btn-noir flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs"
                    >
                      <Save className="w-4 h-4" />
                      {isSavingNotifications ? "Salvando..." : "Salvar Configurações"}
                    </button>
                  )}
                </header>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">E-mail de Despacho da Venda</label>
                    <input
                      type="email"
                      value={notificationForm.dealEmail}
                      onChange={(e) => setNotificationForm(prev => ({ ...prev, dealEmail: e.target.value }))}
                      disabled={data.currentUserRole !== 'owner'}
                      placeholder="Ex: financeiro@empresa.com.br"
                      className="input-noir"
                    />
                    <p className="text-[10px] text-zinc-600 mt-1">Obrigatório para usar o botão Despachar Venda. Este e-mail recebe todos os dados do lead e do fechamento.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">E-mail Masterclass (Relacionamento)</label>
                    <input
                      type="email"
                      value={notificationForm.masterclassEmail}
                      onChange={(e) => setNotificationForm(prev => ({ ...prev, masterclassEmail: e.target.value }))}
                      disabled={data.currentUserRole !== 'owner'}
                      placeholder="Ex: relacionamento@arcaffo.com.br"
                      className="input-noir"
                    />
                    <p className="text-[10px] text-zinc-600 mt-1">E-mail para solicitação de onboarding na masterclass.</p>
                  </div>
                </div>
              </div>

              <div className="card-noir space-y-4">
                <header className="border-b border-zinc-900 pb-2 flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-200">Mídias do Chat</h3>
                    <p className="text-[10px] text-zinc-600 mt-1">Reprocessa imagens, áudios, documentos e figurinhas que ficaram pendentes.</p>
                  </div>
                  {data.currentUserRole === 'owner' && (
                    <button
                      onClick={() => void handleReprocessMedia()}
                      disabled={isReprocessingMedia}
                      className="btn-noir flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs"
                    >
                      {isReprocessingMedia ? "Reprocessando..." : "Reprocessar Mídias"}
                    </button>
                  )}
                </header>
                <p className="text-xs text-zinc-500">
                  Use quando arquivos antigos aparecerem como quebrados ou quando áudios/documentos não abrirem. O processo tenta recuperar a mídia pela Evolution e salva novamente no storage.
                </p>
              </div>
            </div>
          )}
          
        </div>
      </main>
    </div>
  );
}
