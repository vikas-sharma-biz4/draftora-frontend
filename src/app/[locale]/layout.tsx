import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { DM_Sans, DM_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import "@/styles/styles.scss";
import { ProposalProvider } from "@/context/ProposalContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { notFound } from "next/navigation";
import { locales } from "@/i18n/config";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

// Lazy load heavy components to reduce initial bundle size
const ErrorBoundary = dynamic(() => import("@/components/common/ErrorBoundary"), {
  ssr: true,
});

const ToastProvider = dynamic(() => import("@/components/common/ToastProvider"), {
  ssr: false,
});

export const metadata: Metadata = {
  title: "Draftora — AI Proposal Generator",
  description: "Generate professional proposals powered by AI in minutes.",
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}): Promise<JSX.Element> {
  // Ensure that the incoming `locale` is valid
  if (!locales.includes(locale as any)) {
    notFound();
  }

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${dmSans.variable} ${dmMono.variable}`}>
      <body suppressHydrationWarning>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            <ProposalProvider>
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
              <ToastProvider />
            </ProposalProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
