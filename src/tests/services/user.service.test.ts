/**
 * Tests for src/services/user.service.ts
 */

jest.mock("@/utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("@/config/httpClient", () => ({
  http: {
    get: jest.fn(),
    patch: jest.fn(),
    put: jest.fn(),
    post: jest.fn(),
  },
  HttpError: class HttpError extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

import { getProfile, updateProfile, changePassword, uploadAvatar } from "@/services/user.service";
import { http } from "@/config/httpClient";
import type { AuthUser } from "@/services/auth.service";

const mockHttp = http as {
  get: jest.Mock;
  patch: jest.Mock;
  put: jest.Mock;
  post: jest.Mock;
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockUser: AuthUser = {
  id: 1,
  name: "Alice",
  email: "alice@example.com",
  role: "admin",
  avatarUrl: "https://example.com/avatar.png",
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getProfile
// ---------------------------------------------------------------------------

describe("getProfile", () => {
  it("calls http.get /users/me with Authorization header", async () => {
    mockHttp.get.mockResolvedValue({ data: mockUser });
    await getProfile("access-token-abc");
    expect(mockHttp.get).toHaveBeenCalledWith(
      "/users/me",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer access-token-abc" }),
      })
    );
  });

  it("returns the user object", async () => {
    mockHttp.get.mockResolvedValue({ data: mockUser });
    const result = await getProfile("token");
    expect(result).toEqual(mockUser);
  });

  it("propagates errors", async () => {
    mockHttp.get.mockRejectedValue(new Error("Unauthorized"));
    await expect(getProfile("bad")).rejects.toThrow("Unauthorized");
  });
});

// ---------------------------------------------------------------------------
// updateProfile
// ---------------------------------------------------------------------------

describe("updateProfile", () => {
  it("calls http.patch /users/me with updates", async () => {
    mockHttp.patch.mockResolvedValue({ data: { ...mockUser, name: "Bob" } });
    await updateProfile("token", { name: "Bob" });
    expect(mockHttp.patch).toHaveBeenCalledWith(
      "/users/me",
      { name: "Bob" },
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token" }),
      })
    );
  });

  it("returns updated user", async () => {
    const updated = { ...mockUser, name: "Bob" };
    mockHttp.patch.mockResolvedValue({ data: updated });
    const result = await updateProfile("token", { name: "Bob" });
    expect(result.name).toBe("Bob");
  });

  it("propagates errors", async () => {
    mockHttp.patch.mockRejectedValue(new Error("Validation failed"));
    await expect(updateProfile("token", {})).rejects.toThrow("Validation failed");
  });
});

// ---------------------------------------------------------------------------
// changePassword
// ---------------------------------------------------------------------------

describe("changePassword", () => {
  it("calls http.put /users/me/password with payload", async () => {
    mockHttp.put.mockResolvedValue(null);
    await changePassword("token", { currentPassword: "old", newPassword: "new" });
    expect(mockHttp.put).toHaveBeenCalledWith(
      "/users/me/password",
      { currentPassword: "old", newPassword: "new" },
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token" }),
      })
    );
  });

  it("returns void on success", async () => {
    mockHttp.put.mockResolvedValue(null);
    await expect(
      changePassword("token", { currentPassword: "old", newPassword: "new" })
    ).resolves.toBeUndefined();
  });

  it("propagates errors", async () => {
    mockHttp.put.mockRejectedValue(new Error("Wrong current password"));
    await expect(
      changePassword("token", { currentPassword: "bad", newPassword: "new" })
    ).rejects.toThrow("Wrong current password");
  });
});

// ---------------------------------------------------------------------------
// uploadAvatar
// ---------------------------------------------------------------------------

describe("uploadAvatar", () => {
  it("calls http.post /users/me/avatar with FormData", async () => {
    mockHttp.post.mockResolvedValue({ avatarUrl: "https://cdn.example.com/avatar.png" });
    const file = new File(["img"], "avatar.png", { type: "image/png" });
    await uploadAvatar("token", file);

    expect(mockHttp.post).toHaveBeenCalledWith(
      "/users/me/avatar",
      expect.any(FormData),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token" }),
      })
    );
  });

  it("returns avatarUrl", async () => {
    const url = "https://cdn.example.com/new-avatar.png";
    mockHttp.post.mockResolvedValue({ avatarUrl: url });
    const file = new File(["img"], "avatar.png");
    const result = await uploadAvatar("token", file);
    expect(result.avatarUrl).toBe(url);
  });

  it("propagates errors", async () => {
    mockHttp.post.mockRejectedValue(new Error("File too large"));
    const file = new File(["x"], "x.png");
    await expect(uploadAvatar("token", file)).rejects.toThrow("File too large");
  });
});
