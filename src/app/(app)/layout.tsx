import { redirect } from "next/navigation";
import { checkSubscriptionStatus } from "@/lib/workspace";
import { AppSidebar } from "./_components/AppSidebar";
import { FloatingChatProvider } from "@/context/FloatingChatContext";
import { FloatingChatPopup } from "./_components/FloatingChatPopup";
import { BottomNav } from "./_components/BottomNav";
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const subStatus = await checkSubscriptionStatus();

  if (subStatus.status === "unpaid" || subStatus.status === "expired") {
    redirect("/checkout");
  }

  return (
    <FloatingChatProvider>
      <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans relative">
        <AppSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          {subStatus.status === "active" && !subStatus.isBypass && subStatus.daysRemaining <= 5 && subStatus.workspace?.role === "owner" && (
            <div className="bg-amber-600 text-white text-center py-2 px-4 text-sm font-medium animate-pulse flex items-center justify-center gap-2 z-50">
              <span>⚠️</span>
              <span>
                {subStatus.daysRemaining < 0 
                  ? `Sua assinatura expirou. Você está no período de tolerância (${5 + subStatus.daysRemaining} dias restantes). Regularize seu pagamento para não perder o acesso.`
                  : subStatus.daysRemaining === 0
                  ? `Sua assinatura vence hoje! Regularize seu pagamento para continuar acessando o painel.`
                  : `Sua assinatura vence em ${subStatus.daysRemaining} ${subStatus.daysRemaining === 1 ? 'dia' : 'dias'}.`}
              </span>
              <a href="/checkout" className="underline font-bold ml-2 hover:text-amber-100">
                Pagar Agora
              </a>
            </div>
          )}
          <main className="flex-1 overflow-hidden relative pb-[60px] md:pb-0">
            {children}
            <FloatingChatPopup />
          </main>
          <BottomNav />
        </div>
      </div>
    </FloatingChatProvider>
  );
}
