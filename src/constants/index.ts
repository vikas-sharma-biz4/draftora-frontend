export const AI_MODEL_OPTIONS = [
  {
    value: "gpt-4o",
    label: "GPT-4o",
    provider: "OpenAI",
    description: "Fast, highly capable model. Best for most proposals.",
  },
  {
    value: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    provider: "Anthropic",
    description: "Exceptional writing quality and nuanced language.",
  },
] as const;

export const AI_MODEL_DEFAULT = "gpt-4o";

export const WIZARD_STEPS = [
  { step: 1, label: "Define Scope", path: "/" },
  { step: 2, label: "Knowledge Base", path: "/knowledge-base" },
  { step: 3, label: "Templates", path: "/templates" },
  { step: 4, label: "Parameters", path: "/parameters" },
  { step: 5, label: "Review", path: "/review" },
] as const;

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
  { value: "concise", label: "Concise", description: "150–250 words per section. Sharp and to the point." },
  { value: "balanced", label: "Balanced", description: "300–450 words per section. Comprehensive yet readable." },
  { value: "comprehensive", label: "Comprehensive", description: "500–700 words per section. Full depth and detail." },
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
  {
    key: "conclusion",
    label: "Conclusion",
    description: "Summary and next steps.",
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

export const SECTION_DISPLAY_NAMES: Record<string, string> = {
  executive_summary: "Executive Summary",
  project_understanding: "Project Understanding",
  proposed_solution: "Proposed Solution",
  system_architecture: "System Architecture",
  user_flow: "User Flow Diagram",
  implementation_plan: "Implementation Plan",
  timeline: "Timeline",
  conclusion: "Conclusion",
  similar_projects: "Similar Projects Developed By Biz4Group Experts",
  introduction: "Introduction",
  purpose: "Purpose",
  high_level_scope: "High-Level Scope of the Project",
  high_level_feature_list: "High-Level Feature List — MVP",
  non_functional_requirements: "Non-Functional Requirements (NFRs)",
  proposed_technology_stack: "Proposed Technology Stack",
  milestone_timeline: "Milestone and Timeline Estimations (MVP)",
  risks_assumptions: "Risks/Assumptions and Mitigations",
  client_dependencies: "Client Dependencies",
  communication_client_cadence: "Communication & Client Cadence",
  our_approach_methodology: "Our Approach & Methodology",
};

export const PROPOSAL_TEMPLATES = [
  {
    id: "mvp-proposal",
    templateType: "mvp",
    name: "MVP Proposal",
    category: "Popular" as const,
    description:
      "Fast-track proposal for minimum viable product delivery with core feature scope, lean implementation, and rapid go-to-market strategy.",
    // Dynamic sections (AI-generated based on project context)
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
    gradientClass: "template-card-preview-gradient-1",
    icon: "▲",
  },
  {
    id: "poc-discovery",
    templateType: "poc",
    name: "POC and Discovery",
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
    gradientClass: "template-card-preview-gradient-2",
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
    gradientClass: "template-card-preview-gradient-3",
    icon: "✦",
  },
] as const;

export const CUSTOM_TEMPLATES_STORAGE_KEY = "draftora_custom_templates_v1";

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

// Drafts storage key
export const DRAFTS_STORAGE_KEY = "draftora_drafts_v1";

// ── RichEditor toolbar colors ─────────────────────────────────────────────────
// Empty string represents "remove highlight / default color" action.
export const EDITOR_HIGHLIGHT_COLORS: string[] = [
  "#fef08a",
  "#bbf7d0",
  "#bfdbfe",
  "#fecaca",
  "",
];

export const EDITOR_TEXT_COLORS: string[] = [
  "#1e1b4b",
  "#047857",
  "#1d4ed8",
  "#b91c1c",
  "#92400e",
  "",
];

export const GENERATION_STEPS = [
  { id: "parsing", label: "Parsing Uploaded Documents" },
  { id: "validating", label: "Validating Knowledge Base" },
  { id: "synthesizing", label: "Synthesizing Strategic Context" },
  { id: "structuring", label: "Structuring Proposal Outline" },
  { id: "generating", label: "Generating Section Content" },
  { id: "finalizing", label: "Finalizing Document" },
] as const;
