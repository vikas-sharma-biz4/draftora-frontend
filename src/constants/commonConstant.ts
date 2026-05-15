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

// ── Template TOCs (Table of Contents) ───────────────────────────────────────────
// Maps template types to their predefined section structures
export const TEMPLATE_TOCS = {
  mvp: [
    { key: "introduction", label: "Introduction" },
    { key: "purpose", label: "Purpose" },
    { key: "high_level_scope", label: "High-Level Scope of the Project" },
    { key: "high_level_feature_list", label: "High-Level Feature List — MVP" },
    { key: "non_functional_requirements", label: "Non-Functional Requirements (NFRs)" },
    { key: "proposed_technology_stack", label: "Proposed Technology Stack" },
    { key: "system_architecture", label: "System Architecture" },
    { key: "user_flow", label: "User Flow Diagram" },
    { key: "milestone_timeline", label: "Milestone and Timeline Estimations (MVP)" },
    { key: "risks_assumptions", label: "Risks/Assumptions and Mitigations" },
    { key: "client_dependencies", label: "Client Dependencies" },
    { key: "communication_client_cadence", label: "Communication & Client Cadence" },
    { key: "similar_projects", label: "Similar Projects Developed By Biz4Group Experts" },
    { key: "our_approach_methodology", label: "Our Approach & Methodology" },
  ],
  design: [
    { key: "introduction", label: "Introduction" },
    { key: "project_overview", label: "Project Overview" },
    { key: "key_objectives", label: "Key Objectives" },
    { key: "scope_of_prototype", label: "Scope of Prototype" },
    { key: "deliverables", label: "Deliverables" },
    { key: "value_proposition", label: "Value Proposition" },
    { key: "prototypes_developed", label: "Prototypes Developed" },
    { key: "our_approach_methodology", label: "Our Approach & Methodology" },
  ],
  poc: [
    { key: "introduction", label: "Introduction" },
    { key: "purpose", label: "Purpose" },
    { key: "high_level_scope", label: "High-Level Scope" },
    { key: "key_goals_of_poc", label: "Key Goals of POC" },
    { key: "poc_feature_list", label: "POC Feature List" },
    { key: "proposed_technology_stack", label: "Proposed Technology Stack" },
    { key: "poc_milestone_timeline", label: "POC Milestone Timeline" },
    { key: "client_dependencies", label: "Client Dependencies" },
    { key: "future_vision", label: "Future Vision" },
    { key: "our_approach_methodology", label: "Our Approach & Methodology" },
  ],
} as const;
