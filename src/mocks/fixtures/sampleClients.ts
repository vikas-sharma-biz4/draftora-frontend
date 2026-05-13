/**
 * Sample client fixture data — development and testing only
 *
 * This file is located under src/mocks/ so it is excluded from
 * the production bundle. Import only in test files or dev-only utilities.
 */

import { logger } from "@/utils/logger";

interface SampleClientDocument {
  id: string;
  name: string;
  size: string;
  date: string;
  status: "parsed" | "processing";
  fileType: "pdf" | "docx" | "xlsx" | "pptx";
  selected?: boolean;
}

interface SampleProposal {
  id: string;
  name: string;
  version: string;
  type: string;
  date: string;
  status: "finalized" | "in-review" | "draft";
}

interface SampleClient {
  id: string;
  name: string;
  industry: string;
  tier: string;
  onboardedDate: string;
  status: "active" | "inactive";
  documents: SampleClientDocument[];
  proposals: SampleProposal[];
  primaryContact?: { name: string; email: string };
  pipelineStage?: string;
  notes?: string;
}

export const SAMPLE_CLIENTS: SampleClient[] = [
  {
    id: "client-acme-global",
    name: "Acme Global",
    industry: "Financial Services",
    tier: "Enterprise",
    onboardedDate: "Q1 2024",
    status: "active",
    primaryContact: {
      name: "John Smith",
      email: "john.smith@acmeglobal.com",
    },
    pipelineStage: "Proposal",
    notes: "Large enterprise client with multiple ongoing projects",
    documents: [
      {
        id: "doc-1",
        name: "Acme_Q3_Financials_Final.pdf",
        size: "2.4 MB",
        date: "Oct 12, 2024",
        status: "parsed",
        fileType: "pdf",
        selected: false,
      },
      {
        id: "doc-2",
        name: "Brand_Guidelines_2024.docx",
        size: "856 KB",
        date: "Sep 05, 2024",
        status: "parsed",
        fileType: "docx",
        selected: false,
      },
      {
        id: "doc-3",
        name: "Competitor_Analysis_Matrix.xlsx",
        size: "1.2 MB",
        date: "Aug 22, 2024",
        status: "parsed",
        fileType: "xlsx",
        selected: false,
      },
    ],
    proposals: [
      {
        id: "prop-1",
        name: "Digital Transformation BRD",
        version: "Version 2.1",
        type: "BRD",
        date: "Nov 14, 2024",
        status: "finalized",
      },
      {
        id: "prop-2",
        name: "Cloud Migration MVP Pitch",
        version: "Version 1.0",
        type: "MVP",
        date: "Oct 28, 2024",
        status: "finalized",
      },
      {
        id: "prop-3",
        name: "Security Audit POC",
        version: "Draft in Progress",
        type: "POC",
        date: "Nov 18, 2024",
        status: "in-review",
      },
    ],
  },
  {
    id: "client-techcorp",
    name: "TechCorp Industries",
    industry: "Technology",
    tier: "Mid-Market",
    onboardedDate: "Q2 2024",
    status: "active",
    primaryContact: {
      name: "Sarah Johnson",
      email: "sarah.j@techcorp.io",
    },
    pipelineStage: "Discovery",
    documents: [
      {
        id: "doc-tech-1",
        name: "Product_Roadmap_2024.pdf",
        size: "1.8 MB",
        date: "Nov 01, 2024",
        status: "parsed",
        fileType: "pdf",
        selected: false,
      },
      {
        id: "doc-tech-2",
        name: "Technical_Requirements.docx",
        size: "645 KB",
        date: "Oct 15, 2024",
        status: "parsed",
        fileType: "docx",
        selected: false,
      },
    ],
    proposals: [
      {
        id: "prop-tech-1",
        name: "SaaS Platform Architecture",
        version: "Version 1.0",
        type: "Architecture",
        date: "Nov 10, 2024",
        status: "finalized",
      },
    ],
  },
  {
    id: "client-healthplus",
    name: "HealthPlus Medical",
    industry: "Healthcare",
    tier: "Enterprise",
    onboardedDate: "Q3 2024",
    status: "active",
    primaryContact: {
      name: "Dr. Michael Chen",
      email: "m.chen@healthplus.com",
    },
    pipelineStage: "Negotiation",
    documents: [
      {
        id: "doc-health-1",
        name: "HIPAA_Compliance_Checklist.pdf",
        size: "980 KB",
        date: "Nov 05, 2024",
        status: "parsed",
        fileType: "pdf",
        selected: false,
      },
      {
        id: "doc-health-2",
        name: "Patient_Portal_Requirements.docx",
        size: "1.1 MB",
        date: "Oct 28, 2024",
        status: "parsed",
        fileType: "docx",
        selected: false,
      },
      {
        id: "doc-health-3",
        name: "Integration_Specifications.xlsx",
        size: "756 KB",
        date: "Oct 20, 2024",
        status: "processing",
        fileType: "xlsx",
        selected: false,
      },
    ],
    proposals: [
      {
        id: "prop-health-1",
        name: "Telehealth Platform SRS",
        version: "Version 1.2",
        type: "SRS",
        date: "Nov 12, 2024",
        status: "in-review",
      },
      {
        id: "prop-health-2",
        name: "EHR Integration FRD",
        version: "Version 1.0",
        type: "FRD",
        date: "Oct 30, 2024",
        status: "finalized",
      },
    ],
  },
];

/**
 * Seeds sample client data into localStorage for development/testing.
 *
 * Only runs in development mode — no-op in production and staging.
 * This prevents fake data from appearing in user-facing environments.
 */
export function initializeSampleClients(): void {
  if (process.env.NODE_ENV !== "development") return;
  if (typeof window === "undefined") return;

  const CLIENTS_STORAGE_KEY = "draftora_clients_v1";
  const existing = localStorage.getItem(CLIENTS_STORAGE_KEY);

  if (!existing) {
    localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(SAMPLE_CLIENTS));
    logger.debug("Sample clients initialized");
  }
}
