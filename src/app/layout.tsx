import type { Metadata } from "next";
import dynamic from "next/dynamic";
import "./globals.scss";
import { ProposalProvider } from "@/context/ProposalContext";

// Lazy load heavy components to reduce initial bundle size
const ErrorBoundary = dynamic(() => import("@/components/shared/ErrorBoundary"), {
  ssr: true,
});

const ToastProvider = dynamic(() => import("@/components/shared/ToastProvider"), {
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
    <html lang="en">
      <body suppressHydrationWarning>
        <ProposalProvider>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
          <ToastProvider />
        </ProposalProvider>
      </body>
    </html>
  );
}
