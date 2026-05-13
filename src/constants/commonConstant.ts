/**
 * Common constants — legacy barrel export
 *
 * This file now re-exports from domain-focused constant modules for backward compatibility.
 * New imports should use the specific domain modules directly:
 *   - @/constants/proposalConstants
 *   - @/constants/templateConstants
 *   - @/constants/editorConstants
 *   - @/constants/uiConstants
 *   - @/constants/pipelineConstants
 */

// Proposal-related constants
export * from "./proposalConstants";

// Template-related constants
export * from "./templateConstants";

// Editor-related constants
export * from "./editorConstants";

// UI-related constants
export * from "./uiConstants";

// Pipeline-related constants
export * from "./pipelineConstants";
