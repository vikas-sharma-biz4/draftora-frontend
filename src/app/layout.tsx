import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { DM_Sans, DM_Mono } from "next/font/google";
import "@/styles/styles.scss";
import { ProposalWizardProvider } from "@/context/ProposalWizardContext";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmMono.variable}`}>
      <body suppressHydrationWarning>
        <ProposalWizardProvider>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
          <ToastProvider />
        </ProposalWizardProvider>
      </body>
    </html>
  );
}
