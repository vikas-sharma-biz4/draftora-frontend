/**
 * Proposal-related constants
 *
 * Defines AI model options, tone options, length preferences, section configurations,
 * and other proposal generation metadata.
 */

/**
 * AI model options for proposal generation
 */
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

/**
 * Tone options for proposal writing style
 */
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

/**
 * Length options for proposal sections
 */
export const LENGTH_OPTIONS = [
  { value: "concise", label: "Concise", description: "150–250 words per section. Sharp and to the point." },
  { value: "balanced", label: "Balanced", description: "300–450 words per section. Comprehensive yet readable." },
  { value: "comprehensive", label: "Comprehensive", description: "500–700 words per section. Full depth and detail." },
] as const;

/**
 * Section options for proposal structure
 */
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

/**
 * Language options for proposal generation
 */
export const LANGUAGE_OPTIONS = [
  "English - US",
  "English - UK",
  "Spanish",
  "French",
  "German",
] as const;

/**
 * Default selected sections for new proposals
 */
export const DEFAULT_SELECTED_SECTIONS = SECTION_OPTIONS.map((s) => s.key);

/**
 * Default sections for "Start From Scratch" template
 */
export const SCRATCH_TEMPLATE_DEFAULT_SECTIONS = [
  "introduction",
  "purpose",
  "high_level_scope",
  "proposed_solution",
  "system_architecture",
  "implementation_plan",
  "timeline",
  "conclusion",
] as const;

/**
 * Display names for proposal sections
 */
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

/**
 * Static section keys - sections that are automatically appended to every proposal
 */
export const STATIC_SECTION_KEYS = [
  "trusted_advisors",
  "our_trusted_clients",
  "why_choose_us",
  "brain_behind_development",
] as const;

export type StaticSectionKey = (typeof STATIC_SECTION_KEYS)[number];

/**
 * Display names for static sections
 */
export const STATIC_SECTION_DISPLAY_NAMES: Record<string, string> = {
  trusted_advisors: "Trusted Advisors",
  our_trusted_clients: "Our Trusted Clients",
  why_choose_us: "Why Choose Us?",
  brain_behind_development: "Brain Behind Innovative Development",
};

/**
 * Industry options for client classification
 */
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

/**
 * Client tier classifications
 */
export const CLIENT_TIERS = [
  "Enterprise",
  "Mid-Market",
  "Small Business",
] as const;
