import type { ProposalListItem } from "@/interfaces/proposalInterfaces";

const TEMPLATE_ID_LABELS: Record<string, string> = {
  saas: "SaaS",
  consulting: "Consulting",
  agency: "Agency",
  ecommerce: "E-Commerce",
  enterprise: "Enterprise",
  // Common template types — normalized to consistent casing
  sow: "SOW",
  mvp: "MVP",
  poc: "POC",
  brd: "BRD",
  frd: "FRD",
  srs: "SRS",
  full: "Full Proposal",
  design: "Design (IP)",
  architecture: "Architecture",
  predefined: "Template",
  custom: "Custom",
  scratch: "From Scratch",
};

/**
 * Returns a human-readable label for a proposal's template type.
 * Prefers the templateId lookup table; falls back to templateType.
 * All lookups are case-insensitive so "sow" and "SOW" both resolve to "SOW".
 */
export function getTemplateTypeLabel(
  proposal: Pick<ProposalListItem, "templateId" | "templateType">
): string {
  const key = (proposal.templateId ?? proposal.templateType ?? "").toLowerCase();
  return TEMPLATE_ID_LABELS[key] ?? proposal.templateId ?? proposal.templateType ?? "Template";
}
