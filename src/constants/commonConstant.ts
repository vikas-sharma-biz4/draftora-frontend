import type { ProposalTemplate } from "@/interfaces/proposalInterfaces";

export const SIDEBAR_LOGO_SRC = "/images/new%20logo%203.png";

export const TONE_OPTIONS = [
  {
    value: "professional",
    label: "Professional",
    icon: "✦",
    description: "Formal, authoritative, and industry-standard tone.",
  },
  {
    value: "persuasive",
    label: "Persuasive",
    icon: "◈",
    description: "Focused on conversion and benefit-driven logic.",
  },
  {
    value: "technical",
    label: "Technical",
    icon: "⊞",
    description: "Deep dive into specs, data, and methodologies.",
  },
  {
    value: "creative",
    label: "Creative",
    icon: "✳",
    description: "Innovative, story-driven, and expressive style.",
  },
] as const;

export const LENGTH_OPTIONS = [
  {
    value: "concise",
    label: "Concise",
    description: "150–250 words per section. Sharp and to the point.",
  },
  {
    value: "balanced",
    label: "Balanced",
    description: "300–450 words per section. Comprehensive yet readable.",
  },
  {
    value: "comprehensive",
    label: "Comprehensive",
    description: "500–700 words per section. Full depth and detail.",
  },
] as const;

export const SECTION_OPTIONS = [
  {
    key: "executive_summary",
    label: "Executive Summary",
    description: "High-level overview for stakeholders.",
  },
  {
    key: "project_understanding",
    label: "Project Understanding",
    description: "Analysis of client needs and goals.",
  },
  {
    key: "proposed_solution",
    label: "Proposed Solution",
    description: "Detailed solution approach.",
  },
  {
    key: "system_architecture",
    label: "System Architecture",
    description: "Technical architecture and stack.",
  },
  {
    key: "implementation_plan",
    label: "Implementation Plan",
    description: "Step-by-step execution strategy.",
  },
  {
    key: "timeline",
    label: "Implementation Timeline",
    description: "Visual roadmap of the project lifecycle.",
  },
] as const;

export const LANGUAGE_OPTIONS = [
  "English - US",
  "English - UK",
  "Spanish",
  "French",
  "German",
] as const;

export const DEFAULT_SELECTED_SECTIONS = SECTION_OPTIONS.map((s) => s.key);

// Default sections for "Start From Scratch" template
export const SCRATCH_TEMPLATE_DEFAULT_SECTIONS = [
  "introduction",
  "purpose",
  "high_level_scope",
  "proposed_solution",
  "system_architecture",
  "implementation_plan",
  "timeline",
] as const;

export const SECTION_DISPLAY_NAMES: Record<string, string> = {
  executive_summary: "Executive Summary",
  project_understanding: "Project Understanding",
  proposed_solution: "Proposed Solution",
  system_architecture: "System Architecture",
  user_flow: "User Journey",
  implementation_plan: "Implementation Plan",
  timeline: "Timeline",
  conclusion: "Conclusion",
  similar_projects: "Similar Projects Developed By Biz4Group Experts",
  introduction: "Introduction",
  purpose: "Purpose",
  high_level_scope: "High-Level Scope of the Project",
  high_level_feature_list: "High-Level Feature List",
  non_functional_requirements: "Non-Functional Requirements (NFRs)",
  proposed_technology_stack: "Proposed Technology Stack",
  milestone_timeline: "Milestone and Timeline Estimations (MVP)",
  risks_assumptions: "Risks/Assumptions and Mitigations",
  client_dependencies: "Client Dependencies",
  communication_client_cadence: "Communication & Client Cadence",
  our_approach_methodology: "Our Approach & Methodology",
  poc_feature_list: "Feature List",
  poc_milestone_timeline: "Milestone and Timeline Estimation",
  future_vision: "Future Vision",
  scope_of_work: "Scope of Work",
  poc_features_list: "POC Features List",
  estimated_timeline: "Estimated Timeline",
  deliverables: "Deliverables",
  our_proven_approach: "Our Proven Approach for Your Project",
};

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
    id: "full-proposal",
    templateType: "full",
    name: "Full Proposal",
    category: "Popular" as const,
    description:
      "Comprehensive proposal for full product delivery with complete feature scope, implementation plan, and go-to-market strategy.",
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
    gradientClass: "tmpl-preview-gradient-2",
    icon: "◼",
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
      "scope_of_work",
      "poc_features_list",
      "estimated_timeline",
      "deliverables",
      "our_proven_approach",
      "similar_projects",
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
] as unknown as Array<ProposalTemplate>;

// ── Static sections ──────────────────────────────────────────────────────────
// These are automatically appended at the end of every proposal. Their content
// is fixed and not AI-generated. They are editable post-generation.

