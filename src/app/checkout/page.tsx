"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  CheckCheck, 
  CreditCard, 
  Copy, 
  ArrowLeft, 
  Timer, 
  ChevronRight, 
  ShieldCheck, 
  BrainCircuit, 
  Clock, 
  Loader2,
  Lock,
  Smartphone,
  AlertTriangle
} from "lucide-react";
import { registerPendingPayment } from "@/actions/crm";
import { 
  createAsaasPixPayment, 
  createAsaasCardPayment, 
  checkAsaasPaymentStatus 
} from "@/actions/payments";

// Premium Minimalist Card with Border Highlights
function GlowCard({ 
  children, 
  className = "", 
  glowColor = "rgba(255, 255, 255, 0.03)" 
}: { 
  children: React.ReactNode; 
  className?: string; 
  glowColor?: string;
}) {
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCoords({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  return (
    <div 
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative p-[1px] rounded bg-zinc-900/60 border border-zinc-800/80 transition-all duration-300 hover:border-zinc-700/80 ${className}`}
    >
      <div 
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(180px circle at ${coords.x}px ${coords.y}px, ${glowColor}, transparent 70%)`
        }}
      />
      <div className="relative z-10 w-full h-full rounded bg-[#09090b] p-6 flex flex-col justify-between">
        {children}
      </div>
    </div>
  );
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planParam = searchParams.get("plan") || "mensal";

  // Form states
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [taxId, setTaxId] = useState(""); // CPF/CNPJ

  // Pricing & Cycle states
  const [plan, setPlan] = useState<"mensal" | "anual">(planParam === "anual" ? "anual" : "mensal");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "pix">("card");

  // Card form states
  const [cardNum, setCardNum] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cvvFocused, setCvvFocused] = useState(false);

  // Pix integration states
  const [pixGenerated, setPixGenerated] = useState(false);
  const [pixKeyCopied, setPixKeyCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(900); // 15 mins
  const [pixStatusText, setPixStatusText] = useState("Aguardando pagamento...");
  const [pixQrCode, setPixQrCode] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [paymentId, setPaymentId] = useState("");

  // Processing, Mode & Success states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successState, setSuccessState] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isMockMode, setIsMockMode] = useState(false);

  // Dynamic Prices
  const getPrices = () => {
    if (plan === "mensal") {
      return {
        unit: "R$ 109,90",
        total: "R$ 109,90",
        description: "Assinatura Mensal recorrente",
        subtotal: 109.90,
        discount: 0,
        final: 109.90,
        label: "Plano Mensal"
      };
    } else {
      // Annual
      if (paymentMethod === "pix") {
        return {
          unit: "R$ 87,92",
          total: "R$ 1.055,04",
          description: "Pagamento à vista via Pix (20% OFF)",
          subtotal: 1318.80,
          discount: 263.76,
          final: 1055.04,
          label: "Plano Anual (Pix)"
        };
      } else {
        return {
          unit: "R$ 109,90",
          total: "R$ 1.318,80",
          description: "Plano Anual em até 12x sem juros",
          subtotal: 1318.80,
          discount: 0,
          final: 1318.80,
          label: "Plano Anual (Cartão)"
        };
      }
    }
  };

  const prices = getPrices();

  // Force card payment method for monthly plan (Pix is annual only)
  useEffect(() => {
    if (plan === "mensal") {
      setPaymentMethod("card");
      setPixGenerated(false);
    }
  }, [plan]);

  // Pix timer countdown
  useEffect(() => {
    if (!pixGenerated || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [pixGenerated, timeLeft]);

  // Pix success trigger for Mock Mode (5 seconds after generation)
  useEffect(() => {
    if (!pixGenerated || !isMockMode) return;
    
    const checkTimer = setTimeout(() => {
      setPixStatusText("Pagamento confirmado (Simulador)!");
      handlePaymentSuccess();
    }, 5000);

    return () => clearTimeout(checkTimer);
  }, [pixGenerated, isMockMode]);

  // Real Pix Payment Polling Status
  useEffect(() => {
    if (!pixGenerated || !paymentId || isMockMode) return;

    let isSubscribed = true;
    const interval = setInterval(async () => {
      try {
        const res = await checkAsaasPaymentStatus(paymentId, email, plan);
        if (res.success && res.paid && isSubscribed) {
          clearInterval(interval);
          setPixStatusText("Pagamento confirmado!");
          setSuccessState(true);
          setTimeout(() => {
            router.push(`/sign-up?email=${encodeURIComponent(email.toLowerCase().trim())}`);
          }, 2500);
        }
      } catch (err) {
        console.error("Erro ao verificar status de pagamento Pix:", err);
      }
    }, 4000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [pixGenerated, paymentId, isMockMode, email, plan]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Card Formatter helpers
  const handleCardNumChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 16);
    const formatted = value.replace(/(\d{4})(?=\d)/g, "$1 ");
    setCardNum(formatted);
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 4);
    const formatted = value.length > 2 ? `${value.slice(0, 2)}/${value.slice(2)}` : value;
    setCardExpiry(formatted);
  };

  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 4);
    setCardCvv(value);
  };

  const handlePixCopy = () => {
    const keyToCopy = pixKey || "00020126580014br.gov.bcb.pix0136salesarcaffo-payment-key-guid-1234-5678-90ab52040000530398654071055.045802BR5914Sales Arcaffo6009Sao Paulo62070503***6304d3e8";
    navigator.clipboard.writeText(keyToCopy);
    setPixKeyCopied(true);
    setTimeout(() => setPixKeyCopied(false), 2000);
  };

  // Main payment processing action
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !name.trim() || !taxId.trim()) {
      setErrorMsg("Por favor, preencha todos os dados cadastrais.");
      return;
    }

    if (paymentMethod === "card") {
      if (cardNum.length < 19 || !cardName || cardExpiry.length < 5 || cardCvv.length < 3) {
        setErrorMsg("Por favor, preencha os dados do cartão de crédito corretamente.");
        return;
      }
      
      setIsSubmitting(true);
      setErrorMsg(null);

      try {
        const res = await createAsaasCardPayment({
          email,
          name,
          cpfCnpj: taxId,
          plan,
          cardNum,
          cardName,
          cardExpiry,
          cardCvv
        });

        if (res.success) {
          // Real Card payment succeeded
          setIsMockMode(false);
          await handlePaymentSuccess();
        } else {
          // Check if error is due to missing Asaas key, fall back to mock
          if (res.error?.includes("Asaas API key is not configured")) {
            console.warn("Asaas API key not found. Running card in mock simulation mode.");
            setIsMockMode(true);
            await new Promise(resolve => setTimeout(resolve, 2000));
            await handlePaymentSuccess();
          } else {
            setErrorMsg(res.error || "Ocorreu um erro ao processar o cartão.");
            setIsSubmitting(false);
          }
        }
      } catch (err: any) {
        setErrorMsg("Erro ao conectar com o servidor. Tente novamente.");
        setIsSubmitting(false);
      }
    } else {
      // Pix Method
      setIsSubmitting(true);
      setErrorMsg(null);

      try {
        const res = await createAsaasPixPayment({
          email,
          name,
          cpfCnpj: taxId,
          plan
        });

        if (res.success && res.qrCodeImage && res.pixKey) {
          // Real Pix payment created in Asaas
          setPixQrCode(res.qrCodeImage);
          setPixKey(res.pixKey);
          setPaymentId(res.paymentId || "");
          setIsMockMode(false);
          setPixGenerated(true);
        } else {
          // Fall back to Mock Pix
          if (res.error?.includes("Asaas API key is not configured")) {
            console.warn("Asaas API key not found. Running Pix in mock simulation mode.");
            setIsMockMode(true);
             setPixQrCode("");
            setPixKey("00020126580014br.gov.bcb.pix0136salesarcaffo-payment-key-guid-1234-5678-90ab52040000530398654071055.045802BR5914Sales Arcaffo6009Sao Paulo62070503***6304d3e8");
            setPixGenerated(true);
          } else {
            setErrorMsg(res.error || "Erro ao gerar cobrança Pix.");
          }
        }
      } catch (err) {
        setErrorMsg("Erro de comunicação ao gerar Pix.");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handlePaymentSuccess = async () => {
    try {
      setIsSubmitting(true);
      // Register paid log on database
      await registerPendingPayment(email, plan);
      setSuccessState(true);
      
      // Keep loader visual visible for a split second, then redirect to sign up
      setTimeout(() => {
        router.push(`/sign-up?email=${encodeURIComponent(email.toLowerCase().trim())}`);
      }, 2500);
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Ocorreu um erro ao atualizar seu cadastro no banco de dados.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#040406] text-zinc-200 font-sans relative overflow-x-hidden pb-12">
      {/* 3D Card styles block */}
      <style jsx global>{`
        .card-perspective {
          perspective: 1000px;
        }
        .card-inner {
          transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
          transform-style: preserve-3d;
        }
        .card-flipped {
          transform: rotateY(180deg);
        }
        .card-face {
          backface-visibility: hidden;
          position: absolute;
          width: 100%;
          height: 100%;
          top: 0;
          left: 0;
        }
        .card-back {
          transform: rotateY(180deg);
        }
      `}</style>

      {/* Structural Grid Background */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0c0c0f_1px,transparent_1px),linear-gradient(to_bottom,#0c0c0f_1px,transparent_1px)] bg-[size:5rem_5rem] opacity-35" />
      </div>

      <header className="relative z-40 border-b border-zinc-900 bg-[#040406]/90 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group text-zinc-500 hover:text-white transition-colors">
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Voltar</span>
        </Link>
        <div className="flex items-center gap-2.5">
          <BrainCircuit className="w-4 h-4 text-zinc-400" />
          <span className="font-extrabold text-xs tracking-widest uppercase">SALES ARCAFFO CHECKOUT</span>
        </div>
      </header>

      {/* Payment Success Overlay */}
      {successState && (
        <div className="fixed inset-0 bg-[#040406]/95 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-fade-in">
          <div className="max-w-sm w-full text-center space-y-5 border border-zinc-800 bg-[#09090b] p-8 rounded">
            <div className="w-16 h-16 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-300">
              <CheckCheck className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold tracking-tight text-white uppercase">Pagamento Confirmado</h2>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Sua ativação do plano <span className="text-white font-semibold">{prices.label}</span> foi processada com sucesso.
              </p>
            </div>
            <div className="p-3 bg-zinc-950 border border-zinc-900 rounded flex items-center justify-center gap-2.5">
              <Loader2 className="w-3.5 h-3.5 text-zinc-400 animate-spin" />
              <span className="text-[10px] text-zinc-500 font-mono">Redirecionando para criação de acesso...</span>
            </div>
          </div>
        </div>
      )}

      <main className="relative z-10 max-w-4xl mx-auto px-6 pt-12 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left column - Order Summary */}
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-zinc-550 font-mono text-[9px] tracking-widest uppercase">
              Resumo do Licenciamento
            </div>
            <h1 className="text-2xl font-light tracking-tight text-white">Ficha de Pedido</h1>
          </div>

          <GlowCard>
            <div className="space-y-6">
              {/* Plan Switcher / Cycle Toggle */}
              <div className="flex gap-2 p-1 bg-zinc-950 border border-zinc-900 rounded">
                <button
                  type="button"
                  onClick={() => {
                    setPlan("mensal");
                    setPixGenerated(false);
                  }}
                  className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded transition-all ${
                    plan === "mensal" 
                      ? "bg-zinc-900 border border-zinc-800 text-white" 
                      : "text-zinc-550 hover:text-zinc-400"
                  }`}
                >
                  Mensal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPlan("anual");
                    setPixGenerated(false);
                  }}
                  className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded transition-all relative ${
                    plan === "anual" 
                      ? "bg-zinc-900 border border-zinc-800 text-white" 
                      : "text-zinc-550 hover:text-zinc-400"
                  }`}
                >
                  Anual (20% OFF Pix)
                </button>
              </div>

              {/* Order line items */}
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                      Sales Arcaffo {plan === "mensal" ? "Mensal" : "Anual"}
                    </h3>
                    <p className="text-[10px] text-zinc-550 mt-0.5">Licenciamento de IA e copiloto tático</p>
                  </div>
                  <span className="text-xs font-bold text-zinc-300">
                    {plan === "mensal" ? "R$ 109,90/mês" : "R$ 1.318,80/ano"}
                  </span>
                </div>

                {/* Dynamic discounts */}
                {plan === "anual" && paymentMethod === "pix" && (
                  <div className="flex justify-between items-center text-[10px] text-zinc-300 bg-zinc-950 border border-zinc-900 p-2.5 rounded">
                    <span>Desconto Pix (20% OFF)</span>
                    <span className="font-bold">- R$ 263,76</span>
                  </div>
                )}

                <div className="border-t border-zinc-900 pt-4 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Total a pagar</span>
                  <span className="text-xl font-extrabold text-white">{prices.total}</span>
                </div>
                <p className="text-[9px] text-zinc-500 leading-normal text-right font-mono uppercase tracking-wider">
                  {prices.description}
                </p>
              </div>

              {/* Trust Badge */}
              <div className="border-t border-zinc-900 pt-4 space-y-3">
                <div className="flex items-center gap-2 text-[9px] text-zinc-500 font-mono uppercase tracking-widest">
                  <ShieldCheck className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span>Conexão Segura SSL/TLS</span>
                </div>
                <div className="flex items-center gap-2 text-[9px] text-zinc-500 font-mono uppercase tracking-widest">
                  <Lock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span>Processador Whitelabel homologado</span>
                </div>
              </div>
            </div>
          </GlowCard>
        </div>

        {/* Right column - Billing Details / Form */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Tabs for Payment Methods */}
          <div className="flex gap-4 border-b border-zinc-900 pb-2">
            <button
              type="button"
              onClick={() => {
                setPaymentMethod("card");
                setPixGenerated(false);
              }}
              className={`flex items-center gap-2 pb-2 text-[10px] font-bold uppercase tracking-wider border-b transition-all ${
                paymentMethod === "card"
                  ? "border-zinc-400 text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              Cartão de Crédito
            </button>
            {plan === "anual" && (
              <button
                type="button"
                onClick={() => {
                  setPaymentMethod("pix");
                  setPixGenerated(false);
                }}
                className={`flex items-center gap-2 pb-2 text-[10px] font-bold uppercase tracking-wider border-b transition-all ${
                  paymentMethod === "pix"
                    ? "border-zinc-400 text-white"
                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                Pix (20% OFF)
              </button>
            )}
          </div>

          {isMockMode && (
            <div className="p-3 bg-zinc-950 border border-zinc-900 text-zinc-400 text-[10px] font-mono uppercase tracking-widest rounded flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span>Modo Sandbox Ativo (Simulação)</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-950/15 border border-red-900/30 text-red-400 text-[10px] font-mono uppercase tracking-wider rounded">
              {errorMsg}
            </div>
          )}

          {/* If Pix and generated, show QR Code view */}
          {paymentMethod === "pix" && pixGenerated ? (
            <GlowCard>
              <div className="space-y-6 text-center flex flex-col items-center">
                <div className="space-y-2">
                  <span className="text-[8px] font-mono text-zinc-500 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-900 inline-block uppercase tracking-widest">
                    QR CODE PIX ATIVO
                  </span>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Escaneie o código dinâmico</h3>
                  <p className="text-[10px] text-zinc-500 max-w-xs mx-auto leading-normal">
                    Aponte o celular ou copie o código Pix copia e cola abaixo para processamento automático.
                  </p>
                </div>

                {/* QR Code box */}
                <div className="p-3 bg-zinc-900 border border-zinc-800 rounded w-44 h-44 flex items-center justify-center shadow-lg">
                  {pixQrCode ? (
                    <img 
                      src={`data:image/png;base64,${pixQrCode}`} 
                      alt="Pix QR Code" 
                      className="w-36 h-36 object-contain"
                    />
                  ) : (
                    /* Fallback Mock QR Code */
                    <div className="w-36 h-36 grid grid-cols-5 gap-1 opacity-60">
                      <div className="bg-white rounded" />
                      <div className="bg-white rounded" />
                      <div className="border-4 border-white rounded" />
                      <div className="bg-white rounded" />
                      <div className="bg-white rounded" />
                      <div className="bg-white rounded" />
                      <div className="border-4 border-white rounded" />
                      <div className="bg-white rounded" />
                      <div className="bg-white rounded" />
                      <div className="border-4 border-white rounded" />
                      <div className="bg-white rounded" />
                      <div className="bg-white rounded" />
                      <div className="bg-white rounded" />
                      <div className="bg-white rounded" />
                      <div className="border-4 border-white rounded" />
                      <div className="border-4 border-white rounded" />
                      <div className="bg-white rounded" />
                      <div className="bg-white rounded" />
                      <div className="border-4 border-white rounded" />
                      <div className="bg-white rounded" />
                      <div className="bg-white rounded" />
                      <div className="border-4 border-white rounded" />
                      <div className="bg-white rounded" />
                      <div className="bg-white rounded" />
                      <div className="bg-white rounded" />
                    </div>
                  )}
                </div>

                {/* Pix copy code area */}
                <div className="w-full space-y-3">
                  <button
                    type="button"
                    onClick={handlePixCopy}
                    className="w-full py-2.5 px-4 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-350 hover:text-white rounded text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                  >
                    {pixKeyCopied ? (
                      <>
                        <CheckCheck className="w-3.5 h-3.5 text-zinc-400" />
                        Código Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-zinc-500" />
                        Copiar Código Pix
                      </>
                    )}
                  </button>
                  
                  <div className="flex justify-between items-center text-[10px] text-zinc-500 bg-zinc-950 border border-zinc-900 p-2.5 rounded">
                    <div className="flex items-center gap-2 font-mono uppercase tracking-widest text-[9px]">
                      <Clock className="w-3.5 h-3.5 text-zinc-650 shrink-0" />
                      <span>Expiração</span>
                    </div>
                    <span className="font-mono font-bold text-zinc-400">{formatTime(timeLeft)}</span>
                  </div>
                </div>

                <div className="border-t border-zinc-900 pt-3.5 w-full flex items-center justify-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-zinc-500 animate-spin" />
                  <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono">{pixStatusText}</span>
                </div>
              </div>
            </GlowCard>
          ) : (
            /* Otherwise show input details form */
            <form onSubmit={handlePaymentSubmit} className="space-y-6">
              <GlowCard>
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">Dados Cadastrais</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider">Nome Completo</label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Ex: Arthur Fava"
                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-zinc-700 transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider">CPF ou CNPJ</label>
                      <input
                        type="text"
                        required
                        value={taxId}
                        onChange={e => setTaxId(e.target.value)}
                        placeholder="Ex: 000.000.000-00"
                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-zinc-700 transition-all font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider">E-mail de Cadastro</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="seu-email@exemplo.com"
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-zinc-700 transition-all"
                    />
                    <p className="text-[8px] text-zinc-600 font-mono uppercase tracking-wider">
                      Nota: Este e-mail receberá a credencial de login após a aprovação.
                    </p>
                  </div>
                </div>
              </GlowCard>

              {/* Billing Specific Forms */}
              {paymentMethod === "card" && (
                <div className="space-y-6">
                  {/* Premium 3D Card Display */}
                  <div className="flex justify-center py-2">
                    <div className="card-perspective w-full max-w-[320px] aspect-[1.586/1] relative">
                      <div className={`card-inner w-full h-full relative rounded shadow-2xl ${cvvFocused ? "card-flipped" : ""}`}>
                        
                        {/* Front Side - Steel Plate design */}
                        <div className="card-face card-front bg-gradient-to-br from-zinc-900 via-zinc-950 to-black border border-zinc-800 rounded p-5 flex flex-col justify-between text-white overflow-hidden shadow-inner">
                          <div className="flex justify-between items-start">
                            <div className="space-y-0.5">
                              <span className="text-[7.5px] font-mono text-zinc-500 block tracking-widest uppercase">SALES ARCAFFO SYSTEMS</span>
                              <span className="text-[10px] font-bold text-zinc-350 tracking-wider">OPERATIONAL KEY</span>
                            </div>
                            <div className="w-7 h-7 rounded bg-zinc-950 border border-zinc-850 flex items-center justify-center">
                              <BrainCircuit className="w-3.5 h-3.5 text-zinc-400" />
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="text-sm font-mono tracking-widest text-zinc-200">
                              {cardNum || "•••• •••• •••• ••••"}
                            </div>

                            <div className="flex justify-between items-end">
                              <div>
                                <span className="text-[6.5px] text-zinc-550 uppercase block tracking-widest font-mono">Titular</span>
                                <div className="text-[10px] font-mono tracking-wide truncate max-w-[170px]">
                                  {cardName.toUpperCase() || "NOME IMPRESSO"}
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-[6.5px] text-zinc-555 uppercase block tracking-widest font-mono">Validade</span>
                                <span className="text-[10px] font-mono tracking-wide">{cardExpiry || "MM/YY"}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Back Side */}
                        <div className="card-face card-back bg-[#08080a] border border-zinc-800 rounded py-5 flex flex-col justify-between text-white overflow-hidden shadow-2xl">
                          <div className="h-8 w-full bg-zinc-950 mt-1" />
                          
                          <div className="px-5 flex justify-between items-center gap-4">
                            <div className="flex-1 h-7 bg-zinc-900 border border-zinc-850 rounded flex items-center justify-end px-3 text-[9px] text-zinc-650 italic font-mono select-none">
                              Sales Arcaffo Partner
                            </div>
                            <div className="w-12 h-7 bg-zinc-100 text-black font-mono flex items-center justify-center rounded font-bold text-xs tracking-wider">
                              {cardCvv || "•••"}
                            </div>
                          </div>

                          <div className="px-5">
                            <p className="text-[5.5px] text-zinc-600 text-center leading-normal font-mono uppercase tracking-widest">
                              TRANSAÇÃO INVISÍVEL PROTOCOLO TLS 1.3
                            </p>
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>

                  {/* Card details inputs */}
                  <GlowCard>
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">Dados do Cartão</h3>
                      
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider">Número do Cartão</label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            value={cardNum}
                            onChange={handleCardNumChange}
                            placeholder="0000 0000 0000 0000"
                            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-zinc-700 transition-all font-mono"
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600">
                            <CreditCard className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider">Nome no Cartão</label>
                        <input
                          type="text"
                          required
                          value={cardName}
                          onChange={e => setCardName(e.target.value)}
                          placeholder="EX: ARTHUR FAVA"
                          className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-zinc-700 transition-all font-mono"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider">Validade (MM/AA)</label>
                          <input
                            type="text"
                            required
                            value={cardExpiry}
                            onChange={handleExpiryChange}
                            placeholder="MM/AA"
                            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-zinc-700 transition-all font-mono"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider">CVV</label>
                          <input
                            type="text"
                            required
                            value={cardCvv}
                            onChange={handleCvvChange}
                            onFocus={() => setCvvFocused(true)}
                            onBlur={() => setCvvFocused(false)}
                            placeholder="000"
                            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-zinc-700 transition-all font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </GlowCard>
                </div>
              )}

              {/* Submit button for inputs */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-zinc-100 hover:bg-white text-black rounded text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 shadow-lg"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                    <span>Processando Ativação...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span>{paymentMethod === "card" ? "Ativar Plano Seguramente" : "Gerar Link Pix"}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                )}
              </button>
            </form>
          )}

        </div>

      </main>

      {/* Footer info */}
      <footer className="relative z-10 text-center text-[9px] text-zinc-650 mt-16 max-w-4xl mx-auto px-6 border-t border-zinc-900 pt-8 uppercase tracking-wider font-mono">
        <p>© 2026 Sales Arcaffo. Em conformidade com o Banco Central do Brasil. Transações seguras.</p>
      </footer>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-[#040406] flex items-center justify-center p-6 text-zinc-200">
      <div className="flex flex-col items-center gap-2.5">
        <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
        <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Carregando Checkout...</span>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <CheckoutContent />
    </Suspense>
  );
}
