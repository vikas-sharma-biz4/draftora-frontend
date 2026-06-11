"use client";

import { Toaster } from "sonner";
import { useEffect } from "react";

export default function ToastProvider(): JSX.Element {
  useEffect(() => {
    const moveButtonToRight = () => {
      const toasts = document.querySelectorAll("[data-sonner-toast]");
      toasts.forEach((toast) => {
        if (toast instanceof HTMLElement) {
          // Ensure parent has relative positioning
          toast.style.position = "relative";
        }

        const button = toast.querySelector("button");
        if (button instanceof HTMLElement) {
          button.style.position = "absolute";
          button.style.right = "4px";
          button.style.left = "auto";
          button.style.top = "4px";
          button.style.transform = "none";
        }
      });
    };

    // Initial check
    moveButtonToRight();

    // Watch for new toasts being added
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes) {
          moveButtonToRight();
        }
      });
    });

    // Start observing the document body for changes
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      duration={1000}
      toastOptions={{
        style: {
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
        },
        classNames: {
          toast: "toast-item",
          closeButton: "toast-close-button",
        },
      }}
    />
  );
}
