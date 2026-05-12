/**
 * Jest test environment bootstrap
 *
 * Runs once before all test suites. Configures:
 * - Extended DOM matchers from @testing-library/jest-dom
 * - Suppression of known React act() warnings in test output
 */

import "@testing-library/jest-dom";

const originalConsoleError = console.error;

beforeAll(() => {
  console.error = (...args: unknown[]): void => {
    if (
      typeof args[0] === "string" &&
      (args[0].includes("act(") || args[0].includes("not wrapped in act"))
    ) {
      return;
    }
    originalConsoleError(...args);
  };
});

afterAll(() => {
  console.error = originalConsoleError;
});
