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
    id: "professional_outreach",
    displayName: "Professional Outreach",
    description:
      "Highly personalised email with scope highlights and Biz4Group strengths woven into a single bullet list, plus proposal, portfolio, and podcast links.",
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

export const NDA_TEMPLATES: ArtifactTemplate[] = [
  {
    id: "standard_nda",
    displayName: "Standard NDA",
    description: "Mutual Non-Disclosure Agreement between Biz4Group LLC and the Second Party.",
  },
];

export const PODCAST_TEMPLATES: ArtifactTemplate[] = [
  {
    id: "notebooklm_podcast_prompt",
    displayName: "NotebookLM Podcast Prompt",
    description:
      "Generates a plain-text Video Overview prompt to paste into NotebookLM, producing a two-speaker business podcast from your proposal.",
  },
];
