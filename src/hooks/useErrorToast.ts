import { useEffect } from "react";
import { toast } from "@/utils/toast";

/**
 * Shows a toast error message whenever `error` becomes truthy.
 * Eliminates the repeated `useEffect(() => { if (error) toast.error(...) }, [error])` pattern.
 */
export function useErrorToast(error: string | null | undefined, message: string): void {
  useEffect(() => {
    if (error) {
      toast.error(message);
    }
  }, [error, message]);
}
