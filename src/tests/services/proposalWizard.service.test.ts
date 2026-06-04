/**
 * Tests for proposalWizard.service.ts
 *
 * Coverage targets:
 *   - markProposalStepVisited: POST path + body shape
 *   - validateProposalStepAccess: POST path + boolean mapping + error fallback
 */

import {
  markProposalStepVisited,
  validateProposalStepAccess,
} from "@/services/proposal/proposalWizard.service";
import { http } from "@/config/httpClient";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/config/httpClient", () => ({
  http: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
  buildUrl: jest.fn(),
  HttpError: class HttpError extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

jest.mock("@/utils/logger", () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockHttpPost = http.post as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// markProposalStepVisited
// ---------------------------------------------------------------------------

describe("proposalWizard.service — markProposalStepVisited", () => {
  it("POSTs to /proposals/:id/mark-step-visited with the correct step payload", async () => {
    mockHttpPost.mockResolvedValue(undefined);

    await markProposalStepVisited(99, 2);

    expect(mockHttpPost).toHaveBeenCalledTimes(1);
    const [path, body] = mockHttpPost.mock.calls[0];
    expect(path).toMatch(/\/proposals\/99\/mark-step-visited/);
    expect(body).toMatchObject({ target_step: 2 });
  });

  it("resolves without returning a value on success", async () => {
    mockHttpPost.mockResolvedValue(null);
    const result = await markProposalStepVisited(1, 1);
    expect(result).toBeUndefined();
  });

  it("propagates API errors to the caller", async () => {
    mockHttpPost.mockRejectedValue(new Error("Server error"));
    await expect(markProposalStepVisited(1, 1)).rejects.toThrow("Server error");
  });
});

// ---------------------------------------------------------------------------
// validateProposalStepAccess
// ---------------------------------------------------------------------------

describe("proposalWizard.service — validateProposalStepAccess", () => {
  it("POSTs to /proposals/:id/validate-step-access with the correct step payload", async () => {
    mockHttpPost.mockResolvedValue({ can_access: true });

    await validateProposalStepAccess(42, 3);

    const [path, body] = mockHttpPost.mock.calls[0];
    expect(path).toMatch(/\/proposals\/42\/validate-step-access/);
    expect(body).toMatchObject({ target_step: 3 });
  });

  it("returns true when the API responds with can_access: true", async () => {
    mockHttpPost.mockResolvedValue({ can_access: true });
    const result = await validateProposalStepAccess(1, 1);
    expect(result).toBe(true);
  });

  it("returns false when the API responds with can_access: false", async () => {
    mockHttpPost.mockResolvedValue({ can_access: false });
    const result = await validateProposalStepAccess(1, 1);
    expect(result).toBe(false);
  });

  it("propagates errors to the caller when the API request fails", async () => {
    mockHttpPost.mockRejectedValue(new Error("Network error"));
    await expect(validateProposalStepAccess(1, 1)).rejects.toThrow("Network error");
  });
});
