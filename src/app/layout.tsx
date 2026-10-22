import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { ultimaAtualizacao } from "@/lib/consultas";
import { formatarDataHora } from "@/lib/formato";
import { RegistrarServiceWorker } from "@/components/RegistrarServiceWorker";
import { MenuConta } from "@/components/MenuConta";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Fiscaliza — acompanhe seus parlamentares", template: "%s · Fiscaliza" },
  description: "Presença, votações, projetos e gastos de deputados federais e senadores, com dados públicos oficiais.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Fiscaliza", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f5" },
    { media: "(prefers-color-scheme: dark)", color: "#121211" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Sem banco (build sem acesso, falha momentânea, banco lento), a página sai sem a data em vez de quebrar ou travar.
  const atualizado = await Promise.race([
    ultimaAtualizacao().catch(() => null),
    new Promise<null>((r) => setTimeout(() => r(null), 5000)),
  ]);
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh antialiased">
        <RegistrarServiceWorker />
        <a
          href="#conteudo"
          className="sr-only z-20 rounded-lg bg-destaque px-3 py-2 text-sm font-medium text-fundo focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:px-3 focus:py-2"
        >
          Pular para o conteúdo
        </a>
        <header className="sticky top-0 z-10 border-b border-borda bg-fundo/90 backdrop-blur">
          <nav className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3 text-sm">
            <Link href="/" className="text-base font-semibold tracking-tight">
              Fiscaliza
            </Link>
            <Link href="/buscar" className="text-suave hover:text-texto">
              Buscar
            </Link>
            <MenuConta />
          </nav>
        </header>
        <main id="conteudo" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-6 outline-none">
          {children}
        </main>
        <footer className="mx-auto max-w-5xl px-4 pb-10 pt-4 text-xs text-suave">
          Dados públicos da{" "}
          <a className="underline" href="https://dadosabertos.camara.leg.br">
            Câmara dos Deputados
          </a>
          , do{" "}
          <a className="underline" href="https://legis.senado.leg.br/dadosabertos">
            Senado Federal
          </a>{" "}
          e do{" "}
          <a className="underline" href="https://dadosabertos.tse.jus.br">
            TSE
          </a>
          .{atualizado && <> Atualizado em {formatarDataHora(atualizado)}.</>}{" "}
          <Link href="/metodologia" className="underline">
            Metodologia
          </Link>{" "}
          ·{" "}
          <Link href="/status" className="underline">
            Status
          </Link>
        </footer>
      </body>
    </html>
  );
}
