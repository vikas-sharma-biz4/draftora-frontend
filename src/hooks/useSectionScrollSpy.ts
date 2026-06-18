"use client";

import { useCallback, useEffect, useRef } from "react";

interface UseSectionScrollSpyReturn {
  handleScrollToSection: (key: string) => void;
}

// px below the container's top edge that triggers a section switch.
// A small positive offset accounts for section headers having some padding.
const SCROLL_TRIGGER_OFFSET_PX = 80;

// Duration to suppress scroll-spy after a programmatic scroll so the
// observer doesn't override the user's intentional sidebar click.
const PROGRAMMATIC_SCROLL_SUPPRESSION_MS = 1_500;

/**
 * Tracks which proposal section is currently visible and provides
 * `handleScrollToSection` for sidebar-click navigation.
 *
 * Strategy: on every scroll event, find the section whose top edge has most
 * recently crossed the container's top edge (largest negative offset ≤
 * SCROLL_TRIGGER_OFFSET_PX). This correctly handles tall sections that
 * remain partially visible long after the reader has scrolled past them,
 * unlike an IntersectionObserver "smallest top" approach.
 */
export function useSectionScrollSpy(
  sectionKeys: string[] | undefined,
  mounted: boolean,
  activeSection: string | null,
  setActiveSection: (key: string) => void
): UseSectionScrollSpyReturn {
  const currentActiveSectionRef = useRef<string | null>(null);
  const isProgrammaticScrollRef = useRef<boolean>(false);
  const programmaticScrollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Keep ref in sync with active section driven by sidebar clicks (not scroll events).
  useEffect(() => {
    currentActiveSectionRef.current = activeSection;
  }, [activeSection]);

  useEffect(() => {
    if (!mounted || !sectionKeys || sectionKeys.length === 0) return;

    const scrollRoot = document.querySelector<HTMLElement>("[data-scroll-root]");
    if (!scrollRoot) return;

    function updateActiveSection(): void {
      if (isProgrammaticScrollRef.current) return;

      const containerTop = scrollRoot!.getBoundingClientRect().top;
      let bestKey: string | null = null;
      let bestRelTop = -Infinity;

      // Pick the section whose top is the largest value still ≤ SCROLL_TRIGGER_OFFSET_PX
      // (i.e. the section that most recently scrolled past the container's top edge).
      sectionKeys!.forEach((key) => {
        const el = document.getElementById(`section-${key}`);
        if (!el) return;
        const relTop = el.getBoundingClientRect().top - containerTop;
        if (relTop <= SCROLL_TRIGGER_OFFSET_PX && relTop > bestRelTop) {
          bestRelTop = relTop;
          bestKey = key;
        }
      });

      // Fallback: nothing has reached the trigger yet — pick first visible section.
      if (!bestKey) {
        let firstRelTop = Infinity;
        sectionKeys!.forEach((key) => {
          const el = document.getElementById(`section-${key}`);
          if (!el) return;
          const relTop = el.getBoundingClientRect().top - containerTop;
          if (relTop < firstRelTop) {
            firstRelTop = relTop;
            bestKey = key;
          }
        });
      }

      if (bestKey && bestKey !== currentActiveSectionRef.current) {
        currentActiveSectionRef.current = bestKey;
        setActiveSection(bestKey);
      }
    }

    let rafId: number | null = null;

    function onScroll(): void {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        updateActiveSection();
        rafId = null;
      });
    }

    scrollRoot.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    // Set correct active section immediately on mount / proposal load.
    updateActiveSection();

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      scrollRoot.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [mounted, sectionKeys, setActiveSection]);

  useEffect(() => {
    return () => {
      if (programmaticScrollTimerRef.current) clearTimeout(programmaticScrollTimerRef.current);
    };
  }, []);

  const handleScrollToSection = useCallback(
    (key: string): void => {
      currentActiveSectionRef.current = key;
      setActiveSection(key);

      // Suppress scroll-spy for PROGRAMMATIC_SCROLL_SUPPRESSION_MS so it doesn't
      // override the click-selected section while smooth-scroll animates.
      isProgrammaticScrollRef.current = true;
      if (programmaticScrollTimerRef.current) clearTimeout(programmaticScrollTimerRef.current);
      programmaticScrollTimerRef.current = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, PROGRAMMATIC_SCROLL_SUPPRESSION_MS);

      // Defer scroll to next animation frame so React commits the state update
      // first. getBoundingClientRect inside rAF gives stable layout coordinates.
      requestAnimationFrame(() => {
        const el = document.getElementById(`section-${key}`);
        if (!el) return;

        const container = document.querySelector<HTMLElement>("[data-scroll-root]");
        if (!container) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }

        const elTop = el.getBoundingClientRect().top;
        const containerTop = container.getBoundingClientRect().top;
        const targetScrollTop = container.scrollTop + (elTop - containerTop) - 24;
        container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: "smooth" });
      });
    },
    [setActiveSection]
  );

  return { handleScrollToSection };
}
