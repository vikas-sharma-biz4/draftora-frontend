/**
 * Centralized Floating Toolbar Manager
 *
 * Ensures ONLY ONE floating toolbar exists globally across all editor instances.
 * Manages lifecycle, cleanup, and state synchronization.
 */

type ToolbarOwner = {
  editorId: string;
  cleanup: () => void;
};

class FloatingToolbarManager {
  private static instance: FloatingToolbarManager;
  private bubbleElement: HTMLDivElement | null = null;
  private currentOwner: ToolbarOwner | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): FloatingToolbarManager {
    if (!FloatingToolbarManager.instance) {
      FloatingToolbarManager.instance = new FloatingToolbarManager();
    }
    return FloatingToolbarManager.instance;
  }

  /**
   * Request toolbar ownership for an editor instance.
   * If another editor owns it, that editor's toolbar is destroyed first.
   */
  requestToolbar(editorId: string, cleanup: () => void): HTMLDivElement {
    // If another editor owns the toolbar, destroy it first
    if (this.currentOwner && this.currentOwner.editorId !== editorId) {
      this.currentOwner.cleanup();
      this.releaseToolbar(this.currentOwner.editorId);
    }

    // Create bubble element if it doesn't exist
    if (!this.bubbleElement) {
      this.bubbleElement = document.createElement('div');
      this.bubbleElement.className = 'rte-bubble-mount';
      this.bubbleElement.style.display = 'none';
      document.body.appendChild(this.bubbleElement);
    }

    // Set new owner
    this.currentOwner = { editorId, cleanup };

    return this.bubbleElement;
  }

  /**
   * Release toolbar ownership from an editor instance.
   */
  releaseToolbar(editorId: string): void {
    if (this.currentOwner?.editorId === editorId) {
      this.currentOwner = null;
      if (this.bubbleElement) {
        this.bubbleElement.style.display = 'none';
        // Clear any inline styles
        this.bubbleElement.style.top = '';
        this.bubbleElement.style.left = '';
        this.bubbleElement.style.transform = '';
        this.bubbleElement.style.maxWidth = '';
      }
    }
  }

  /**
   * Check if a specific editor owns the toolbar.
   */
  isOwner(editorId: string): boolean {
    return this.currentOwner?.editorId === editorId;
  }

  /**
   * Get the bubble element (read-only access).
   */
  getBubbleElement(): HTMLDivElement | null {
    return this.bubbleElement;
  }

  /**
   * Force cleanup - removes bubble element from DOM.
   * Should only be called on app unmount.
   */
  destroy(): void {
    if (this.currentOwner) {
      this.currentOwner.cleanup();
      this.currentOwner = null;
    }
    if (this.bubbleElement && this.bubbleElement.parentNode) {
      this.bubbleElement.parentNode.removeChild(this.bubbleElement);
      this.bubbleElement = null;
    }
  }
}

export const toolbarManager = FloatingToolbarManager.getInstance();
