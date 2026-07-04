import React, { useState } from "react";
import { Plus, Trash2, Edit2, Check, X, Tag } from "lucide-react";
import { 
  addCustomProductToContact, 
  addCatalogProductToContact, 
  updateContactProductPrice, 
  removeContactProduct,
  type ContactProductData,
  type ProductData
} from "@/actions/crm";

interface QuoteEditorProps {
  contactId: string;
  contactProducts: ContactProductData[];
  catalogProducts: ProductData[];
  onUpdate: () => void;
}

export function QuoteEditor({ contactId, contactProducts = [], catalogProducts = [], onUpdate }: QuoteEditorProps) {
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [loading, setLoading] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");

  const totalValue = contactProducts.reduce((sum, cp) => {
    return sum + (cp.customPrice !== null ? cp.customPrice : (cp.originalPrice || 0));
  }, 0);

  const handleAddCatalog = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pid = e.target.value;
    if (!pid) return;
    setLoading(true);
    try {
      await addCatalogProductToContact(contactId, pid);
      onUpdate();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      e.target.value = ""; // reset select
    }
  };

  const handleAddCustom = async () => {
    if (!customName.trim()) return;
    setLoading(true);
    try {
      const price = customPrice ? parseFloat(customPrice) : 0;
      await addCustomProductToContact(contactId, customName.trim(), price);
      setCustomName("");
      setCustomPrice("");
      setIsAddingCustom(false);
      onUpdate();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePrice = async (cpId: string) => {
    setLoading(true);
    try {
      const price = editPrice.trim() === "" ? null : parseFloat(editPrice);
      await updateContactProductPrice(cpId, price);
      setEditingId(null);
      onUpdate();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (cpId: string) => {
    setLoading(true);
    try {
      await removeContactProduct(cpId);
      onUpdate();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const availableCatalog = catalogProducts.filter(p => !contactProducts.some(cp => cp.productId === p.id));

  return (
    <div className="space-y-3 bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Tag className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Orçamento / Proposta</h3>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar">
        {contactProducts.length === 0 ? (
          <p className="text-xs text-zinc-500 italic">Nenhum item adicionado à proposta.</p>
        ) : (
          contactProducts.map(cp => {
            const isEditing = editingId === cp.id;
            const activePrice = cp.customPrice !== null ? cp.customPrice : (cp.originalPrice || 0);
            const hasDiscount = cp.customPrice !== null && cp.originalPrice !== null && cp.customPrice !== cp.originalPrice;

            return (
              <div key={cp.id} className="group flex items-center justify-between gap-2 p-2 rounded bg-black/20 hover:bg-black/40 border border-white/5 transition-all">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-zinc-200 truncate">{cp.name}</p>
                  {!isEditing && hasDiscount && (
                    <span className="text-[9px] text-zinc-500 line-through">R$ {cp.originalPrice?.toLocaleString('pt-BR')}</span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <input 
                        type="number" 
                        value={editPrice}
                        onChange={e => setEditPrice(e.target.value)}
                        placeholder="Valor"
                        className="w-20 bg-black border border-white/20 rounded px-2 py-1 text-xs text-emerald-400 focus:outline-none"
                        autoFocus
                      />
                      <button onClick={() => handleSavePrice(cp.id)} disabled={loading} className="p-1 text-emerald-400 hover:bg-emerald-400/20 rounded transition-colors"><Check className="w-3 h-3" /></button>
                      <button onClick={() => setEditingId(null)} className="p-1 text-zinc-400 hover:bg-white/10 rounded transition-colors"><X className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-bold ${activePrice === 0 ? 'text-zinc-400' : 'text-emerald-400'}`}>
                        {activePrice === 0 ? 'Sem Custo' : `R$ ${activePrice.toLocaleString('pt-BR')}`}
                      </span>
                      <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingId(cp.id); setEditPrice(cp.customPrice !== null ? String(cp.customPrice) : ''); }} className="p-1 text-zinc-400 hover:text-white transition-colors" title="Editar Preço">
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleRemove(cp.id)} disabled={loading} className="p-1 text-red-400 hover:text-red-300 transition-colors" title="Remover Item">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="pt-3 mt-3 border-t border-white/10 flex items-center justify-between">
        <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Valor Total</span>
        <span className="text-sm font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
          R$ {totalValue.toLocaleString('pt-BR')}
        </span>
      </div>

      <div className="pt-3 space-y-2">
        {!isAddingCustom ? (
          <div className="flex gap-2 overflow-hidden min-w-0">
            <select 
              onChange={handleAddCatalog} 
              disabled={loading || availableCatalog.length === 0}
              defaultValue=""
              className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-zinc-300 focus:outline-none appearance-none cursor-pointer hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              <option value="" disabled>+ Adicionar Produto</option>
              {availableCatalog.map(p => (
                <option key={p.id} value={p.id}>{p.name} - R$ {p.price}</option>
              ))}
            </select>
            <button 
              onClick={() => setIsAddingCustom(true)}
              className="px-2 py-1.5 bg-black/40 border border-white/10 hover:bg-white/5 rounded-lg text-[11px] text-zinc-300 transition-colors flex items-center justify-center gap-1 min-w-0 whitespace-nowrap overflow-hidden text-ellipsis"
              title="Item Personalizado ou Desconto"
            >
              <Plus className="w-3 h-3 flex-shrink-0" /> <span className="truncate hidden sm:inline">Item Avulso</span><span className="sm:hidden">Item</span>
            </button>
          </div>
        ) : (
          <div className="p-3 bg-black/30 border border-white/10 rounded-lg space-y-2 animate-in fade-in zoom-in-95 duration-200">
            <input 
              type="text" 
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              placeholder="Nome do item (ex: Integração, Desconto)"
              className="w-full bg-black border border-white/20 rounded-md px-2 py-1.5 text-xs text-white focus:outline-none"
            />
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-2 top-1.5 text-xs text-zinc-500">R$</span>
                <input 
                  type="number" 
                  value={customPrice}
                  onChange={e => setCustomPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-black border border-white/20 rounded-md pl-6 pr-2 py-1.5 text-xs text-white focus:outline-none"
                />
              </div>
              <button onClick={handleAddCustom} disabled={loading || !customName.trim()} className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] uppercase tracking-wider rounded-md transition-colors disabled:opacity-50">
                Salvar
              </button>
              <button onClick={() => setIsAddingCustom(false)} className="px-2 py-1.5 text-zinc-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
