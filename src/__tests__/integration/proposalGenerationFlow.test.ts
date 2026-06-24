/**
 * Integration tests for proposal generation flow
 *
 * Tests the complete end-to-end generation flow from API call
 * through SSE streaming to completion.
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useProposalGenerationStream } from "@/hooks/useProposalGenerationStream";
import { useGenerationStore } from "@/store/features/generation/generationSlice";
import { generateProposal } from "@/services/proposal";
import type {
  ProposalData,
  ToneOption,
  LengthOption,
  TemplateType,
} from "@/interfaces/proposalInterfaces";

// Mock EventSource for SSE
class MockEventSource {
  url: string;
  readyState: number = 0;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  private messageQueue: string[] = [];

  constructor(url: string | URL) {
    this.url = typeof url === "string" ? url : url.toString();
    this.readyState = 0; // CONNECTING
  }

  connect() {
    this.readyState = 1; // OPEN
    if (this.onopen) {
      this.onopen(new Event("open"));
    }
  }

  emitMessage(data: string) {
    this.messageQueue.push(data);
    if (this.onmessage) {
      this.onmessage(new MessageEvent("message", { data }));
    }
  }

  emitError() {
    this.readyState = 2; // CLOSED
    if (this.onerror) {
      this.onerror(new Event("error"));
    }
  }

  close() {
    this.readyState = 2; // CLOSED
  }

  getMessageCount(): number {
    return this.messageQueue.length;
  }
}

(global as any).EventSource = MockEventSource;

// Mock HTTP client — factory uses jest.fn() directly to avoid hoisting TDZ issue
let mockPost: jest.Mock;
jest.mock("@/config/httpClient", () => ({
  http: {
    post: jest.fn(),
    get: jest.fn(),
  },
}));

describe("Proposal Generation Flow Integration", () => {
  let mockEventSource: MockEventSource;

  beforeEach(() => {
    // Resolve mockPost from the already-mocked module

    mockPost = (require("@/config/httpClient") as { http: { post: jest.Mock } }).http.post;

    // Reset store
    useGenerationStore.getState().reset();

    // Setup EventSource mock
    mockEventSource = new MockEventSource("http://test.com/proposals/123/stream");
    jest.spyOn(window, "EventSource").mockImplementation((url: string | URL) => {
      mockEventSource.url = typeof url === "string" ? url : url.toString();
      return mockEventSource as any;
    });

    // Reset HTTP mocks
    mockPost.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Complete Generation Flow", () => {
    it("should complete full generation flow from API to SSE to completion", async () => {
      // Step 1: Mock API response for proposal creation
      mockPost.mockResolvedValue({
        id: 123,
        status: "generating",
        jobId: "gen_test_123",
      });

      // Step 2: Call generateProposal API
      const proposalData: ProposalData = {
        title: "Test Proposal",
        clientName: "Test Client",
        clientId: 1,
        description: "Test description",
        tone: "professional" as ToneOption,
        lengthPreference: "balanced" as LengthOption,
        language: "English - US",
        templateType: "scratch" as TemplateType,
        aiModel: "gpt-4o",
        selectedSections: ["Executive Summary", "Technical Approach"],
        sectionDisplayNames: {},
        customSections: [],
        contextualInstructions: "",
        webReferences: [],
        filesMeta: [],
        templateId: null,
      };

      const response = await generateProposal(proposalData);

      expect(mockPost).toHaveBeenCalledWith("/proposals", expect.any(FormData));
      expect(response.id).toBe(123);
      expect(response.jobId).toBe("gen_test_123");

      // Step 3: Initialize generation store
      useGenerationStore.getState().setProposalId(response.id);
      useGenerationStore.getState().setJobId(response.jobId || "");
      useGenerationStore.getState().setStatus("queued");
      useGenerationStore.getState().setSelectedSections(proposalData.selectedSections);
      useGenerationStore.getState().setStartedAt(new Date().toISOString());

      // Step 4: Connect to SSE stream
      const onCompleted = jest.fn();
      const onProgress = jest.fn();
      const onSectionCompleted = jest.fn();

      const { result } = renderHook(() =>
        useProposalGenerationStream({
          proposalId: response.id,
          enabled: true,
          onCompleted,
          onProgress,
          onSectionCompleted,
        })
      );

      // Step 5: Simulate SSE connection + initial "connected" event (isConnected is set on message, not onopen)
      act(() => {
        mockEventSource.connect();
        mockEventSource.emitMessage(
          JSON.stringify({
            type: "connected",
            jobId: "gen_test_123",
            timestamp: new Date().toISOString(),
          })
        );
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Step 6: Simulate remaining generation events
      const events = [
        {
          type: "stage_changed",
          data: { stage: "parsing" },
          message: "Parsing files...",
          timestamp: new Date().toISOString(),
        },
        { type: "progress", data: { percent: 10 }, timestamp: new Date().toISOString() },
        {
          type: "section_started",
          data: { section: "Executive Summary" },
          timestamp: new Date().toISOString(),
        },
        { type: "progress", data: { percent: 30 }, timestamp: new Date().toISOString() },
        {
          type: "section_completed",
          data: { section: "Executive Summary", completed: 1, total: 2 },
          timestamp: new Date().toISOString(),
        },
        {
          type: "section_started",
          data: { section: "Technical Approach" },
          timestamp: new Date().toISOString(),
        },
        { type: "progress", data: { percent: 60 }, timestamp: new Date().toISOString() },
        {
          type: "section_completed",
          data: { section: "Technical Approach", completed: 2, total: 2 },
          timestamp: new Date().toISOString(),
        },
        { type: "progress", data: { percent: 100 }, timestamp: new Date().toISOString() },
        { type: "completed", timestamp: new Date().toISOString() },
      ];

      for (const event of events) {
        act(() => {
          mockEventSource.emitMessage(JSON.stringify(event));
        });
      }

      // Step 7: Verify completion
      await waitFor(() => {
        expect(onCompleted).toHaveBeenCalled();
      });

      expect(onProgress).toHaveBeenCalledWith(100);
      expect(onSectionCompleted).toHaveBeenCalledWith("Executive Summary", 1, 2);
      expect(onSectionCompleted).toHaveBeenCalledWith("Technical Approach", 2, 2);
    });

    it("should handle generation failure flow", async () => {
      // Mock API response
      mockPost.mockResolvedValue({
        id: 456,
        status: "generating",
        jobId: "gen_test_456",
      });

      const proposalData: ProposalData = {
        title: "Test Proposal",
        clientName: "Test Client",
        clientId: 1,
        description: "Test description",
        tone: "professional" as ToneOption,
        lengthPreference: "balanced" as LengthOption,
        language: "English - US",
        templateType: "scratch" as TemplateType,
        aiModel: "gpt-4o",
        selectedSections: ["Executive Summary"],
        sectionDisplayNames: {},
        customSections: [],
        contextualInstructions: "",
        webReferences: [],
        filesMeta: [],
        templateId: null,
      };

      const response = await generateProposal(proposalData);

      useGenerationStore.getState().setProposalId(response.id);
      useGenerationStore.getState().setJobId(response.jobId || "");
      useGenerationStore.getState().setStatus("queued");
      useGenerationStore.getState().setSelectedSections(proposalData.selectedSections);

      // onFailed updates the store to simulate what the real consumer would do
      const onFailed = jest.fn((msg: string) => {
        useGenerationStore.getState().setStatus("failed");
        useGenerationStore.getState().setError(msg);
      });

      renderHook(() =>
        useProposalGenerationStream({
          proposalId: response.id,
          enabled: true,
          onFailed,
        })
      );

      act(() => {
        mockEventSource.connect();
      });

      await waitFor(() => {
        expect(mockEventSource.readyState).toBe(1);
      });

      // Simulate failure
      act(() => {
        mockEventSource.emitMessage(
          JSON.stringify({
            type: "failed",
            message: "AI generation timeout",
            timestamp: new Date().toISOString(),
          })
        );
      });

      await waitFor(() => {
        expect(onFailed).toHaveBeenCalledWith("AI generation timeout");
      });

      const state = useGenerationStore.getState();
      expect(state.status).toBe("failed");
      expect(state.error).toBe("AI generation timeout");
    });

    it("should handle cancellation flow", async () => {
      // Mock API response
      mockPost.mockResolvedValue({
        id: 789,
        status: "generating",
        jobId: "gen_test_789",
      });

      const proposalData: ProposalData = {
        title: "Test Proposal",
        clientName: "Test Client",
        clientId: 1,
        description: "Test description",
        tone: "professional" as ToneOption,
        lengthPreference: "balanced" as LengthOption,
        language: "English - US",
        templateType: "scratch" as TemplateType,
        aiModel: "gpt-4o",
        selectedSections: ["Executive Summary"],
        sectionDisplayNames: {},
        customSections: [],
        contextualInstructions: "",
        webReferences: [],
        filesMeta: [],
        templateId: null,
      };

      const response = await generateProposal(proposalData);

      useGenerationStore.getState().setProposalId(response.id);
      useGenerationStore.getState().setJobId(response.jobId || "");
      useGenerationStore.getState().setStatus("queued");
      useGenerationStore.getState().setSelectedSections(proposalData.selectedSections);

      // onCancelled updates the store to simulate what the real consumer would do
      const onCancelled = jest.fn(() => {
        useGenerationStore.getState().setStatus("cancelled");
      });

      renderHook(() =>
        useProposalGenerationStream({
          proposalId: response.id,
          enabled: true,
          onCancelled,
        })
      );

      act(() => {
        mockEventSource.connect();
      });

      await waitFor(() => {
        expect(mockEventSource.readyState).toBe(1);
      });

      // Simulate cancellation
      act(() => {
        mockEventSource.emitMessage(
          JSON.stringify({
            type: "cancelled",
            timestamp: new Date().toISOString(),
          })
        );
      });

      await waitFor(() => {
        expect(onCancelled).toHaveBeenCalled();
      });

      const state = useGenerationStore.getState();
      expect(state.status).toBe("cancelled");
    });

    it("should handle reconnection after connection loss", async () => {
      // Mock API response
      mockPost.mockResolvedValue({
        id: 101,
        status: "generating",
        jobId: "gen_test_101",
      });

      const proposalData: ProposalData = {
        title: "Test Proposal",
        clientName: "Test Client",
        clientId: 1,
        description: "Test description",
        tone: "professional" as ToneOption,
        lengthPreference: "balanced" as LengthOption,
        language: "English - US",
        templateType: "scratch" as TemplateType,
        aiModel: "gpt-4o",
        selectedSections: ["Executive Summary"],
        sectionDisplayNames: {},
        customSections: [],
        contextualInstructions: "",
        webReferences: [],
        filesMeta: [],
        templateId: null,
      };

      const response = await generateProposal(proposalData);

      useGenerationStore.getState().setProposalId(response.id);
      useGenerationStore.getState().setJobId(response.jobId || "");
      useGenerationStore.getState().setStatus("generating");
      useGenerationStore.getState().setSelectedSections(proposalData.selectedSections);
      useGenerationStore.getState().setProgressPercent(25);

      const onConnected = jest.fn();
      const onError = jest.fn();

      const { result } = renderHook(() =>
        useProposalGenerationStream({
          proposalId: response.id,
          enabled: true,
          onConnected,
          onError,
        })
      );

      // Initial connection — emit "connected" event to trigger onConnected callback
      act(() => {
        mockEventSource.connect();
        mockEventSource.emitMessage(
          JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })
        );
      });

      await waitFor(() => {
        expect(onConnected).toHaveBeenCalled();
      });

      // Simulate connection loss
      act(() => {
        mockEventSource.emitError();
      });

      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });

      // Verify reconnect count incremented in hook's local state (not generation store)
      await waitFor(() => {
        expect(result.current.reconnectCount).toBeGreaterThan(0);
      });

      // Simulate reconnection success — emit "connected" again
      act(() => {
        mockEventSource.connect();
        mockEventSource.emitMessage(
          JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })
        );
      });

      await waitFor(() => {
        expect(onConnected).toHaveBeenCalledTimes(2);
      });
    });

    it("should maintain state during page refresh", async () => {
      // Mock API response
      mockPost.mockResolvedValue({
        id: 202,
        status: "generating",
        jobId: "gen_test_202",
      });

      const proposalData: ProposalData = {
        title: "Test Proposal",
        clientName: "Test Client",
        clientId: 1,
        description: "Test description",
        tone: "professional" as ToneOption,
        lengthPreference: "balanced" as LengthOption,
        language: "English - US",
        templateType: "scratch" as TemplateType,
        aiModel: "gpt-4o",
        selectedSections: ["Executive Summary", "Technical Approach"],
        sectionDisplayNames: {},
        customSections: [],
        contextualInstructions: "",
        webReferences: [],
        filesMeta: [],
        templateId: null,
      };

      const response = await generateProposal(proposalData);

      // Simulate initial generation state
      useGenerationStore.getState().setProposalId(response.id);
      useGenerationStore.getState().setJobId(response.jobId || "");
      useGenerationStore.getState().setStatus("generating");
      useGenerationStore.getState().setSelectedSections(proposalData.selectedSections);
      useGenerationStore.getState().setProgressPercent(50);
      useGenerationStore.getState().setCurrentSection("Executive Summary");
      useGenerationStore.getState().addCompletedSection("Executive Summary");
      useGenerationStore.getState().setStartedAt(new Date().toISOString());

      // Simulate page refresh by creating new hook instance
      const { result } = renderHook(() =>
        useProposalGenerationStream({
          proposalId: response.id,
          enabled: true,
        })
      );

      // Emit "connected" event — isConnected is set on message, not onopen
      act(() => {
        mockEventSource.connect();
        mockEventSource.emitMessage(
          JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })
        );
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Verify state persisted
      const state = useGenerationStore.getState();
      expect(state.proposalId).toBe(202);
      expect(state.jobId).toBe("gen_test_202");
      expect(state.progressPercent).toBe(50);
      expect(state.completedSectionKeys).toContain("Executive Summary");
    });
  });

  describe("Error Recovery", () => {
    it("should recover from malformed SSE events", async () => {
      mockPost.mockResolvedValue({
        id: 303,
        status: "generating",
        jobId: "gen_test_303",
      });

      const response = await generateProposal({
        title: "Test Proposal",
        clientName: "Test Client",
        clientId: 1,
        description: "Test description",
        tone: "professional" as ToneOption,
        lengthPreference: "balanced" as LengthOption,
        language: "English - US",
        templateType: "scratch" as TemplateType,
        aiModel: "gpt-4o",
        selectedSections: ["Executive Summary"],
        sectionDisplayNames: {},
        customSections: [],
        contextualInstructions: "",
        webReferences: [],
        filesMeta: [],
        templateId: null,
      } as ProposalData);

      useGenerationStore.getState().setProposalId(response.id);
      useGenerationStore.getState().setJobId(response.jobId || "");

      const { result } = renderHook(() =>
        useProposalGenerationStream({
          proposalId: response.id,
          enabled: true,
        })
      );

      // Connect and emit "connected" to set isConnected = true
      act(() => {
        mockEventSource.connect();
        mockEventSource.emitMessage(
          JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })
        );
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Send malformed event
      act(() => {
        mockEventSource.emitMessage("invalid json");
      });

      // Send valid event — hook should survive malformed JSON without disconnecting
      act(() => {
        mockEventSource.emitMessage(
          JSON.stringify({
            type: "progress",
            data: { percent: 50 },
            timestamp: new Date().toISOString(),
          })
        );
      });

      // Hook's local isConnected should remain true after a malformed event
      expect(result.current.isConnected).toBe(true);
    });

    it("should handle backend returning jobId as null", async () => {
      mockPost.mockResolvedValue({
        id: 404,
        status: "generating",
        jobId: null,
      });

      const response = await generateProposal({
        title: "Test Proposal",
        clientName: "Test Client",
        clientId: 1,
        description: "Test description",
        tone: "professional" as ToneOption,
        lengthPreference: "balanced" as LengthOption,
        language: "English - US",
        templateType: "scratch" as TemplateType,
        aiModel: "gpt-4o",
        selectedSections: ["Executive Summary"],
        sectionDisplayNames: {},
        customSections: [],
        contextualInstructions: "",
        webReferences: [],
        filesMeta: [],
        templateId: null,
      } as ProposalData);

      expect(response.jobId).toBeNull();

      // Should handle gracefully — null jobId is stored as '' (null || '' = '')
      useGenerationStore.getState().setProposalId(response.id);
      useGenerationStore.getState().setJobId(response.jobId || "");

      const state = useGenerationStore.getState();
      expect(state.proposalId).toBe(404);
      expect(state.jobId).toBe("");
    });
  });
});
