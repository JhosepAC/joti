import type { Metadata } from "next";
import { Lato, Varela_Round } from "next/font/google";
import "./globals.css";

const lato = Lato({
  subsets: ["latin"],
  weight: ["100", "300", "400", "700", "900"],
  style: ["normal", "italic"],
  variable: "--font-lato",
  display: "swap",
});

const varelaRound = Varela_Round({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-varela-round",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Joti",
  description: "Joti Web Application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${lato.variable} ${varelaRound.variable}`}>
      <body className="font-sans bg-background text-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
