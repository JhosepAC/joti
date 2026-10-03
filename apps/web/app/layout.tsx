import type { Metadata } from "next";
import { Inter, Varela_Round } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "@/providers/convex-provider";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
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
    <html lang="en" className={`${inter.variable} ${varelaRound.variable}`}>
      <body className="font-sans bg-background text-text-primary antialiased">
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
