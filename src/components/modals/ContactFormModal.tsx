"use client";

import { useState } from "react";
import { Loader2, X, User } from "lucide-react";
import { createContact, updateContact, type ContactData, type ProductData } from "@/actions/crm";
import { useToast } from "@/components/ui/Toast";

const inputClass = "w-full bg-black/40 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50";

export function ContactFormModal({
  isOpen,
  onClose,
  onSuccess,
  contact,
  products,
  users,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  contact: ContactData | null;
  products: ProductData[];
  users: Array<{ id: string; name: string | null; email: string }>;
}) {
  const { showToast } = useToast();
  const isEditing = !!contact;

  const [name, setName] = useState(contact?.name || "");
  const [phone, setPhone] = useState(contact?.phone || "");
  const [company, setCompany] = useState(contact?.company || "");
  const [email, setEmail] = useState(contact?.email || "");
  const [interestArea, setInterestArea] = useState(contact?.interestArea || "");
  const [origin, setOrigin] = useState(contact?.origin || "");
  const [notes, setNotes] = useState(contact?.notes || "");
  const [potentialValue, setPotentialValue] = useState(contact?.potentialValue ? String(contact.potentialValue) : "");
  const [address, setAddress] = useState(contact?.address || "");
  const [monthlyRevenue, setMonthlyRevenue] = useState(contact?.monthlyRevenue ? String(contact.monthlyRevenue) : "");
  const [mainChallenges, setMainChallenges] = useState(contact?.mainChallenges || "");
  const [productId, setProductId] = useState(contact?.productId || "");
  const [assignedUserId, setAssignedUserId] = useState(contact?.assignedUserId || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setError(null);

    if (!name.trim()) {
      setError("Nome é obrigatório.");
      return;
    }

    if (!phone.trim()) {
      setError("Telefone é obrigatório.");
      return;
    }

    setIsSubmitting(true);

    try {
      const data = {
        name: name.trim(),
        phone: phone.trim(),
        company: company.trim() || null,
        email: email.trim() || null,
        interestArea: interestArea.trim() || null,
        origin: origin.trim() || null,
        notes: notes.trim() || null,
        potentialValue: potentialValue ? Number(potentialValue.replace(",", ".")) : null,
        address: address.trim() || null,
        monthlyRevenue: monthlyRevenue ? Number(monthlyRevenue.replace(",", ".")) : null,
        mainChallenges: mainChallenges.trim() || null,
        productId: productId || null,
        assignedUserId: assignedUserId || null,
      };

      if (isEditing && contact) {
        await updateContact(contact.id, data);
        showToast("Contato atualizado.", "success");
      } else {
        await createContact(data);
        showToast("Contato criado.", "success");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar contato.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0c0c0e] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-indigo-500/10">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2 text-indigo-400">
              <User className="w-5 h-5" /> {isEditing ? "Editar Contato" : "Novo Contato"}
            </h3>
            <p className="text-xs text-zinc-500 mt-1">{isEditing ? "Atualize os dados do contato." : "Adicione um novo contato à base."}</p>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:bg-white/5 hover:text-white rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">Nome *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do contato" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">Telefone *</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="5511999999999" className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">Empresa</label>
              <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Nome da empresa" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">Área de Interesse</label>
              <input value={interestArea} onChange={(e) => setInterestArea(e.target.value)} placeholder="Ex: Marketing Digital" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">Origem</label>
              <input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Ex: Instagram" className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">Valor Potencial (R$)</label>
              <input value={potentialValue} onChange={(e) => setPotentialValue(e.target.value)} type="number" min={0} step="0.01" placeholder="Ex: 5000" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">Faturamento Mensal (R$)</label>
              <input value={monthlyRevenue} onChange={(e) => setMonthlyRevenue(e.target.value)} type="number" min={0} step="0.01" placeholder="Ex: 10000" className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">Produto</label>
              <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputClass}>
                <option value="">Nenhum</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">Responsável</label>
              <select value={assignedUserId} onChange={(e) => setAssignedUserId(e.target.value)} className={inputClass}>
                <option value="">Nenhum</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name || u.email}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">Endereço</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Endereço completo" className={inputClass} />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">Principais Desafios</label>
            <input value={mainChallenges} onChange={(e) => setMainChallenges(e.target.value)} placeholder="Ex: Falta de tráfego qualificado" className={inputClass} />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">Observações</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anotações sobre o contato..."
              className="w-full bg-black/40 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50 min-h-[80px] resize-none"
            />
          </div>
        </div>

        <div className="p-6 border-t border-white/5 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-zinc-800 text-white hover:bg-zinc-700 transition-colors disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-lg text-sm font-bold bg-indigo-500 text-white hover:bg-indigo-600 transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : (
              isEditing ? "Atualizar" : "Criar Contato"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
