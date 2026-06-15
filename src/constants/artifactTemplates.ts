/**
 * Frontend artifact template registry.
 *
 * Contains display-side metadata only (id, displayName, description).
 * The actual prompt templates and invoice HTML live in the backend
 * `app/features/draftora/artifact/templates.py`.
 */

import type { ArtifactTemplate } from "@/interfaces/artifactInterfaces";

export const EMAIL_TEMPLATES: ArtifactTemplate[] = [
  {
    id: "enterprise_partnership",
    displayName: "Enterprise Partnership",
    description:
      "Strategic enterprise-focused communication emphasizing expertise and long-term partnership.",
  },
  {
    id: "advisory_phased_delivery",
    displayName: "Advisory & Phased Delivery",
    description:
      "Consultative communication recommending phased implementation and cost optimization.",
  },
  {
    id: "saas_product_launch",
    displayName: "SaaS Product Launch",
    description: "MVP-focused communication emphasizing scalability and product strategy.",
  },
];

export const INVOICE_TEMPLATES: ArtifactTemplate[] = [
  {
    id: "standard_invoice",
    displayName: "Standard Invoice",
    description:
      "Professional invoice with project scope line items and Biz4Group payment details.",
  },
];
