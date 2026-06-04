import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Inter, JetBrains_Mono } from "next/font/google";
import "@/styles/styles.scss";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

// Lazy load heavy components to reduce initial bundle size
const ErrorBoundary = dynamic(() => import("@/components/common/ErrorBoundary"), {
  ssr: false,
});

const ToastProvider = dynamic(() => import("@/components/common/ToastProvider"), {
  ssr: false,
});

export const metadata: Metadata = {
  title: "Draftora — AI Proposal Generator",
  description: "Generate professional proposals powered by AI in minutes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body suppressHydrationWarning>
        <ErrorBoundary>{children}</ErrorBoundary>
        <ToastProvider />
      </body>
    </html>
  );
}
