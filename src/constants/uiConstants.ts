/**
 * UI-related constants
 *
 * Defines breakpoints and generation step configurations for the UI.
 */

/**
 * Generation steps displayed during proposal generation
 */
export const GENERATION_STEPS = [
  { id: "parsing", label: "Parsing Uploaded Documents" },
  { id: "validating", label: "Validating Knowledge Base" },
  { id: "synthesizing", label: "Synthesizing Strategic Context" },
  { id: "structuring", label: "Structuring Proposal Outline" },
  { id: "generating", label: "Generating Section Content" },
  { id: "finalizing", label: "Finalizing Document" },
] as const;

/**
 * Responsive breakpoints
 *
 * Must match SCSS $bp-* variables in _variables.scss.
 */
export const BREAKPOINTS = {
  mobile:  640,
  tablet:  1024,
  desktop: 1280,
  wide:    1536,
} as const;
