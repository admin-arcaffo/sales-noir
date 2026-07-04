"use client";

import { UserProfile } from "@clerk/nextjs";
import { ShieldCheck, User } from "lucide-react";

export default function AccountPage() {
  return (
    <div className="h-full overflow-y-auto bg-[#040406]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6 md:p-8">
        <header className="flex flex-col gap-3 border-b border-white/[0.06] pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold uppercase tracking-wider text-white">Minha Conta</h1>
              <p className="mt-1 text-xs text-zinc-500">Edite seus dados, segurança, e-mail e sessões pelo Clerk.</p>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs leading-relaxed text-emerald-200/80">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <span>
              Dados sensíveis como senha, e-mail principal, MFA e dispositivos conectados ficam centralizados no Clerk para manter a segurança da conta.
            </span>
          </div>
        </header>

        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0c0c0e] p-2 md:p-4">
          <UserProfile
            routing="hash"
            appearance={{
              elements: {
                rootBox: "w-full",
                cardBox: "w-full max-w-none shadow-none bg-transparent",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
