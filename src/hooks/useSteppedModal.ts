import { type Dispatch, type SetStateAction, useEffect, useState } from "react";

import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface SteppedModalState {
  mounted: boolean;
  step: 1 | 2;
  setStep: Dispatch<SetStateAction<1 | 2>>;
  showVersionDropdown: boolean;
  setShowVersionDropdown: Dispatch<SetStateAction<boolean>>;
  isGenerating: boolean;
  setIsGenerating: Dispatch<SetStateAction<boolean>>;
  isSaving: boolean;
  setIsSaving: Dispatch<SetStateAction<boolean>>;
}

export function useSteppedModal(onClose: () => void): SteppedModalState {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useBodyScrollLock(mounted);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent): void {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-version-dropdown]")) {
        setShowVersionDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return {
    mounted,
    step,
    setStep,
    showVersionDropdown,
    setShowVersionDropdown,
    isGenerating,
    setIsGenerating,
    isSaving,
    setIsSaving,
  };
}
