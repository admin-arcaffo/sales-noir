import type { Metadata } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs';
import Script from 'next/script';
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
});

import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  metadataBase: new URL('https://sales.arcaffo.com'),
  title: {
    default: "Sales Arcaffo | Intelligence Co-pilot",
    template: "%s | Sales Arcaffo"
  },
  description: "O assistente definitivo de vendas e negociações para WhatsApp Business. Maximize suas conversões com nossa inteligência.",
  keywords: ["CRM", "WhatsApp Business", "Vendas", "Automação", "Co-pilot", "Sales Arcaffo", "Arcaffo"],
  authors: [{ name: "Arcaffo Team" }],
  creator: "Arcaffo",
  publisher: "Arcaffo",
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://sales.arcaffo.com',
    title: 'Sales Arcaffo | Seu Copiloto de Vendas',
    description: 'Acelere suas vendas no WhatsApp Business com nosso assistente de inteligência e crm compartilhado.',
    siteName: 'Sales Arcaffo',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sales Arcaffo | Intelligence Co-pilot',
    description: 'Assistente de negociação e vendas para WhatsApp Business.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
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
        suppressHydrationWarning
      >
        <head>
          <link rel="preconnect" href="https://clerk.sales.arcaffo.com" crossOrigin="anonymous" />
          <link rel="dns-prefetch" href="https://clerk.sales.arcaffo.com" />
          <link rel="preconnect" href="https://img.clerk.com" crossOrigin="anonymous" />
          <Script id="theme-script" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: `
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
        <body className="min-h-full flex flex-col">
          <ToastProvider>
            {children}
          </ToastProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

