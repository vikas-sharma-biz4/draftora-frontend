/**
 * Tests for useDraftAutoSave hook
 *
 * Coverage targets:
 *   - getLastLocation: /parameters → wizard_parameters
 *   - getLastLocation: /review → wizard_review
 *   - getLastLocation: /proposal/... → web_view
 *   - getLastLocation: any other pathname → wizard_parameters (default)
 *   - hasData = false when enabled is false
 *   - hasData = false when proposalId is null
 *   - hasData = false when clientName is blank
 *   - hasData = false when approvalStatus is "approved"
 *   - hasData = false when approvalStatus is "rejected"
 *   - hasData = true when title is non-empty
 *   - hasData = true when description is non-empty
 *   - hasData = true when selectedSections is non-empty
 *   - hasData = true when draftStage is not "template_selection"
 *   - hasData = false when all data flags false (title/description empty, no sections, stage=template_selection)
 */

import { renderHook } from "@testing-library/react";
import { useDraftAutoSave } from "@/hooks/useDraftAutoSave";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUseDraftPersistence = jest.fn();

jest.mock("@/hooks/useDraftPersistence", () => ({
  useDraftPersistence: (...args: unknown[]) => mockUseDraftPersistence(...args),
}));

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
}));

jest.mock("@/store/features/wizard/proposalWizardSlice", () => ({
  useProposalTitle: jest.fn(),
  useClientName: jest.fn(),
  useProposalDescription: jest.fn(),
  useSelectedSections: jest.fn(),
  useSectionDisplayNames: jest.fn(),
  useTone: jest.fn(),
  useLengthPreference: jest.fn(),
  useLanguage: jest.fn(),
  useAiModel: jest.fn(),
  useTemplateId: jest.fn(),
  useTemplateType: jest.fn(),
  useCurrentStep: jest.fn(),
  useCurrentProposalId: jest.fn(),
  useFilesMeta: jest.fn(),
  useSelectedDocumentIds: jest.fn(),
  useWebReferences: jest.fn(),
}));

jest.mock("@/store/features/drafts/draftSessionSlice", () => ({
  useDraftSessionStore: jest.fn(),
}));

import * as wizardSlice from "@/store/features/wizard/proposalWizardSlice";
import { useDraftSessionStore } from "@/store/features/drafts/draftSessionSlice";
import { usePathname } from "next/navigation";

const mockUsePathname = usePathname as jest.Mock;
const mockUseDraftSessionStore = useDraftSessionStore as jest.Mock;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SetupOptions {
  title?: string;
  clientName?: string;
  description?: string;
  selectedSections?: string[];
  proposalId?: number | null;
  draftStage?: string;
  pathname?: string;
}

function setupDefaults({
  title = "Test Proposal",
  clientName = "Acme Corp",
  description = "A description",
  selectedSections = ["executive_summary"],
  proposalId = 42,
  draftStage = "wizard_in_progress",
  pathname = "/parameters",
}: SetupOptions = {}) {
  (wizardSlice.useProposalTitle as jest.Mock).mockReturnValue(title);
  (wizardSlice.useClientName as jest.Mock).mockReturnValue(clientName);
  (wizardSlice.useProposalDescription as jest.Mock).mockReturnValue(description);
  (wizardSlice.useSelectedSections as jest.Mock).mockReturnValue(selectedSections);
  (wizardSlice.useSectionDisplayNames as jest.Mock).mockReturnValue({});
  (wizardSlice.useTone as jest.Mock).mockReturnValue("professional");
  (wizardSlice.useLengthPreference as jest.Mock).mockReturnValue("balanced");
  (wizardSlice.useLanguage as jest.Mock).mockReturnValue("English - US");
  (wizardSlice.useAiModel as jest.Mock).mockReturnValue("gpt-4o");
  (wizardSlice.useTemplateId as jest.Mock).mockReturnValue(null);
  (wizardSlice.useTemplateType as jest.Mock).mockReturnValue("scratch");
  (wizardSlice.useCurrentStep as jest.Mock).mockReturnValue(1);
  (wizardSlice.useCurrentProposalId as jest.Mock).mockReturnValue(proposalId);
  (wizardSlice.useFilesMeta as jest.Mock).mockReturnValue([]);
  (wizardSlice.useSelectedDocumentIds as jest.Mock).mockReturnValue([]);
  (wizardSlice.useWebReferences as jest.Mock).mockReturnValue([]);
  mockUseDraftSessionStore.mockReturnValue(draftStage);
  mockUsePathname.mockReturnValue(pathname);
}

