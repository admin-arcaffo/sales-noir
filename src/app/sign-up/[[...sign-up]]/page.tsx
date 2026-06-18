import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/[0.02] rounded-full blur-3xl pointer-events-none" />
      
      <div className="relative z-10 flex flex-col items-center gap-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Sales Noir</h1>
          <p className="text-sm text-zinc-500">Crie sua conta</p>
        </div>
        <SignUp
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "bg-[#0c0c0e] border border-white/[0.06] shadow-2xl",
              headerTitle: "text-zinc-100",
              headerSubtitle: "text-zinc-500",
              socialButtonsBlockButton: "bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10",
              formFieldLabel: "text-zinc-400",
              formFieldInput: "bg-white/5 border-white/10 text-zinc-200",
              footerActionLink: "text-zinc-400 hover:text-zinc-200",
              formButtonPrimary: "bg-white text-black hover:bg-zinc-200",
            },
          }}
        />
      </div>
    </div>
  );
}
