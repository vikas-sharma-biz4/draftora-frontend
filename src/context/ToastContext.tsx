"use client";

/**
 * ToastContext
 *
 * Thin wrapper around Sonner that provides a stable context API
 * for triggering toasts anywhere in the tree without importing
 * Sonner directly in every consumer.
 *
 * Usage:
 *   const { success, error } = useToast();
 *   success("Client created!");
 */

import React, { createContext, useContext } from "react";
import { toast } from "@/utils/toast";

interface ToastContextValue {
  success: (message: string, description?: string) => void;
  error:   (message: string, description?: string) => void;
  warning: (message: string, description?: string) => void;
  info:    (message: string, description?: string) => void;
  dismiss: (id?: string | number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastContextProvider({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  const value: ToastContextValue = {
    success: (message, description) => toast.success(message, description),
    error:   (message, description) => toast.error(message, description),
    warning: (message, description) => toast.warning(message, description),
    info:    (message, description) => toast.info(message, description),
    dismiss: (id) => toast.dismiss(id),
  };

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastContextProvider");
  return ctx;
}