// Capture the options passed to useDraftPersistence
function getCapturedOptions() {
  return mockUseDraftPersistence.mock.calls[0][0] as {
    enabled: boolean;
    lastLocation: string;
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getLastLocation branch coverage
// ---------------------------------------------------------------------------

describe("useDraftAutoSave — getLastLocation", () => {
  it("resolves to 'wizard_parameters' when pathname is '/parameters'", () => {
    setupDefaults({ pathname: "/parameters" });
    renderHook(() => useDraftAutoSave({ enabled: true }));
    expect(getCapturedOptions().lastLocation).toBe("wizard_parameters");
  });

  it("resolves to 'wizard_review' when pathname is '/review'", () => {
    setupDefaults({ pathname: "/review" });
    renderHook(() => useDraftAutoSave({ enabled: true }));
    expect(getCapturedOptions().lastLocation).toBe("wizard_review");
  });

  it("resolves to 'web_view' when pathname starts with '/proposal/'", () => {
    setupDefaults({ pathname: "/proposal/123" });
    renderHook(() => useDraftAutoSave({ enabled: true }));
    expect(getCapturedOptions().lastLocation).toBe("web_view");
  });

  it("resolves to 'wizard_parameters' (default) for any other pathname", () => {
    setupDefaults({ pathname: "/drafts" });
    renderHook(() => useDraftAutoSave({ enabled: true }));
    expect(getCapturedOptions().lastLocation).toBe("wizard_parameters");
  });

  it("resolves to 'wizard_parameters' (default) for root pathname '/'", () => {
    setupDefaults({ pathname: "/" });
    renderHook(() => useDraftAutoSave({ enabled: true }));
    expect(getCapturedOptions().lastLocation).toBe("wizard_parameters");
  });
});

// ---------------------------------------------------------------------------
// hasData branch coverage
// ---------------------------------------------------------------------------

describe("useDraftAutoSave — hasData = false conditions", () => {
  it("passes enabled=false to useDraftPersistence when hook is disabled", () => {
    setupDefaults();
    renderHook(() => useDraftAutoSave({ enabled: false }));
    expect(getCapturedOptions().enabled).toBe(false);
  });

  it("passes enabled=false when proposalId is null", () => {
    setupDefaults({ proposalId: null });
    renderHook(() => useDraftAutoSave({ enabled: true }));
    expect(getCapturedOptions().enabled).toBe(false);
  });

  it("passes enabled=false when clientName is blank (spaces only)", () => {
    setupDefaults({ clientName: "   " });
    renderHook(() => useDraftAutoSave({ enabled: true }));
    expect(getCapturedOptions().enabled).toBe(false);
  });

  it("passes enabled=false when clientName is empty string", () => {
    setupDefaults({ clientName: "" });
    renderHook(() => useDraftAutoSave({ enabled: true }));
    expect(getCapturedOptions().enabled).toBe(false);
  });

  it("passes enabled=false when approvalStatus is 'approved'", () => {
    setupDefaults();
    renderHook(() => useDraftAutoSave({ enabled: true, approvalStatus: "approved" }));
    expect(getCapturedOptions().enabled).toBe(false);
  });

  it("passes enabled=false when approvalStatus is 'rejected'", () => {
    setupDefaults();
    renderHook(() => useDraftAutoSave({ enabled: true, approvalStatus: "rejected" }));
    expect(getCapturedOptions().enabled).toBe(false);
  });

  it("passes enabled=false when title/description/sections are all empty AND stage is template_selection", () => {
    setupDefaults({
      title: "",
      description: "",
      selectedSections: [],
      draftStage: "template_selection",
    });
    renderHook(() => useDraftAutoSave({ enabled: true }));
    expect(getCapturedOptions().enabled).toBe(false);
  });
});

describe("useDraftAutoSave — hasData = true conditions", () => {
  it("passes enabled=true when title is non-empty (even if description and sections empty)", () => {
    setupDefaults({
      title: "My Proposal",
      description: "",
      selectedSections: [],
      draftStage: "template_selection",
    });
    renderHook(() => useDraftAutoSave({ enabled: true }));
    expect(getCapturedOptions().enabled).toBe(true);
  });

  it("passes enabled=true when description is non-empty", () => {
    setupDefaults({
      title: "",
      description: "Some description",
      selectedSections: [],
      draftStage: "template_selection",
    });
    renderHook(() => useDraftAutoSave({ enabled: true }));
    expect(getCapturedOptions().enabled).toBe(true);
  });

  it("passes enabled=true when selectedSections is non-empty", () => {
    setupDefaults({
      title: "",
      description: "",
      selectedSections: ["executive_summary"],
      draftStage: "template_selection",
    });
    renderHook(() => useDraftAutoSave({ enabled: true }));
    expect(getCapturedOptions().enabled).toBe(true);
  });

  it("passes enabled=true when draftStage is not 'template_selection'", () => {
    setupDefaults({
      title: "",
      description: "",
      selectedSections: [],
      draftStage: "wizard_in_progress",
    });
    renderHook(() => useDraftAutoSave({ enabled: true }));
    expect(getCapturedOptions().enabled).toBe(true);
  });

  it("passes enabled=true when all conditions are satisfied", () => {
    setupDefaults();
    renderHook(() => useDraftAutoSave({ enabled: true }));
    expect(getCapturedOptions().enabled).toBe(true);
  });

  it("passes approvalStatus=undefined to useDraftPersistence when not provided", () => {
    setupDefaults();
    renderHook(() => useDraftAutoSave({ enabled: true }));
    const opts = mockUseDraftPersistence.mock.calls[0][0];
    expect(opts.approvalStatus).toBeUndefined();
  });

  it("passes approvalStatus='pending' when provided", () => {
    setupDefaults();
    renderHook(() => useDraftAutoSave({ enabled: true, approvalStatus: "pending" }));
    const opts = mockUseDraftPersistence.mock.calls[0][0];
    expect(opts.approvalStatus).toBe("pending");
  });
});
