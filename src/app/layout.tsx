import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Painel de Entregas",
  description: "Acompanhamento de SLA e DS das operações de última milha",
};

// Evita "flash" de tema errado: roda antes da pintura e aplica a classe no <html>.
// Vai via next/script com strategy="beforeInteractive": o Next injeta o script no
// HTML inicial (fora da árvore reconciliada no cliente), então não dispara o aviso
// do React sobre <script> recriado no client render.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('theme');var ts=['light','dark','blue'];if(!t||ts.indexOf(t)<0)t='dark';var e=document.documentElement;e.classList.remove('light','dark','blue');e.classList.add(t);e.style.colorScheme=t==='light'?'light':'dark';}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT}
        </Script>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
