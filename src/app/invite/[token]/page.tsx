"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { UserPlus, Loader2, CheckCircle2, LogIn } from "lucide-react";
import { acceptInvitation } from "@/actions/crm";
import { useAuth } from "@clerk/nextjs";

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error" | "auth_required">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const hasAttemptedRef = useRef(false);

  const token = params.token as string;

  useEffect(() => {
    if (isLoaded) {
      if (isSignedIn) {
        if (!hasAttemptedRef.current) {
          hasAttemptedRef.current = true;
          handleAccept();
        }
      } else {
        setStatus("auth_required");
      }
    }
  }, [isLoaded, isSignedIn]);

  const handleAccept = async () => {
    setStatus("loading");
    try {
      await acceptInvitation(token);
      setStatus("success");
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err.message || "Ocorreu um erro ao aceitar o convite.");
    }
  };

  const handleSignIn = () => {
    router.push(`/sign-in?redirect_url=/invite/${token}`);
  };

  const handleSignUp = () => {
    router.push(`/sign-up?redirect_url=/invite/${token}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <div className="w-full max-w-md bg-[#09090b] border border-zinc-800 rounded-2xl p-8 shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 rounded-full flex items-center justify-center mx-auto">
          {status === "loading" ? (
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
          ) : status === "success" ? (
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          ) : (
            <UserPlus className="w-8 h-8 text-indigo-400" />
          )}
        </div>

        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Convite de Equipe</h1>
          <p className="text-sm text-zinc-400">
            Você foi convidado para participar de uma organização no Dealeto.
          </p>
        </div>

        {status === "error" && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-400">
            {errorMsg}
          </div>
        )}

        {status === "success" && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-sm text-emerald-400">
            Convite aceito com sucesso! Entrando...
          </div>
        )}

        {status === "auth_required" && (
          <div className="space-y-3 pt-2">
            <button
              onClick={handleSignUp}
              className="w-full py-3 bg-white text-black hover:bg-zinc-200 rounded-xl font-bold transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Criar Conta para Aceitar
            </button>
            <button
              onClick={handleSignIn}
              className="w-full py-3 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white rounded-xl font-bold transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              Já tenho uma conta
            </button>
          </div>
        )}

        {(status === "idle" || status === "error") && (
          <button
            onClick={handleAccept}
            className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Tentar Novamente
          </button>
        )}
      </div>
    </div>
  );
}
