import type { ProposalListItem } from "@/interfaces/proposalInterfaces";

const TEMPLATE_ID_LABELS: Record<string, string> = {
  saas: "SaaS",
  consulting: "Consulting",
  agency: "Agency",
  ecommerce: "E-Commerce",
  enterprise: "Enterprise",
};

/**
 * Returns a human-readable label for a proposal's template type.
 * Prefers the templateId lookup table; falls back to templateType.
 */
export function getTemplateTypeLabel(
  proposal: Pick<ProposalListItem, "templateId" | "templateType">
): string {
  if (proposal.templateId) {
    return TEMPLATE_ID_LABELS[proposal.templateId] ?? proposal.templateId;
  }

  switch (proposal.templateType) {
    case "predefined":
      return "Template";
    case "custom":
      return "Custom";
    case "scratch":
      return "From Scratch";
    case "recreate":
      return "Recreated";
    default:
      return proposal.templateType || "Template";
  }
}
