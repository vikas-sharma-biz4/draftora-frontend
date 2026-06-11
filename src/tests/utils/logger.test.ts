/**
 * Tests for src/utils/logger.ts
 *
 * The logger is a singleton whose isDevelopment flag is evaluated at module-load
 * time. We use jest.isolateModules() to load the module fresh under a controlled
 * NODE_ENV so we can test both branches.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Logger = {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

function loadLogger(nodeEnv: string): Logger {
  let mod: { logger: Logger };
  const prevEnv = process.env.NODE_ENV;
  // jest.isolateModules re-evaluates the module under the mocked env
  jest.isolateModules(() => {
    process.env.NODE_ENV = nodeEnv;

    mod = require("@/utils/logger");
  });
  process.env.NODE_ENV = prevEnv;
  return mod!.logger;
}

// ---------------------------------------------------------------------------
// Tests — development mode
// ---------------------------------------------------------------------------

describe("logger — development mode", () => {
  let logger: Logger;
  let consoleSpy: {
    log: jest.SpyInstance;
    info: jest.SpyInstance;
    warn: jest.SpyInstance;
    error: jest.SpyInstance;
  };

  beforeAll(() => {
    logger = loadLogger("development");
  });

  beforeEach(() => {
    consoleSpy = {
      log: jest.spyOn(console, "log").mockImplementation(() => {}),
      info: jest.spyOn(console, "info").mockImplementation(() => {}),
      warn: jest.spyOn(console, "warn").mockImplementation(() => {}),
      error: jest.spyOn(console, "error").mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    Object.values(consoleSpy).forEach((spy) => spy.mockRestore());
  });

  it("calls console.log on debug()", () => {
    logger.debug("debug msg");
    expect(consoleSpy.log).toHaveBeenCalledWith("debug msg");
  });

  it("calls console.info on info()", () => {
    logger.info("info msg");
    expect(consoleSpy.info).toHaveBeenCalledWith("info msg");
  });

  it("calls console.warn on warn()", () => {
    logger.warn("warn msg");
    expect(consoleSpy.warn).toHaveBeenCalledWith("warn msg");
  });

  it("calls console.error on error()", () => {
    logger.error("error msg");
    expect(consoleSpy.error).toHaveBeenCalledWith("error msg");
  });

  it("passes multiple arguments", () => {
    logger.debug("a", "b", { c: 3 });
    expect(consoleSpy.log).toHaveBeenCalledWith("a", "b", { c: 3 });
  });
});

// ---------------------------------------------------------------------------
// Tests — production mode
// ---------------------------------------------------------------------------

describe("logger — production mode", () => {
  let logger: Logger;
  let consoleSpy: {
    log: jest.SpyInstance;
    info: jest.SpyInstance;
    warn: jest.SpyInstance;
    error: jest.SpyInstance;
  };

  beforeAll(() => {
    logger = loadLogger("production");
  });

  beforeEach(() => {
    consoleSpy = {
      log: jest.spyOn(console, "log").mockImplementation(() => {}),
      info: jest.spyOn(console, "info").mockImplementation(() => {}),
      warn: jest.spyOn(console, "warn").mockImplementation(() => {}),
      error: jest.spyOn(console, "error").mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    Object.values(consoleSpy).forEach((spy) => spy.mockRestore());
  });

  it("suppresses debug() in production", () => {
    logger.debug("should not log");
    expect(consoleSpy.log).not.toHaveBeenCalled();
  });

  it("suppresses info() in production", () => {
    logger.info("should not log");
    expect(consoleSpy.info).not.toHaveBeenCalled();
  });

  it("still calls console.warn in production", () => {
    logger.warn("warn always logs");
    expect(consoleSpy.warn).toHaveBeenCalledWith("warn always logs");
  });

  it("still calls console.error in production", () => {
    logger.error("error always logs");
    expect(consoleSpy.error).toHaveBeenCalledWith("error always logs");
  });
});
