/**
 * Custom hook for managing modal state with browser history
 * 
 * This hook allows modals to be closed with the browser back button
 * by pushing a history state when the modal opens and listening for popstate events
 */

import { useEffect, useRef } from 'react';

interface UseModalHistoryOptions {
  isOpen: boolean;
  onClose: () => void;
  modalId?: string;
}

export function useModalHistory({ isOpen, onClose, modalId = 'modal' }: UseModalHistoryOptions): void {
  const hasHistoryState = useRef(false);
  const closedViaBackButton = useRef(false);

  useEffect(() => {
    // When modal opens, push a history state
    if (isOpen && !hasHistoryState.current) {
      window.history.pushState({ [modalId]: true }, '');
      hasHistoryState.current = true;
    }

    // When modal closes, clean up if it wasn't via back button
    if (!isOpen && hasHistoryState.current && !closedViaBackButton.current) {
      // Modal was closed programmatically (e.g., clicking X or Cancel)
      // Go back to remove the modal's history entry
      hasHistoryState.current = false;
      window.history.back();
    }

    // Reset the back button flag
    if (!isOpen) {
      closedViaBackButton.current = false;
    }
  }, [isOpen, modalId]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // If we have a history state and the new state doesn't have our modal ID
      if (hasHistoryState.current && !event.state?.[modalId]) {
        closedViaBackButton.current = true;
        hasHistoryState.current = false;
        onClose();
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [onClose, modalId]);
}
