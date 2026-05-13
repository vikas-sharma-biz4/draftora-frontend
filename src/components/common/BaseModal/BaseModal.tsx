"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { createPortal } from "react-dom";

import styles from "./BaseModal.module.scss";

const FOCUSABLE_SELECTORS = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** ID of the element that labels the modal — wired to aria-labelledby */
  labelId?: string;
  /** ID of the element that describes the modal — wired to aria-describedby */
  descriptionId?: string;
  /** Whether clicking the backdrop closes the modal. Defaults to true. */
  closeOnOverlayClick?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  /** Extra class applied to the content panel */
  contentClassName?: string;
  children: React.ReactNode;
}

const SIZE_CLASS: Record<NonNullable<BaseModalProps["size"]>, string> = {
  sm: styles.contentSm,
  md: styles.contentMd,
  lg: styles.contentLg,
  xl: styles.contentXl,
};

/**
 * Base modal primitive.
 *
 * Provides: portal rendering, body-scroll lock, Escape-to-close,
 * tab-key focus trap, and ARIA dialog semantics.
 *
 * Children supply all visual content (header, body, footer).
 */
export default function BaseModal({
  isOpen,
  onClose,
  labelId,
  descriptionId,
  closeOnOverlayClick = true,
  size = "md",
  contentClassName,
  children,
}: BaseModalProps): JSX.Element | null {
  const [mounted, setMounted] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === "Tab" && contentRef.current) {
        const focusable = Array.from(
          contentRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last  = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const originalOverflow  = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    const frame = requestAnimationFrame(() => {
      const first = contentRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTORS);
      first?.focus();
    });

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previouslyFocused?.focus();
    };
  }, [isOpen, handleKeyDown]);

  if (!mounted || !isOpen) return null;

  const contentClasses = [
    styles.content,
    SIZE_CLASS[size],
    contentClassName,
  ]
    .filter(Boolean)
    .join(" ");

  return createPortal(
    <div
      className={styles.overlay}
      onClick={closeOnOverlayClick ? onClose : undefined}
    >
      <div
        ref={contentRef}
        className={contentClasses}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
