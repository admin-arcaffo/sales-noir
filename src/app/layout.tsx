import type { Metadata } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs';
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
});

export const metadata: Metadata = {
  title: "Sales Arcaffo | Intelligence Co-pilot",
  description: "Assistente de negociação e vendas para WhatsApp Business.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider domain={process.env.NEXT_PUBLIC_CLERK_DOMAIN || 'sales.arcaffo.com'}>
      <html
        lang="pt-BR"
        className={`${inter.variable} ${interTight.variable} h-full antialiased dark`}
      >
        <head>
          <link rel="preconnect" href="https://clerk.sales.arcaffo.com" crossOrigin="anonymous" />
          <link rel="dns-prefetch" href="https://clerk.sales.arcaffo.com" />
          <link rel="preconnect" href="https://img.clerk.com" crossOrigin="anonymous" />
          <script dangerouslySetInnerHTML={{ __html: `
            (function() {
              try {
                const theme = localStorage.getItem('theme') || 'dark';
                if (theme === 'light') {
                  document.documentElement.classList.add('light');
                  document.documentElement.classList.remove('dark');
                } else {
                  document.documentElement.classList.add('dark');
                  document.documentElement.classList.remove('light');
                }
              } catch (_) {}
            })()
          `}} />
        </head>
        <body className="min-h-full flex flex-col">{children}</body>
      </html>
    </ClerkProvider>
  );
}

