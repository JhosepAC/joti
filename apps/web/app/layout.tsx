import type { Metadata } from "next";
import { Inter, Varela_Round } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return {
    title: t("app.title"),
    description: t("app.description"),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} className={`${inter.variable} ${varelaRound.variable}`}>
      <body className="font-sans bg-background text-text-primary antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
