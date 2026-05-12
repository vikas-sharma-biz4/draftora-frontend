"use client";

import React from "react";

interface AuthLayoutProps {
  children: React.ReactNode;
}

/**
 * Layout for authentication pages (login, register, forgot-password).
 * No sidebar or app chrome — full-screen centred layout.
 */
export default function AuthLayout({ children }: AuthLayoutProps): JSX.Element {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-bg)",
      }}
    >
      {children}
    </div>
  );
}