export const STATIC_SECTION_KEYS = [
  "trusted_advisors",
  "our_trusted_clients",
  "why_choose_us",
  "brain_behind_development",
] as const;

export type StaticSectionKey = (typeof STATIC_SECTION_KEYS)[number];

export const STATIC_SECTION_DISPLAY_NAMES: Record<string, string> = {
  trusted_advisors: "Trusted Advisors",
  our_trusted_clients: "Our Trusted Clients",
  why_choose_us: "Why Choose Us?",
  brain_behind_development: "Brain Behind Innovative Development",
};

// ── RichEditor toolbar colors ─────────────────────────────────────────────────
// Empty string represents "remove highlight / default color" action.
// "custom" string represents custom color picker option.
export const EDITOR_HIGHLIGHT_COLORS: string[] = [
  "#fef08a", // yellow
  "#bfdbfe", // blue
  "custom", // custom color picker
  "", // remove
];

export const EDITOR_TEXT_COLORS: string[] = [
  "#000000", // Black
  "#1d4ed8", // Blue
  "custom", // custom color picker
  "", // default
];

export const GENERATION_STEPS = [
  { id: "parsing", label: "Parsing Uploaded Documents" },
  { id: "validating", label: "Validating Knowledge Base" },
  { id: "synthesizing", label: "Synthesizing Strategic Context" },
  { id: "structuring", label: "Structuring Proposal Outline" },
  { id: "generating", label: "Generating Section Content" },
  { id: "finalizing", label: "Finalizing Document" },
] as const;

export const SPECIAL_CARDS = {
  START_FROM_SCRATCH: {
    id: "start-from-scratch",
    name: "Start From Scratch",
    description:
      "Build your proposal from the ground up with AI-powered section suggestions tailored to your project needs.",
    icon: "✎",
  },
  CUSTOM_TEMPLATE: {
    id: "custom-template",
    name: "Custom Template",
    description:
      "Upload your own DOCX or PDF template and let AI extract the structure automatically.",
    icon: "⇪",
  },
} as const;

export const INDUSTRIES = [
  "Financial Services",
  "Healthcare",
  "Technology",
  "Manufacturing",
  "Retail",
  "Education",
  "Real Estate",
  "Consulting",
  "Other",
] as const;

// ── Template TOCs (Table of Contents) ───────────────────────────────────────────
// Maps template types to their predefined section structures
export const TEMPLATE_TOCS = {
  mvp: [
    { key: "introduction", label: "Introduction" },
    { key: "purpose", label: "Purpose" },
    { key: "high_level_scope", label: "High-Level Scope of the Project" },
    { key: "high_level_feature_list", label: "High-Level Feature List" },
    { key: "non_functional_requirements", label: "Non-Functional Requirements (NFRs)" },
    { key: "proposed_technology_stack", label: "Proposed Technology Stack" },
    { key: "system_architecture", label: "System Architecture" },
    { key: "user_flow", label: "User Journey" },
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
    { key: "prototypes_developed", label: "Similar Prototypes Developed by Biz4Group Experts" },
  ],
  poc: [
    { key: "introduction", label: "Introduction" },
    { key: "purpose", label: "Purpose" },
    { key: "scope_of_work", label: "Scope of Work" },
    { key: "poc_features_list", label: "POC Features List" },
    { key: "estimated_timeline", label: "Estimated Timeline" },
    { key: "deliverables", label: "Deliverables" },
    { key: "our_proven_approach", label: "Our Proven Approach for Your Project" },
    { key: "similar_projects", label: "Similar Projects Developed by Biz4Group Experts" },
  ],
  full: [
    { key: "introduction", label: "Introduction" },
    { key: "purpose", label: "Purpose" },
    { key: "high_level_scope", label: "High-Level Scope of the Project" },
    { key: "high_level_feature_list", label: "High-Level Feature List" },
    { key: "non_functional_requirements", label: "Non-Functional Requirements (NFRs)" },
    { key: "proposed_technology_stack", label: "Proposed Technology Stack" },
    { key: "system_architecture", label: "System Architecture" },
    { key: "user_flow", label: "User Journey" },
    { key: "milestone_timeline", label: "Milestone and Timeline Estimations" },
    { key: "risks_assumptions", label: "Risks/Assumptions and Mitigations" },
    { key: "client_dependencies", label: "Client Dependencies" },
    { key: "communication_client_cadence", label: "Communication & Client Cadence" },
    { key: "similar_projects", label: "Similar Projects Developed By Biz4Group Experts" },
    { key: "our_approach_methodology", label: "Our Approach & Methodology" },
  ],
} as const;

// ── Breakpoints (must match SCSS $bp-* in _variables.scss) ────────────────────
export const BREAKPOINTS = {
  mobile: 640,
  tablet: 1024,
  desktop: 1280,
  wide: 1536,
} as const;
