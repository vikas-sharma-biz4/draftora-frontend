"use client";

import { Toaster } from "sonner";

export default function ToastProvider(): JSX.Element {
  return (
    <Toaster
      position="top-right"
      richColors
      toastOptions={{
        style: {
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
        },
      }}
    />
  );
}
