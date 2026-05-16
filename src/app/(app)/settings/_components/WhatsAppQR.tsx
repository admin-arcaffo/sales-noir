"use client";

import { useState, useEffect } from "react";
import { createWhatsAppInstance, getWhatsAppQrCode } from "@/actions/whatsapp";
import { Loader2, QrCode, RefreshCw, CheckCircle2 } from "lucide-react";

export function WhatsAppQR({ currentStatus, instanceName, instanceToken }: { currentStatus: string, instanceName?: string | null, instanceToken?: string | null }) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState(currentStatus);

  const handleStart = async () => {
    setIsLoading(true);
    try {
      const result = await createWhatsAppInstance();

      if ('error' in result) {
        alert(result.error);
        return;
      }

      const qr = await getWhatsAppQrCode(result.instanceName);

      if ('error' in qr) {
        alert(qr.error);
        return;
      }

      setQrCode(qr.base64);
      setStatus('QRCODE');
    } catch (error) {
      console.error(error);
      alert("Ocorreu um erro inesperado ao tentar gerar o QR Code.");
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
        alert(qr.error);
        return;
      }

      setQrCode(qr.base64);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Poll for status changes while showing QR
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (status === 'QRCODE' || currentStatus !== 'CONNECTED') {
      interval = setInterval(async () => {
        try {
          const { getSettingsData } = await import("@/actions/crm");
          const data = await getSettingsData();
          if (data?.whatsappConnection?.status === 'CONNECTED') {
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
      <div className="flex flex-col items-center justify-center p-8 border border-emerald-500/20 bg-emerald-500/5 rounded-2xl gap-4">
        <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        <div className="text-center">
          <h3 className="text-lg font-semibold text-zinc-100">WhatsApp Conectado</h3>
          <p className="text-sm text-zinc-500">Sua instância está ativa e processando mensagens.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0c0c0e] border border-white/[0.06] rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <QrCode className="w-5 h-5 text-zinc-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-200">Conectar via QR Code</h3>
            <p className="text-xs text-zinc-500">Escaneie o código para vincular seu WhatsApp</p>
          </div>
        </div>

        {qrCode && (
          <button
            onClick={refreshQr}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            title="Atualizar QR Code"
          >
            <RefreshCw className={`w-4 h-4 text-zinc-500 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      <div className="flex flex-col items-center justify-center min-h-[300px] border border-dashed border-white/10 rounded-xl bg-black/20 relative overflow-hidden">
        {!qrCode ? (
          <div className="text-center space-y-4 p-8">
            <p className="text-sm text-zinc-500 max-w-[240px] mx-auto">
              Clique no botão abaixo para gerar uma nova instância e o QR Code de conexão.
            </p>
            <button
              onClick={handleStart}
              disabled={isLoading}
              className="px-6 py-2.5 bg-white text-black rounded-xl text-sm font-semibold hover:bg-zinc-200 transition-all flex items-center gap-2 mx-auto"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Gerar QR Code"}
            </button>
          </div>
        ) : (
          <div className="p-4 bg-white rounded-xl shadow-2xl">
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
    </div>
  );
}
