/**
 * Template-related constants
 *
 * Defines proposal templates and special card configurations.
 */

import type { ProposalTemplate } from "@/interfaces/proposalInterfaces";

/**
 * Predefined proposal templates
 *
 * Each template defines a specific proposal structure with sections tailored
 * to different use cases (MVP, POC, Design, Documentation, etc.).
 */
export const PROPOSAL_TEMPLATES = [
  {
    id: "mvp-proposal",
    templateType: "mvp",
    name: "MVP Proposal",
    category: "Popular" as const,
    description:
      "Fast-track proposal for minimum viable product delivery with core feature scope, lean implementation, and rapid go-to-market strategy.",
    sections: [
      "introduction",
      "purpose",
      "high_level_scope",
      "high_level_feature_list",
      "non_functional_requirements",
      "proposed_technology_stack",
      "system_architecture",
      "user_flow",
      "milestone_timeline",
      "risks_assumptions",
      "client_dependencies",
      "communication_client_cadence",
      "similar_projects",
      "our_approach_methodology",
    ],
    gradientClass: "tmpl-preview-gradient-1",
    icon: "▲",
  },
  {
    id: "poc-discovery",
    templateType: "poc",
    name: "POC & Discovery",
    category: "Technical" as const,
    description:
      "Structured discovery and proof-of-concept framework covering technical feasibility, risk assessment, and architecture validation.",
    sections: [
      "introduction",
      "purpose",
      "high_level_scope",
      "key_goals_of_poc",
      "poc_feature_list",
      "proposed_technology_stack",
      "poc_milestone_timeline",
      "client_dependencies",
      "future_vision",
      "our_approach_methodology",
    ],
    gradientClass: "tmpl-preview-gradient-2",
    icon: "⊞",
  },
  {
    id: "design-proposal",
    templateType: "design",
    name: "Design Proposal",
    category: "Creative" as const,
    description:
      "UX-first engagement proposal focused on research, wireframing, design systems, and iterative prototyping workflows.",
    sections: [
      "introduction",
      "project_overview",
      "key_objectives",
      "scope_of_prototype",
      "deliverables",
      "value_proposition",
      "prototypes_developed",
      "our_approach_methodology",
    ],
    gradientClass: "tmpl-preview-gradient-3",
    icon: "✦",
  },
  {
    id: "brd",
    templateType: "brd",
    name: "BRD",
    category: "Documentation" as const,
    description:
      "Business Requirements Document outlining business objectives, stakeholder needs, and high-level functional requirements.",
    sections: [
      "executive_summary",
      "business_objectives",
      "stakeholder_analysis",
      "functional_requirements",
      "non_functional_requirements",
      "assumptions_constraints",
      "success_criteria",
    ],
    gradientClass: "tmpl-preview-gradient-1",
    icon: "◆",
  },
  {
    id: "frd",
    templateType: "frd",
    name: "FRD",
    category: "Documentation" as const,
    description:
      "Functional Requirements Document detailing system features, user interactions, and detailed functional specifications.",
    sections: [
      "introduction",
      "system_overview",
      "functional_requirements",
      "user_stories",
      "use_cases",
      "data_requirements",
      "interface_requirements",
    ],
    gradientClass: "tmpl-preview-gradient-2",
    icon: "◈",
  },
  {
    id: "srs",
    templateType: "srs",
    name: "SRS",
    category: "Documentation" as const,
    description:
      "Software Requirements Specification with comprehensive technical requirements, system constraints, and acceptance criteria.",
    sections: [
      "introduction",
      "overall_description",
      "system_features",
      "external_interface_requirements",
      "non_functional_requirements",
      "other_requirements",
    ],
    gradientClass: "tmpl-preview-gradient-3",
    icon: "⬡",
  },
  {
    id: "architecture",
    templateType: "architecture",
    name: "Architecture",
    category: "Technical" as const,
    description:
      "System architecture document covering technical design, infrastructure, scalability, and integration patterns.",
    sections: [
      "architecture_overview",
      "system_components",
      "technology_stack",
      "data_architecture",
      "security_architecture",
      "deployment_architecture",
      "scalability_performance",
    ],
    gradientClass: "tmpl-preview-gradient-1",
    icon: "⬢",
  },
  {
    id: "sow",
    templateType: "sow",
    name: "SOW",
    category: "Popular" as const,
    description:
      "Statement of Work defining project scope, deliverables, timeline, responsibilities, and terms of engagement.",
    sections: [
      "project_overview",
      "scope_of_work",
      "deliverables",
      "timeline_milestones",
      "roles_responsibilities",
      "payment_terms",
      "acceptance_criteria",
    ],
    gradientClass: "tmpl-preview-gradient-2",
    icon: "◉",
  },
] satisfies ProposalTemplate[];

/**
 * Special card configurations
 *
 * Special action cards displayed in the template selection UI.
 */
export const SPECIAL_CARDS = {
  START_FROM_SCRATCH: {
    id: "start-from-scratch",
    name: "Start From Scratch",
    description: "Build your proposal from the ground up with AI-powered section suggestions tailored to your project needs.",
    icon: "✎",
  },
  CUSTOM_TEMPLATE: {
    id: "custom-template",
    name: "Custom Template",
    description: "Upload your own DOCX or PDF template and let AI extract the structure automatically.",
    icon: "⇪",
  },
  RECREATE_TEMPLATE: {
    id: "recreate-template",
    name: "Recreate Template",
    description: "Upload an existing document and rewrite it with new context while preserving the original structure.",
    icon: "↺",
  },
} as const;
