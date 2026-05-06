import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

interface UseRouteGuardOptions {
  enabled: boolean;
  onRouteChange: () => Promise<void>;
  blockNavigation?: boolean;
}

export function useRouteGuard(options: UseRouteGuardOptions): void {
  const { enabled, onRouteChange, blockNavigation = false } = options;
  const pathname = usePathname();
  const previousPathnameRef = useRef<string>(pathname);
  const isNavigatingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (pathname !== previousPathnameRef.current && !isNavigatingRef.current) {
      isNavigatingRef.current = true;

      onRouteChange()
        .then(() => {
          previousPathnameRef.current = pathname;
        })
        .catch((error) => {
          console.error("Route guard save failed:", error);
        })
        .finally(() => {
          isNavigatingRef.current = false;
        });
    }
  }, [pathname, enabled, onRouteChange]);

  useEffect(() => {
    if (!enabled || !blockNavigation) {
      return;
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent): string => {
      e.preventDefault();
      e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
      return e.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [enabled, blockNavigation]);
}
