"use client";

import { useState, useEffect } from "react";
import { createWhatsAppInstance, getWhatsAppQrCode } from "@/actions/whatsapp";
import { Loader2, QrCode, RefreshCw, CheckCircle2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

export function WhatsAppQR({ currentStatus, instanceName, instanceToken, isActive }: { currentStatus: string, instanceName?: string | null, instanceToken?: string | null, isActive?: boolean }) {
  const { showToast } = useToast();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [status, setStatus] = useState(currentStatus);

  const handleStart = async () => {
    setIsLoading(true);
    try {
      const result = await createWhatsAppInstance();

      if ('error' in result) {
        showToast(result.error || "Erro desconhecido", "error");
        return;
      }

      const qr = await getWhatsAppQrCode(result.instanceName);

      if ('error' in qr) {
        showToast(qr.error || "Erro desconhecido", "error");
        return;
      }

      setQrCode(qr.base64);
      setStatus('QRCODE');
    } catch (error) {
      console.error(error);
      showToast("Ocorreu um erro inesperado ao tentar gerar o QR Code.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const refreshQr = async () => {
    if (!instanceName || !instanceToken) return;
    setIsLoading(true);
    try {
      const qr = await getWhatsAppQrCode(instanceName);

      if ('error' in qr) {
        showToast(qr.error || "Erro desconhecido", "error");
        return;
      }

      setQrCode(qr.base64);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async (deleteHistory = false) => {
    const confirmMsg = deleteHistory
      ? "Tem certeza que deseja desconectar o WhatsApp e EXCLUIR todo o histórico de conversas do sistema? Esta ação é irreversível."
      : "Tem certeza que deseja desconectar a conta do WhatsApp do sistema? Seu histórico de conversas locais será MANTIDO.";

    if (!confirm(confirmMsg)) {
      return;
    }
    
    setIsDisconnecting(true);
    try {
      const { disconnectWhatsApp } = await import("@/actions/whatsapp");
      const res = await disconnectWhatsApp(deleteHistory);
      if ('error' in res) {
        showToast(res.error || "Erro desconhecido", "error");
        return;
      }
      setStatus('DISCONNECTED');
      setQrCode(null);
      if (deleteHistory && typeof window !== "undefined") {
        localStorage.removeItem("sales_arcaffo_conversations");
        localStorage.removeItem("sales_arcaffo_last_sync_time");
      }
      showToast(deleteHistory ? "WhatsApp desconectado e histórico de conversas limpo!" : "WhatsApp desconectado!", "error");
      window.location.reload();
    } catch (e) {
      console.error(e);
      showToast("Falha ao desconectar.", "error");
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Poll for status changes while showing QR
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (status === 'QRCODE' || currentStatus !== 'CONNECTED') {
      interval = setInterval(async () => {
        try {
          const { getWhatsAppStatus } = await import("@/actions/whatsapp");
          const data = await getWhatsAppStatus();
          if (data?.status === 'CONNECTED') {
            setStatus('CONNECTED');
            clearInterval(interval);
            // Optionally reload the page to refresh all data globally
            window.location.reload();
          }
        } catch (e) {
          // Ignore polling errors
        }
      }, 3000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status, currentStatus]);

  if (status === 'CONNECTED') {
    return (
      <div className="flex flex-col items-center justify-center p-8 border border-emerald-500/20 bg-emerald-500/5 rounded gap-4">
        <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2">
            <h3 className="text-lg font-semibold text-zinc-100">WhatsApp Conectado</h3>
            {isActive ? (
              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 font-mono">Ativo</span>
            ) : (
              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-zinc-800 bg-zinc-900 text-zinc-500 font-mono">Inativo</span>
            )}
          </div>
          <p className="text-sm text-zinc-500">Sua instância está ativa e processando mensagens.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          <button
            onClick={() => handleDisconnect(false)}
            disabled={isDisconnecting}
            className="px-4 py-2 text-xs font-semibold text-zinc-300 border border-zinc-700 hover:border-zinc-500 bg-zinc-800/10 hover:bg-zinc-800/30 rounded transition-all cursor-pointer flex items-center gap-2"
          >
            Desconectar (Manter Histórico)
          </button>
          <button
            onClick={() => handleDisconnect(true)}
            disabled={isDisconnecting}
            className="px-4 py-2 text-xs font-semibold text-red-400 border border-red-500/20 hover:border-red-500 bg-red-950/10 hover:bg-red-950/30 rounded transition-all cursor-pointer flex items-center gap-2"
          >
            {isDisconnecting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              "Desconectar e Limpar Histórico"
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#09090b] border border-zinc-850 rounded p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center">
            <QrCode className="w-5 h-5 text-zinc-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-zinc-200">Conectar via QR Code</h3>
              {isActive ? (
                <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 font-mono">Ativo</span>
              ) : (
                <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-zinc-800 bg-zinc-900 text-zinc-500 font-mono">Inativo</span>
              )}
            </div>
            <p className="text-xs text-zinc-500">Escaneie o código para vincular seu WhatsApp</p>
          </div>
        </div>

        {qrCode && (
          <button
            onClick={refreshQr}
            className="p-2 hover:bg-zinc-850 rounded transition-colors"
            title="Atualizar QR Code"
          >
            <RefreshCw className={`w-4 h-4 text-zinc-500 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      <div className="flex flex-col items-center justify-center min-h-[300px] border border-dashed border-zinc-800 rounded bg-zinc-950/40 relative overflow-hidden">
        {!qrCode ? (
          <div className="text-center space-y-4 p-8">
            <p className="text-sm text-zinc-500 max-w-[240px] mx-auto">
              Clique no botão abaixo para gerar uma nova instância e o QR Code de conexão.
            </p>
            <button
              onClick={handleStart}
              disabled={isLoading}
              className="btn-noir mx-auto flex items-center gap-2 rounded text-sm"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Gerar QR Code"}
            </button>
          </div>
        ) : (
          <div className="p-4 bg-white rounded shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64" />
          </div>
        )}

        {isLoading && qrCode && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h4 className="text-[11px] uppercase tracking-wider text-zinc-500 font-bold">Instruções</h4>
        <ul className="text-xs text-zinc-500 space-y-2 list-decimal list-inside">
          <li>Abra o WhatsApp no seu celular</li>
          <li>Toque em <span className="text-zinc-300">Configurações</span> ou <span className="text-zinc-300">Menu</span></li>
          <li>Selecione <span className="text-zinc-300">Dispositivos Conectados</span></li>
          <li>Aponte a câmera para esta tela</li>
        </ul>
      </div>

      {instanceName && (
        <div className="pt-4 border-t border-zinc-800 flex flex-col items-center gap-2">
          <p className="text-xs text-zinc-500">Já existe uma instância configurada para esta organização ({instanceName}).</p>
          <div className="flex gap-4">
            <button
              onClick={() => handleDisconnect(false)}
              disabled={isDisconnecting}
              className="text-xs text-zinc-400 hover:text-zinc-300 underline cursor-pointer"
            >
              Resetar conexão do WhatsApp (mantém histórico)
            </button>
            <span className="text-zinc-700 text-xs">|</span>
            <button
              onClick={() => handleDisconnect(true)}
              disabled={isDisconnecting}
              className="text-xs text-red-400 hover:text-red-300 underline cursor-pointer"
            >
              Resetar e apagar histórico do sistema
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
