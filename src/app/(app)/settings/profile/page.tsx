"use client";

import { UserProfile } from "@clerk/nextjs";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { dark } from "@clerk/themes";

export default function ProfilePage() {
  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto">
      <div className="p-4 md:p-8 max-w-5xl mx-auto w-full space-y-6">
        <div className="flex items-center gap-4">
          <Link 
            href="/settings"
            className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight uppercase">Meu Perfil</h1>
            <p className="label-mono mt-1 text-muted-foreground">Gerenciamento de Conta</p>
          </div>
        </div>

        <div className="flex justify-center w-full">
          <UserProfile 
            routing="hash"
            appearance={{
              baseTheme: dark,
              elements: {
                rootBox: "w-full max-w-4xl mx-auto",
                card: "bg-card border-border w-full",
                navbar: "border-border",
                headerTitle: "text-foreground",
                headerSubtitle: "text-muted-foreground",
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
