"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Phone,
  MessageSquare,
  Search,
  Plus,
  Upload,
  User,
  Building,
  Mail,
  Briefcase,
  Trash2,
  Edit,
  ArrowUpRight,
  Loader2,
  CheckCircle2,
  X,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import {
  getContacts,
  deleteContact,
  getProducts,
  getOrganizationUsers,
  type ContactData,
  type ProductData,
} from "@/actions/crm";
import { ImportContactsModal } from "@/components/modals/ImportContactsModal";
import { ContactFormModal } from "@/components/modals/ContactFormModal";
import { DedupeContactsModal } from "@/components/modals/DedupeContactsModal";

function formatPhone(value: string) {
  if (value.length === 13) return `+${value.slice(0, 2)} (${value.slice(2, 4)}) ${value.slice(4, 9)}-${value.slice(9)}`;
  if (value.length === 12) return `+${value.slice(0, 2)} (${value.slice(2, 4)}) ${value.slice(4, 8)}-${value.slice(8)}`;
  return value;
}

export default function ContactsPage() {
  const { showToast } = useToast();
  const [contacts, setContacts] = useState<ContactData[]>([]);
  const [total, setTotal] = useState(0);
  const [products, setProducts] = useState<ProductData[]>([]);
  const [users, setUsers] = useState<Array<{ id: string; name: string | null; email: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [originFilter, setOriginFilter] = useState("ALL");
  const [leadFilter, setLeadFilter] = useState("ALL");
  const [productFilter, setProductFilter] = useState("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState("ALL");

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDedupeModalOpen, setIsDedupeModalOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactData | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadContacts = async () => {
    try {
      const search = searchTerm.trim() || undefined;
      const origin = originFilter !== "ALL" ? originFilter : undefined;
      const isLead = leadFilter !== "ALL" ? leadFilter === "LEAD" : undefined;
      const productId = productFilter !== "ALL" ? productFilter : undefined;
      const assignedUserId = assigneeFilter !== "ALL" ? assigneeFilter : undefined;

      const result = await getContacts({ search, origin, isLead, productId, assignedUserId, limit: 200 });
      setContacts(result.contacts);
      setTotal(result.total);
    } catch (error) {
      console.error("Failed to load contacts:", error);
      showToast("Não foi possível carregar os contatos.", "error");
    }
  };

  useEffect(() => {
    let alive = true;

    Promise.all([getContacts({ limit: 200 }), getProducts(), getOrganizationUsers()])
      .then(([contactResult, productResult, userResult]) => {
        if (!alive) return;
        setContacts(contactResult.contacts);
        setTotal(contactResult.total);
        setProducts(productResult);
        setUsers(userResult);
      })
      .catch((error) => {
        console.error("Failed to load contacts:", error);
        showToast("Não foi possível carregar os contatos.", "error");
      })
      .finally(() => {
        if (alive) setIsLoading(false);
      });

    return () => { alive = false; };
  }, [showToast]);

  const origins = Array.from(new Set(contacts.map((c) => c.origin).filter(Boolean) as string[])).sort();

  const handleDelete = async (id: string) => {
    try {
      await deleteContact(id);
      setContacts((prev) => prev.filter((c) => c.id !== id));
      setTotal((prev) => prev - 1);
      showToast("Contato excluído.", "success");
    } catch {
      showToast("Erro ao excluir contato.", "error");
    }
    setConfirmDeleteId(null);
  };

  const handleSearch = () => {
    setIsLoading(true);
    loadContacts().finally(() => setIsLoading(false));
  };

  const handleFormSuccess = () => {
    setIsFormModalOpen(false);
    setEditingContact(null);
    loadContacts();
  };

  return (
    <div className="h-full overflow-y-auto bg-[#040406]">
      <div className="mx-auto max-w-7xl space-y-6 p-5 md:p-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-indigo-400">
                <User className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold uppercase tracking-wider text-white">Contatos</h1>
                <p className="mt-1 text-sm text-zinc-500">{total} contato(s) no total.</p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setIsDedupeModalOpen(true)}
              className="flex items-center justify-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm font-bold text-amber-300 transition-colors hover:bg-amber-500/20"
            >
              <User className="h-4 w-4" />
              Deduplicar
            </button>
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Upload className="h-4 w-4" />
              Importar
            </button>
            <button
              onClick={() => { setEditingContact(null); setIsFormModalOpen(true); }}
              className="flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-black transition-colors hover:bg-zinc-200"
            >
              <Plus className="h-4 w-4" />
              Novo contato
            </button>
          </div>
        </header>

        <section className="rounded-2xl border border-white/[0.06] bg-[#0c0c0e] p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
            <div className="relative md:col-span-2 xl:col-span-2">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                placeholder="Buscar por nome, telefone, empresa, email..."
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-zinc-200 outline-none transition-all placeholder:text-zinc-600 focus:border-white/20"
              />
            </div>

            <select
              value={leadFilter}
              onChange={(e) => setLeadFilter(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300 outline-none"
            >
              <option value="ALL">Todos os tipos</option>
              <option value="LEAD">Apenas Leads</option>
              <option value="CONTACT">Apenas Contatos</option>
            </select>

            <select
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300 outline-none"
            >
              <option value="ALL">Todas origens</option>
              {origins.map((origin) => (
                <option key={origin} value={origin}>{origin}</option>
              ))}
            </select>

            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300 outline-none"
            >
              <option value="ALL">Todos produtos</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300 outline-none"
            >
              <option value="ALL">Todos responsáveis</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name || u.email}</option>
              ))}
            </select>
          </div>
        </section>

        {isLoading ? (
          <div className="grid gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl border border-white/[0.04] bg-white/[0.03]" />
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-[#0c0c0e] p-10 text-center">
            <User className="mx-auto mb-3 h-8 w-8 text-zinc-700" />
            <p className="font-semibold text-zinc-300">Nenhum contato encontrado</p>
            <p className="mt-1 text-sm text-zinc-600">Importe uma planilha ou crie um novo contato.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="rounded-2xl border border-white/[0.06] bg-[#0c0c0e] p-4 transition-colors hover:border-white/10"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-500">
                      {contact.avatarUrl ? (
                        <img src={contact.avatarUrl} alt="" className="h-full w-full rounded-xl object-cover" />
                      ) : (
                        <User className="h-5 w-5" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-zinc-100">{contact.name}</p>
                        {contact.isLead && (
                          <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                            Lead
                          </span>
                        )}
                        {contact.productName && (
                          <span className="rounded border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-400">
                            {contact.productName}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5" />
                          {formatPhone(contact.phone)}
                        </span>
                        {contact.company && (
                          <span className="flex items-center gap-1">
                            <Building className="h-3.5 w-3.5" />
                            {contact.company}
                          </span>
                        )}
                        {contact.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3.5 w-3.5" />
                            {contact.email}
                          </span>
                        )}
                        {contact.origin && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="h-3.5 w-3.5" />
                            {contact.origin}
                          </span>
                        )}
                        {contact.assignedUserName && (
                          <span className="rounded-md bg-white/[0.03] px-2 py-1">
                            Resp: {contact.assignedUserName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {contact.hasConversation && (
                      <Link
                        href={`/conversations?contactId=${contact.id}`}
                        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Chat
                      </Link>
                    )}
                    {contact.isLead && (
                      <Link
                        href={`/leads?leadId=${contact.id}`}
                        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        Pipeline
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                    <button
                      onClick={() => { setEditingContact(contact); setIsFormModalOpen(true); }}
                      className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    {confirmDeleteId === contact.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleDelete(contact.id)}
                          className="flex items-center gap-1 rounded-lg bg-red-500/20 px-3 py-2 text-xs font-bold text-red-400 transition-colors hover:bg-red-500/30"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Confirmar
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-400"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(contact.id)}
                        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-500 transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <ImportContactsModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={() => { loadContacts(); }}
        />

        <DedupeContactsModal
          isOpen={isDedupeModalOpen}
          onClose={() => setIsDedupeModalOpen(false)}
          onSuccess={() => { loadContacts(); }}
        />

        <ContactFormModal
          isOpen={isFormModalOpen}
          onClose={() => { setIsFormModalOpen(false); setEditingContact(null); }}
          onSuccess={handleFormSuccess}
          contact={editingContact}
          products={products}
          users={users}
        />
      </div>
    </div>
  );
}
