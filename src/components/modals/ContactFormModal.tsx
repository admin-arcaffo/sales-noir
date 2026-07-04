"use client";

import { useState } from "react";
import { Loader2, User } from "lucide-react";
import { createContact, updateContact, type ContactData, type ProductData } from "@/actions/crm";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";

const inputClass = "input-noir";

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
    <Modal
      onClose={onClose}
      title={isEditing ? "Editar Contato" : "Novo Contato"}
      description={isEditing ? "Atualize os dados do contato." : "Adicione um novo contato a base."}
      icon={<User className="h-5 w-5 text-indigo-400" />}
      maxWidth="max-w-2xl"
      closeDisabled={isSubmitting}
      headerClassName="bg-indigo-500/10 p-6"
      contentClassName="space-y-4 p-6"
      footer={(
        <>
          <button onClick={onClose} disabled={isSubmitting} className="btn-noir-secondary px-5 py-2.5">
            Cancelar
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-lg bg-white px-6 py-2.5 text-sm font-bold text-black transition-colors hover:bg-zinc-200 disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              isEditing ? "Atualizar" : "Criar Contato"
            )}
          </button>
        </>
      )}
    >
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
              className="input-noir min-h-[80px] resize-none"
            />
          </div>
    </Modal>
  );
}
