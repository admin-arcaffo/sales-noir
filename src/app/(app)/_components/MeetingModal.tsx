import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle2, Loader2, X, Calendar, MapPin, Video, Clock, User as UserIcon } from "lucide-react";
import { createMeeting, getOrganizationUsers, type CreateMeetingResult, type OrganizationUserData } from "@/actions/crm";
import { useToast } from "@/components/ui/Toast";

interface MeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (email?: string, result?: Extract<CreateMeetingResult, { success: true }>) => void;
  contactId: string;
  contactName: string;
  defaultEmail?: string;
  defaultAddress?: string;
}

export function MeetingModal({ isOpen, onClose, onSuccess, contactId, contactName, defaultEmail = "", defaultAddress = "" }: MeetingModalProps) {
  const { showToast } = useToast();
  const [closers, setClosers] = useState<OrganizationUserData[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [type, setType] = useState<"PRESENCIAL" | "ONLINE">("PRESENCIAL");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [closerId, setCloserId] = useState("");
  const [email, setEmail] = useState(defaultEmail);
  const [location, setLocation] = useState(defaultAddress || "Rua Piratininga, 641");
  const [notes, setNotes] = useState("");

  const [errorWarning, setErrorWarning] = useState<string | null>(null);
  const [closerWarning, setCloserWarning] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setEmail(defaultEmail);
      setCloserId("");
      setErrorWarning(null);
      setCloserWarning(null);
      setLocation(defaultAddress || "Rua Piratininga, 641");
      getOrganizationUsers()
        .then(users => {
          setClosers(users);
          const connectedCloser = users.find((user) => user.googleCalendarConnected);
          if (connectedCloser) {
            setCloserId(connectedCloser.id);
            setCloserWarning(null);
          } else if (users.length === 0) {
            setCloserWarning("Nenhum closer cadastrado. Cadastre um usuário responsável antes de agendar.");
          } else {
            setCloserWarning("Nenhum closer com Google Agenda conectado. Conecte o Google Agenda em Configurações ou selecione outro closer.");
          }
        })
        .catch(err => {
          console.error("Failed to fetch closers:", err);
          setErrorWarning("Você precisa de um plano ativo para gerenciar a equipe de closers.");
        });
      // set default date to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setDate(tomorrow.toISOString().split("T")[0]);
      setTime("10:00");
    }
  }, [isOpen, defaultEmail, defaultAddress]);

  if (!isOpen) return null;

  const selectedCloser = closers.find((user) => user.id === closerId);
  const hasConnectedCloser = closers.some((user) => user.googleCalendarConnected);
  const canSubmit = !loading && Boolean(closerId && selectedCloser?.googleCalendarConnected);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCloserWarning(null);

    if (!date || !time || !email) {
      showToast("Preencha todos os campos obrigatórios.", "error");
      return;
    }

    if (!closerId) {
      const message = hasConnectedCloser
        ? "Selecione o closer responsável antes de agendar."
        : "Nenhum closer com Google Agenda conectado. Conecte o Google Agenda antes de agendar.";
      setCloserWarning(message);
      showToast(message, "error", 5000);
      return;
    }

    if (!selectedCloser?.googleCalendarConnected) {
      const message = "O closer selecionado não tem Google Agenda conectado. Selecione um closer conectado ou conecte a conta nas configurações.";
      setCloserWarning(message);
      showToast(message, "error", 6000);
      return;
    }

    setLoading(true);
    try {
      const scheduledAt = new Date(`${date}T${time}`);
      const duration = type === "PRESENCIAL" ? 90 : 45;
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const result = await createMeeting({
        contactId,
        closerId,
        title: `Reunião: ${contactName}`,
        type,
        duration,
        scheduledAt,
        location: type === "PRESENCIAL" ? location : undefined,
        contactEmail: email,
        notes,
        timeZone,
      });

      if (!result.success) {
        setCloserWarning(result.code.includes("CLOSER") ? result.error : null);
        showToast(result.error, "error", 7000);
        return;
      }

      showToast(result.message, "success", 5000);
      onSuccess(email, result);
      onClose();
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : "Erro ao agendar reunião. Verifique o Google Agenda.", "error", 7000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0c0c0e] w-full max-w-lg border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
              <Calendar className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Agendar Reunião</h2>
              <p className="text-xs text-zinc-400">{contactName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {errorWarning && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex gap-2 items-start">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{errorWarning}</p>
            </div>
          )}
          <form id="meeting-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType("PRESENCIAL")}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-colors ${
                  type === "PRESENCIAL" ? "bg-indigo-500/20 border-indigo-500 text-indigo-400" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                }`}
              >
                <MapPin className="w-5 h-5" />
                <div className="text-center">
                  <span className="block text-sm font-semibold text-white">Presencial</span>
                  <span className="text-[10px]">1h30 duração</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setType("ONLINE")}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-colors ${
                  type === "ONLINE" ? "bg-indigo-500/20 border-indigo-500 text-indigo-400" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                }`}
              >
                <Video className="w-5 h-5" />
                <div className="text-center">
                  <span className="block text-sm font-semibold text-white">Online (Meet)</span>
                  <span className="text-[10px]">45min duração</span>
                </div>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400 flex items-center gap-2"><Calendar className="w-3 h-3" /> Data</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400 flex items-center gap-2"><Clock className="w-3 h-3" /> Horário</label>
                <input type="time" value={time} onChange={e => setTime(e.target.value)} required className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400 flex items-center gap-2"><UserIcon className="w-3 h-3" /> Closer Responsável</label>
              <select
                value={closerId}
                onChange={e => {
                  setCloserId(e.target.value);
                  const nextCloser = closers.find((user) => user.id === e.target.value);
                  setCloserWarning(nextCloser && !nextCloser.googleCalendarConnected ? "Este closer ainda não conectou o Google Agenda." : null);
                }}
                required
                className={`w-full bg-zinc-900 border rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors appearance-none ${closerWarning || !closerId ? "border-amber-500/60 focus:border-amber-400" : "border-zinc-800 focus:border-indigo-500"}`}
              >
                <option value="">Selecione o closer...</option>
                {closers.map(user => (
                  <option key={user.id} value={user.id}>{user.name || user.email}{user.googleCalendarConnected ? " - Google conectado" : " - sem Google"}</option>
                ))}
              </select>
              <div className="min-h-5">
                {selectedCloser?.googleCalendarConnected && (
                  <p className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" /> Google Agenda conectado para este closer.
                  </p>
                )}
                {closerWarning && (
                  <p className="flex items-start gap-1.5 text-[11px] text-amber-400">
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /> {closerWarning}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Email do Contato (Obrigatório para convite)</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="email@exemplo.com" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
            </div>

            {type === "PRESENCIAL" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Endereço</label>
                <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="Endereço da reunião" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Observações (opcional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Pauta da reunião, links úteis..." rows={2} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors resize-none" />
            </div>
          </form>
        </div>

        <div className="p-4 border-t border-zinc-800 flex justify-end gap-3 bg-zinc-900/50">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors">
            Cancelar
          </button>
          <button type="submit" form="meeting-form" disabled={!canSubmit} className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Agendando..." : !hasConnectedCloser ? "Conecte um Google Agenda" : !closerId ? "Selecione um closer" : "Agendar e Enviar Convite"}
          </button>
        </div>
      </div>
    </div>
  );
}
