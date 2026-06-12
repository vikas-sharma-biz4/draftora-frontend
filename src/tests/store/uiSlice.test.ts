/**
 * Tests for src/store/features/ui/uiSlice.ts
 */

import { useUIStore, INITIAL_UI_STATE } from "@/store/features/ui/uiSlice";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  useUIStore.setState(INITIAL_UI_STATE);
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe("uiSlice — initial state", () => {
  it("sidebarOpen defaults to true", () => {
    expect(useUIStore.getState().sidebarOpen).toBe(true);
  });

  it("globalLoading defaults to false", () => {
    expect(useUIStore.getState().globalLoading).toBe(false);
  });

  it("loadingMessage defaults to null", () => {
    expect(useUIStore.getState().loadingMessage).toBeNull();
  });

  it("activeModal defaults to null", () => {
    expect(useUIStore.getState().activeModal).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// setSidebarOpen
// ---------------------------------------------------------------------------

describe("uiSlice — setSidebarOpen", () => {
  it("sets sidebarOpen to false", () => {
    useUIStore.getState().setSidebarOpen(false);
    expect(useUIStore.getState().sidebarOpen).toBe(false);
  });

  it("sets sidebarOpen to true", () => {
    useUIStore.setState({ sidebarOpen: false });
    useUIStore.getState().setSidebarOpen(true);
    expect(useUIStore.getState().sidebarOpen).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// toggleSidebar
// ---------------------------------------------------------------------------

describe("uiSlice — toggleSidebar", () => {
  it("toggles from true to false", () => {
    expect(useUIStore.getState().sidebarOpen).toBe(true);
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(false);
  });

  it("toggles back to true", () => {
    useUIStore.getState().toggleSidebar();
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// setGlobalLoading
// ---------------------------------------------------------------------------

describe("uiSlice — setGlobalLoading", () => {
  it("sets globalLoading to true", () => {
    useUIStore.getState().setGlobalLoading(true);
    expect(useUIStore.getState().globalLoading).toBe(true);
  });

  it("sets globalLoading with a message", () => {
    useUIStore.getState().setGlobalLoading(true, "Loading data...");
    expect(useUIStore.getState().globalLoading).toBe(true);
    expect(useUIStore.getState().loadingMessage).toBe("Loading data...");
  });

  it("sets loadingMessage to null when no message provided", () => {
    useUIStore.getState().setGlobalLoading(true, "msg");
    useUIStore.getState().setGlobalLoading(false);
    expect(useUIStore.getState().loadingMessage).toBeNull();
  });

  it("sets globalLoading to false and clears message", () => {
    useUIStore.getState().setGlobalLoading(true, "Working");
    useUIStore.getState().setGlobalLoading(false);
    expect(useUIStore.getState().globalLoading).toBe(false);
    expect(useUIStore.getState().loadingMessage).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// openModal / closeModal
// ---------------------------------------------------------------------------

describe("uiSlice — openModal / closeModal", () => {
  it("opens a modal by name", () => {
    useUIStore.getState().openModal("confirm-delete");
    expect(useUIStore.getState().activeModal).toBe("confirm-delete");
  });

  it("replaces active modal when opening another", () => {
    useUIStore.getState().openModal("modal-a");
    useUIStore.getState().openModal("modal-b");
    expect(useUIStore.getState().activeModal).toBe("modal-b");
  });

  it("closes the active modal", () => {
    useUIStore.getState().openModal("my-modal");
    useUIStore.getState().closeModal();
    expect(useUIStore.getState().activeModal).toBeNull();
  });

  it("is safe to close when no modal is open", () => {
    useUIStore.getState().closeModal();
    expect(useUIStore.getState().activeModal).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// reset
// ---------------------------------------------------------------------------

describe("uiSlice — reset", () => {
  it("restores all state to initial values", () => {
    useUIStore.getState().setSidebarOpen(false);
    useUIStore.getState().setGlobalLoading(true, "Loading");
    useUIStore.getState().openModal("test-modal");

    useUIStore.getState().reset();

    const state = useUIStore.getState();
    expect(state.sidebarOpen).toBe(true);
    expect(state.globalLoading).toBe(false);
    expect(state.loadingMessage).toBeNull();
    expect(state.activeModal).toBeNull();
  });
});
