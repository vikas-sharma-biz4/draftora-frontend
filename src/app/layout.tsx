import type { Metadata } from "next";
import "./globals.scss";
import { ProposalProvider } from "@/context/ProposalContext";
import ErrorBoundary from "@/components/shared/ErrorBoundary";
import ToastProvider from "@/components/shared/ToastProvider";

export const metadata: Metadata = {
  title: "Proposely — AI Proposal Generator",
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
