import { downloadBlob } from "@/utils/downloadBlob";

const mockCreateObjectURL = jest.fn().mockReturnValue("blob:fake-url");
const mockRevokeObjectURL = jest.fn();
const mockAnchorClick = jest.fn();

Object.defineProperty(URL, "createObjectURL", {
  writable: true,
  configurable: true,
  value: mockCreateObjectURL,
});
Object.defineProperty(URL, "revokeObjectURL", {
  writable: true,
  configurable: true,
  value: mockRevokeObjectURL,
});
Object.defineProperty(HTMLAnchorElement.prototype, "click", {
  writable: true,
  configurable: true,
  value: mockAnchorClick,
});

describe("downloadBlob", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockCreateObjectURL.mockReturnValue("blob:fake-url");
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("creates a Blob with the correct MIME type and triggers a download", () => {
    downloadBlob("hello", "test.txt", "text/plain");
    expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(mockAnchorClick).toHaveBeenCalledTimes(1);
  });

  it("sets the correct filename on the anchor", () => {
    const appendSpy = jest.spyOn(document.body, "appendChild");
    downloadBlob("hello", "test.txt", "text/plain");
    const anchor = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(anchor.download).toBe("test.txt");
    expect(anchor.href).toBe("blob:fake-url");
    appendSpy.mockRestore();
  });

  it("hides the anchor element before clicking", () => {
    const appendSpy = jest.spyOn(document.body, "appendChild");
    downloadBlob("hello", "test.txt", "text/plain");
    const anchor = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(anchor.style.display).toBe("none");
    appendSpy.mockRestore();
  });

  it("revokes the object URL after 500ms", () => {
    downloadBlob("hello", "test.txt", "text/plain");
    expect(mockRevokeObjectURL).not.toHaveBeenCalled();

    jest.advanceTimersByTime(499);
    expect(mockRevokeObjectURL).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:fake-url");
  });

  it("accepts a Blob as content", () => {
    const blobContent = new Blob(["data"], { type: "application/octet-stream" });
    downloadBlob(blobContent, "file.bin", "application/octet-stream");
    expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(mockAnchorClick).toHaveBeenCalledTimes(1);
  });

  it("still revokes the object URL if removeChild throws", () => {
    const removeSpy = jest.spyOn(document.body, "removeChild").mockImplementationOnce(() => {
      throw new Error("Not in DOM");
    });
    downloadBlob("hello", "test.txt", "text/plain");
    jest.advanceTimersByTime(500);
    expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:fake-url");
    removeSpy.mockRestore();
  });
});
