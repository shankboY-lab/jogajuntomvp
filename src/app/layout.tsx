import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: {
    default: "JogaJunto — encontre quem joga perto de você",
    template: "%s · JogaJunto",
  },
  description:
    "Pareador de jogos de tabuleiro: encontre pessoas perto de você que querem jogar os mesmos jogos.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FDF8F3",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh bg-cream text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
