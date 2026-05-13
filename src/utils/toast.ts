/**
 * Centralised toast wrapper around Sonner
 *
 * Import from here instead of directly from "sonner" so the provider
 * can be swapped in one place if needed.
 */

import { toast as sonnerToast } from "sonner";

export const toast = {
  success: (message: string, description?: string): void => {
    sonnerToast.success(message, { description });
  },

  error: (message: string, description?: string): void => {
    sonnerToast.error(message, { description });
  },

  warning: (message: string, description?: string): void => {
    sonnerToast.warning(message, { description });
  },

  info: (message: string, description?: string): void => {
    sonnerToast.info(message, { description });
  },

  loading: (message: string): string | number => {
    return sonnerToast.loading(message);
  },

  dismiss: (id?: string | number): void => {
    sonnerToast.dismiss(id);
  },

  promise: <T>(
    promise: Promise<T>,
    messages: { loading: string; success: string; error: string }
  ): Promise<T> => {
    sonnerToast.promise(promise, messages);
    return promise;
  },
};
