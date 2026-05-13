/**
 * Root Layout - Redirects to locale-based layout
 *
 * This layout is now a redirect to the [locale] layout for i18n support.
 * The actual layout implementation has moved to src/app/[locale]/layout.tsx
 */

import { redirect } from "next/navigation";
import { defaultLocale } from "@/i18n/config";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  // Redirect to default locale
  redirect(`/${defaultLocale}`);
}
