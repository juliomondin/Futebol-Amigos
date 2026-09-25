import type { Metadata } from "next";
import { Oswald, Outfit } from "next/font/google";
import { connection } from "next/server";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const oswald = Oswald({
  subsets: ["latin"],
  variable: "--font-oswald",
});

export const metadata: Metadata = {
  title: {
    default: "Futebol & Amigos",
    template: "%s · Futebol & Amigos",
  },
  description:
    "Lista de chegada do futebol. Os 10 primeiros jogam a primeira partida, e quem não paga fica devedor.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await connection();

  return (
    <html lang="pt-BR" className={`${outfit.variable} ${oswald.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
