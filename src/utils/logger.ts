/**
 * Environment-aware logging utility
 *
 * Provides logging methods that respect the NODE_ENV environment variable.
 * Debug and info logs are suppressed in production to prevent information leakage
 * and reduce performance overhead.
 */

const isDevelopment = process.env.NODE_ENV === "development";

export const logger = {
  /**
   * Debug-level logging (development only)
   * Use for detailed diagnostic information
   */
  debug: (...args: unknown[]): void => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * Info-level logging (development only)
   * Use for general informational messages
   */
  info: (...args: unknown[]): void => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  /**
   * Warning-level logging (all environments)
   * Use for potentially harmful situations
   */
  warn: (...args: unknown[]): void => {
    console.warn(...args);
  },

  /**
   * Error-level logging (all environments)
   * Use for error events that might still allow the application to continue.
   */
  error: (...args: unknown[]): void => {
    console.error(...args);
  },
};
