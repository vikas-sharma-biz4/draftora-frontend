"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import type { CSSProperties } from "react";
import { generateFollowUpDocument, generateProposal, getProposal, getDownloadUrl } from "@/api/proposalApi";
import type { ProposalData } from "@/types/proposal.types";

const FOLLOW_UP_TYPES = [
  {
    key: "brd" as const,
    label: "BRD",
    name: "Business Requirements Document",
    tagline: "Align stakeholders on what to build",
    description:
      "Converts your proposal into a structured BRD — covering business objectives, stakeholder register, AS-IS/TO-BE analysis, KPIs, scope, and high-level acceptance criteria.",
    icon: "📋",
    gradient: "linear-gradient(135deg, #4f46e5 0%, #818cf8 100%)",
    accentColor: "#6366f1",
    keyOutputs: ["Business goals & stakeholder register", "Scope definition & acceptance criteria", "AS-IS / TO-BE process analysis"],
    lockedHint: "Will cover: Business objectives, Stakeholder mapping, Requirements scope",
    sections: [
      "Document Control",
      "Executive Overview",
      "Business Objectives",
      "Stakeholder Register",
      "Current State",
      "Future State",
      "Scope Definition",
      "Business Requirements",
      "User Roles",
      "Process Flows",
      "Data Requirements",
      "Integration Requirements",
      "Compliance",
      "Assumptions",
      "Acceptance Criteria",
      "Glossary",
      "Open Issues",
    ],
  },
  {
    key: "frd" as const,
    label: "FRD",
    name: "Functional Requirements Document",
    tagline: "Define exactly how the system behaves",
    description:
      "Produces a precise FRD with system modules, feature-level requirements, auth flows, integrations, non-functional specs, and a full traceability matrix.",
    icon: "⚙️",
    gradient: "linear-gradient(135deg, #0f766e 0%, #2dd4bf 100%)",
    accentColor: "#0d9488",
    keyOutputs: ["System modules & feature specifications", "Authentication flows & integrations", "Non-functional requirements"],
    lockedHint: "Will cover: System modules, Feature specs, API & auth flows",
    sections: [
      "Document Control",
      "System Overview",
      "System Modules",
      "Functional Requirements",
      "Auth & Authorization",
      "Integrations",
      "Data Management",
      "Reporting",
      "Search & Filter",
      "File Handling",
      "Error Handling",
      "Non-Functional",
      "Constraints",
      "Traceability",
      "Open Items",
    ],
  },
  {
    key: "architecture" as const,
    label: "Architecture",
    name: "Architecture Document",
    tagline: "Design the technical foundation",
    description:
      "Generates a complete architecture document with C4-level diagrams, data architecture, API design, security, infrastructure, CI/CD pipeline, and disaster recovery.",
    icon: "🏗️",
    gradient: "linear-gradient(135deg, #c2410c 0%, #fb923c 100%)",
    accentColor: "#ea580c",
    keyOutputs: ["C4 context, container & component diagrams", "Infrastructure, security & CI/CD design", "API architecture & disaster recovery"],
    lockedHint: "Will cover: C4 diagrams, Infrastructure layout, Security patterns",
    sections: [
      "Document Control",
      "Architecture Overview",
      "System Context",
      "Container View",
      "Component View",
      "Data Architecture",
      "API Design",
      "Auth Architecture",
      "Integration",
      "Infrastructure",
      "Security",
      "Performance",
      "Observability",
      "CI/CD",
      "Disaster Recovery",
      "Decision Records",
      "Technical Debt",
    ],
  },
];

const SECTION_KEYS: Record<string, string[]> = {
  sow: ["sow_executive_summary","sow_objectives","sow_scope_of_work","sow_in_scope","sow_out_of_scope","sow_deliverables","sow_timeline_milestones","sow_assumptions","sow_risks_mitigation","sow_acceptance_criteria"],
  brd: ["brd_document_control","brd_executive_overview","brd_business_objectives","brd_stakeholder_register","brd_current_state","brd_future_state","brd_scope_definition","brd_business_requirements","brd_user_roles","brd_business_process_flows","brd_data_requirements","brd_integration_requirements","brd_compliance","brd_assumptions_constraints","brd_acceptance_criteria","brd_glossary","brd_open_issues"],
  frd: ["frd_document_control","frd_system_overview","frd_system_modules","frd_functional_requirements","frd_auth_authz","frd_integrations","frd_data_management","frd_reporting","frd_search_filter","frd_file_handling","frd_error_handling","frd_non_functional","frd_constraints","frd_traceability","frd_open_items"],
  architecture: ["arch_document_control","arch_overview","arch_context","arch_container","arch_component","arch_data","arch_api","arch_auth_authz","arch_integration","arch_infrastructure","arch_security","arch_performance","arch_observability","arch_cicd","arch_disaster_recovery","arch_adr","arch_technical_debt"],
};

function getSectionsForType(key: string): string[] {
  return SECTION_KEYS[key] ?? [];
}

function getDisplayNamesForType(key: string): Record<string, string> {
  const sectionKeys = getSectionsForType(key);
  const nameMap: Record<string, string> = {
    sow_executive_summary: "Executive Summary",
    sow_objectives: "Objectives",
    sow_scope_of_work: "Scope of Work",
    sow_in_scope: "In-Scope",
    sow_out_of_scope: "Out-of-Scope",
    sow_deliverables: "Deliverables",
    sow_timeline_milestones: "Timeline & Milestones",
    sow_assumptions: "Assumptions",
    sow_risks_mitigation: "Risks & Mitigation",
    sow_acceptance_criteria: "Acceptance Criteria",
    brd_document_control: "Document Control",
    brd_executive_overview: "Executive Overview",
    brd_business_objectives: "Business Objectives",
    brd_stakeholder_register: "Stakeholder Register",
    brd_current_state: "Current State Analysis",
    brd_future_state: "Future State Vision",
    brd_scope_definition: "Scope Definition",
    brd_business_requirements: "Business Requirements",
    brd_user_roles: "User Roles & Personas",
    brd_business_process_flows: "Business Process Flows",
    brd_data_requirements: "Data Requirements",
    brd_integration_requirements: "Integration Requirements",
    brd_compliance: "Compliance & Regulatory",
    brd_assumptions_constraints: "Assumptions & Constraints",
    brd_acceptance_criteria: "Acceptance Criteria",
    brd_glossary: "Glossary",
    brd_open_issues: "Open Issues",
    frd_document_control: "Document Control",
    frd_system_overview: "System Overview",
    frd_system_modules: "System Modules",
    frd_functional_requirements: "Functional Requirements",
    frd_auth_authz: "Authentication & Authorization",
    frd_integrations: "Integration Specifications",
    frd_data_management: "Data Management",
    frd_reporting: "Reporting & Dashboards",
    frd_search_filter: "Search & Filter",
    frd_file_handling: "File Handling",
    frd_error_handling: "Error Handling",
    frd_non_functional: "Non-Functional Requirements",
    frd_constraints: "Constraints & Dependencies",
    frd_traceability: "Traceability Matrix",
    frd_open_items: "Open Items",
    arch_document_control: "Document Control",
    arch_overview: "Architecture Overview",
    arch_context: "System Context (C4 L1)",
    arch_container: "Container Architecture (C4 L2)",
    arch_component: "Component Architecture (C4 L3)",
    arch_data: "Data Architecture",
    arch_api: "API Architecture",
    arch_auth_authz: "Auth & Authorization",
    arch_integration: "Integration Architecture",
    arch_infrastructure: "Infrastructure Architecture",
    arch_security: "Security Architecture",
    arch_performance: "Performance Architecture",
    arch_observability: "Observability Architecture",
    arch_cicd: "CI/CD Architecture",
    arch_disaster_recovery: "Disaster Recovery",
    arch_adr: "Architectural Decision Records",
    arch_technical_debt: "Technical Debt",
  };
  const result: Record<string, string> = {};
  for (const k of sectionKeys) {
    if (nameMap[k]) result[k] = nameMap[k];
  }
  return result;
}

type DocKey = "sow" | "brd" | "frd" | "architecture";
type DocIds = Partial<Record<DocKey, number>>;
const IDS_KEY = (id: number) => `draftora_fp_ids_${id}`;

const SOW_TYPE = {
  key: "sow" as const,
  label: "SOW",
  name: "Statement of Work",
  tagline: "Scope, deliverables & commercial terms",
  description: "A formal document covering project scope, deliverables, milestones, acceptance criteria, and obligations. Must be generated before technical documents.",
  icon: "📝",
  gradient: "linear-gradient(135deg, #1e40af 0%, #60a5fa 100%)",
  accentColor: "#2563eb",
  sections: [
    "Executive Summary",
    "Objectives",
    "Scope of Work",
    "In-Scope",
    "Out-of-Scope",
    "Deliverables",
    "Timeline & Milestones",
    "Assumptions",
    "Risks & Mitigation",
    "Acceptance Criteria",
  ],
};

const PIPELINE = [
  { key: "presale", label: "Pre-Sale" },
  { key: "sow",     label: "SOW" },
  { key: "brd",     label: "BRD" },
  { key: "frd",     label: "FRD" },
  { key: "architecture", label: "Arch" },
];

export default function FollowUpPage(): JSX.Element {
  const params = useParams();
  const router = useRouter();
  const proposalId = Number(params.id);
  const [generating, setGenerating] = useState<string | null>(null);
  const [genStep, setGenStep] = useState<number>(0);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [docIds, setDocIds] = useState<DocIds>({});
  const [approvals, setApprovals] = useState<Partial<Record<DocKey, boolean>>>({});
  const [approvedAt, setApprovedAt] = useState<Partial<Record<DocKey, string>>>({});
  const [showAllDocsModal, setShowAllDocsModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchChecked, setBatchChecked] = useState<Record<DocKey, boolean>>({ sow: true, brd: true, frd: true, architecture: true });
  const [batchJobStatus, setBatchJobStatus] = useState<Record<string, "idle"|"generating"|"done"|"error">>({});
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchFinished, setBatchFinished] = useState(false);
  const [batchDocIds, setBatchDocIds] = useState<Partial<DocIds>>({});
  const [batchFiles, setBatchFiles] = useState<File[]>([]);

  useEffect(() => {
    const loadAndCheck = async () => {
      try {
        const stored = localStorage.getItem(IDS_KEY(proposalId));
        if (!stored) return;
        const ids: DocIds = JSON.parse(stored);
        setDocIds(ids);
        const map: Partial<Record<DocKey, boolean>> = {};
        const atMap: Partial<Record<DocKey, string>> = {};
        await Promise.all(
          (Object.entries(ids) as [DocKey, number][]).map(async ([key, id]) => {
            try {
              const localFlag = localStorage.getItem(`draftora_approved_${id}`) === "1";
              if (localFlag) {
                map[key] = true;
                const ts = localStorage.getItem(`draftora_approved_at_${id}`);
                if (ts) atMap[key] = ts;
                return;
              }
              const doc = await getProposal(id);
              map[key] = doc.approvalStatus === "approved";
              if (map[key]) {
                localStorage.setItem(`draftora_approved_${id}`, "1");
                const ts = localStorage.getItem(`draftora_approved_at_${id}`);
                if (ts) atMap[key] = ts;
              }
            } catch { map[key] = false; }
          })
        );
        setApprovals(map);
        setApprovedAt(atMap);
      } catch { /* ignore */ }
    };
    loadAndCheck();
    const onVisible = () => { if (document.visibilityState === "visible") loadAndCheck(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", loadAndCheck);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", loadAndCheck);
    };
  }, [proposalId]);

  function saveDocId(key: DocKey, id: number) {
    setDocIds(prev => {
      const next = { ...prev, [key]: id };
      try {
        localStorage.setItem(IDS_KEY(proposalId), JSON.stringify(next));
        localStorage.setItem(`draftora_fp_parent_${id}`, String(proposalId));
      } catch { /* ignore */ }
      return next;
    });
  }

  const isLocked = (key: string): boolean => {
    if (isGenerated(key)) return false; // already started via any path — never lock
    if (key === "sow") return false;
    if (key === "brd") return !approvals.sow;
    if (key === "frd") return !approvals.brd;
    if (key === "architecture") return !approvals.frd;
    return false;
  };

  const isGenerated = (key: string): boolean => !!docIds[key as DocKey];
  const isApproved  = (key: string): boolean => !!approvals[key as DocKey];

  const activeStep = !approvals.sow ? "sow" : !approvals.brd ? "brd" : !approvals.frd ? "frd" : !approvals.architecture ? "architecture" : "done";

  const completedCount = 1 + PIPELINE.filter(s => s.key !== "presale" && isApproved(s.key)).length;
  const totalCount = PIPELINE.length;
  const lastDoneKey = [...PIPELINE].reverse().find(s => s.key === "presale" || isApproved(s.key))?.key;

  const nextHints: Record<string, string> = {
    brd: "Next: FRD will be generated from this BRD",
    frd: "Next: Architecture Document will use this FRD",
    architecture: "Final step — pipeline complete after approval",
  };

  const timelineEntries: Array<{ icon: string; text: string; time: string; color: string }> = [
    { icon: "✓", text: "Pre-sale proposal completed", time: "", color: "#16a34a" },
    ...(isGenerated("sow") ? [{ icon: "📄", text: "Statement of Work generated", time: "", color: "#2563eb" }] : []),
    ...(isApproved("sow") ? [{ icon: "✓", text: "SOW approved — BRD unlocked", time: approvedAt.sow ?? "", color: "#16a34a" }] : []),
    ...(isGenerated("brd") ? [{ icon: "📋", text: "Business Requirements Document generated", time: "", color: "#6366f1" }] : []),
    ...(isApproved("brd") ? [{ icon: "✓", text: "BRD approved — FRD unlocked", time: approvedAt.brd ?? "", color: "#16a34a" }] : []),
    ...(isGenerated("frd") ? [{ icon: "📊", text: "Functional Requirements Document generated", time: "", color: "#0891b2" }] : []),
    ...(isApproved("frd") ? [{ icon: "✓", text: "FRD approved — Architecture unlocked", time: approvedAt.frd ?? "", color: "#16a34a" }] : []),
    ...(isGenerated("architecture") ? [{ icon: "🏗️", text: "Architecture Document generated", time: "", color: "#7c3aed" }] : []),
    ...(isApproved("architecture") ? [{ icon: "✓", text: "Architecture approved — Pipeline complete!", time: approvedAt.architecture ?? "", color: "#16a34a" }] : []),
  ];

  async function handleGenerate(docType: "sow" | "brd" | "frd" | "architecture"): Promise<void> {
    setGenerating(docType);
    setGenStep(0);
    const stepTimers = [
      setTimeout(() => setGenStep(1), 1200),
      setTimeout(() => setGenStep(2), 3500),
      setTimeout(() => setGenStep(3), 7000),
    ];
    try {
      // Determine correct source proposal for each document type
      const currentIds: DocIds = (() => {
        try { return JSON.parse(localStorage.getItem(IDS_KEY(proposalId)) || "{}"); }
        catch { return {}; }
      })();
      const sourceId =
        docType === "frd"          ? (currentIds.brd ?? proposalId)
        : docType === "architecture" ? (currentIds.frd ?? proposalId)
        : proposalId;

      const proposal = await getProposal(sourceId);

      let backendId: number | undefined;
      try {
        const result = await generateFollowUpDocument(sourceId, { document_type: docType as "brd" | "frd" | "architecture" });
        if (result.id && !isNaN(result.id)) backendId = result.id;
      } catch { /* backend may not support this type — fall through to generateProposal */ }

      if (backendId) {
        saveDocId(docType, backendId);
        toast.success(`${docType.toUpperCase()} generation started!`);
        await router.push(`/generating/${backendId}`);
        return;
      }

      const selectedSections = getSectionsForType(docType);
      const sectionDisplayNames = getDisplayNamesForType(docType);
      const originalTitle = proposal.title.replace(/^(BRD|FRD|ARCHITECTURE|SOW)\s*-\s*/i, "");

      const newProposalData: ProposalData = {
        title: `${docType.toUpperCase()} - ${originalTitle}`,
        clientName: proposal.clientName,
        description: `Generated ${docType.toUpperCase()} from proposal: ${proposal.title}`,
        tone: proposal.tone,
        lengthPreference: proposal.lengthPreference,
        language: proposal.language,
        aiModel: proposal.aiModel ?? "gpt-4o",
        selectedSections,
        sectionDisplayNames,
        customSections: [],
        contextualInstructions: "",
        webReferences: [],
        files: [],
        filesMeta: [],
        templateId: null,
        templateType: docType === "sow" ? "sow" : "scratch",
        approvalStatus: "pending",
      };

      const createResult = await generateProposal(newProposalData);
      saveDocId(docType, createResult.id);
      toast.success(`${docType.toUpperCase()} created successfully!`);
      await router.push(`/proposal/${createResult.id}`);
    } catch (error) {
      console.error("Follow-up generation error:", error);
      const msg = error instanceof Error ? error.message : `Failed to generate ${docType.toUpperCase()}`;
      toast.error(msg);
    } finally {
      stepTimers.forEach(clearTimeout);
      setGenerating(null);
      setGenStep(0);
    }
  }


  async function handleBatchGenerate() {
    setBatchRunning(true);
    setBatchFinished(false);
    const order: DocKey[] = ["sow", "brd", "frd", "architecture"];
    const selected = order.filter(k => batchChecked[k]);
    const hasRefFiles = batchFiles.length > 0;
    const newIds: Partial<DocIds> = {};
    for (const docType of selected) {
      setBatchJobStatus(prev => ({ ...prev, [docType]: "generating" }));
      try {
        // When reference files are attached, always use generateProposal so files are sent
        if (!hasRefFiles && docType !== "sow") {
          try {
            const result = await generateFollowUpDocument(proposalId, { document_type: docType as "brd" | "frd" | "architecture" });
            if (result.id && !isNaN(result.id)) {
              saveDocId(docType, result.id);
              newIds[docType] = result.id;
              setBatchDocIds(prev => ({ ...prev, [docType]: result.id }));
              setBatchJobStatus(prev => ({ ...prev, [docType]: "done" }));
              continue;
            }
          } catch { /* fall through to generateProposal */ }
        }
        const sourceProposal = await getProposal(proposalId);
        const originalTitle = sourceProposal.title.replace(/^(BRD|FRD|ARCHITECTURE|SOW)\s*-\s*/i, "");
        const refNote = hasRefFiles ? ` (with ${batchFiles.length} reference file${batchFiles.length > 1 ? "s" : ""})` : "";
        const newData: ProposalData = {
          title: `${docType.toUpperCase()} - ${originalTitle}`,
          clientName: sourceProposal.clientName,
          description: `Generated ${docType.toUpperCase()} from proposal: ${sourceProposal.title}${refNote}`,
          tone: sourceProposal.tone,
          lengthPreference: sourceProposal.lengthPreference,
          language: sourceProposal.language,
          aiModel: sourceProposal.aiModel ?? "gpt-4o",
          selectedSections: getSectionsForType(docType),
          sectionDisplayNames: getDisplayNamesForType(docType),
          customSections: [],
          contextualInstructions: hasRefFiles ? `Use the attached reference documents alongside the pre-sale proposal to enrich the ${docType.toUpperCase()} content.` : "",
          webReferences: [],
          files: batchFiles,
          filesMeta: batchFiles.map(f => ({ name: f.name, size: f.size, type: f.type })),
          templateId: null,
          templateType: docType === "sow" ? "sow" : "scratch",
          approvalStatus: "pending",
        };
        const createResult = await generateProposal(newData);
        saveDocId(docType, createResult.id);
        newIds[docType] = createResult.id;
        setBatchDocIds(prev => ({ ...prev, [docType]: createResult.id }));
        setBatchJobStatus(prev => ({ ...prev, [docType]: "done" }));
      } catch {
        setBatchJobStatus(prev => ({ ...prev, [docType]: "error" }));
      }
    }
    setBatchRunning(false);
    setBatchFinished(true);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f4f5fa" }}>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes pulseRing {
          0%   { box-shadow: 0 0 0 0 rgba(99,102,241,0.45); }
          70%  { box-shadow: 0 0 0 10px rgba(99,102,241,0); }
          100% { box-shadow: 0 0 0 0 rgba(99,102,241,0); }
        }
        @keyframes pulseGreenRing {
          0%   { box-shadow: 0 0 0 5px rgba(34,197,94,0.22), 0 2px 12px rgba(34,197,94,0.4); }
          70%  { box-shadow: 0 0 0 12px rgba(34,197,94,0), 0 2px 12px rgba(34,197,94,0.1); }
          100% { box-shadow: 0 0 0 5px rgba(34,197,94,0.22), 0 2px 12px rgba(34,197,94,0.4); }
        }
        @keyframes pulseGlow {
          0%,100% { box-shadow: 0 3px 12px rgba(37,99,235,0.32); }
          50%      { box-shadow: 0 4px 22px rgba(37,99,235,0.62); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes lockedPulse {
          0%,100% { opacity: 0.48; }
          50%      { opacity: 0.65; }
        }
        @keyframes celebrationPop {
          0% { opacity: 0; transform: scale(0.85) translateY(20px); }
          50% { opacity: 1; transform: scale(1.05) translateY(0); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes approvedGlow {
          0%,100% { box-shadow: 0 2px 8px rgba(34,197,94,0.15); }
          50% { box-shadow: 0 4px 16px rgba(34,197,94,0.35); }
        }
      `}</style>

      {/* Nav */}
      <div style={{ background: "rgba(255,255,255,0.97)", backdropFilter: "blur(14px)", borderBottom: "1px solid #e9edf2", padding: "0 32px", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        {/* Brand + Back */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 14, letterSpacing: "-0.5px", flexShrink: 0 }}>D</div>
            <div style={{ lineHeight: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.2px" }}>Draftora</div>
              <div style={{ fontSize: 9, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>Enterprise Edition</div>
            </div>
          </div>
          <div style={{ width: 1, height: 22, background: "#e2e8f0" }} />
          <button onClick={() => router.back()} onMouseEnter={e => (e.currentTarget.style.color = "#4f46e5")} onMouseLeave={e => (e.currentTarget.style.color = "#64748b")} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#64748b", background: "none", border: "none", cursor: "pointer", fontWeight: 600, transition: "color 0.15s", padding: "6px 2px" }}>← Back to Proposal</button>
        </div>
        {/* Right CTA */}
        <button onClick={() => setShowAllDocsModal(true)} onMouseEnter={e => (e.currentTarget.style.background = "#3730a3")} onMouseLeave={e => (e.currentTarget.style.background = "#4f46e5")} style={{ fontSize: 12, color: "#fff", background: "#4f46e5", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6, transition: "background 0.15s" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          View All Docs
        </button>
      </div>

      <div style={{ maxWidth: 1020, margin: "0 auto", padding: "32px 32px 56px" }}>

        {/* Page heading */}
        <div style={{ textAlign: "center", marginBottom: 28, animation: "fadeInUp 0.55s ease both" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#5b21b6", background: "#ede9fe", padding: "4px 12px", borderRadius: 6, marginBottom: 14, border: "1px solid #c4b5fd" }}>CLIENT WORKSPACE · Phase 03</span>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: "#0f172a", marginBottom: 8, letterSpacing: "-0.8px", lineHeight: 1.2 }}>
            {activeStep === "done" ? "🎉 Your project foundation is complete!" : "Let's build your project documentation"}
          </h1>
          <p style={{ fontSize: 13, color: "#64748b", maxWidth: 480, margin: "0 auto 18px", lineHeight: 1.65 }}>
            {activeStep === "done"
              ? "All documents are approved and ready to present to your client."
              : activeStep === "sow"
                ? "Start by generating your Statement of Work — the foundation of all project documents."
                : activeStep === "brd"
                  ? "SOW approved ✅ — you're ready to create your Business Requirements Document."
                  : activeStep === "frd"
                    ? "BRD approved ✅ — now define exactly how the system should behave."
                    : "FRD approved ✅ — one final step: design the technical architecture."}
          </p>
          {/* Progress bar */}
          <div style={{ maxWidth: 380, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "#64748b" }}>{completedCount} of {totalCount} steps complete</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: completedCount === totalCount ? "#15803d" : "#4f46e5" }}>{Math.round((completedCount / totalCount) * 100)}% Complete</span>
            </div>
            <div style={{ height: 7, background: "#e9edf2", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(completedCount / totalCount) * 100}%`, background: completedCount === totalCount ? "linear-gradient(90deg, #22c55e, #4ade80)" : "linear-gradient(90deg, #4f46e5, #818cf8)", borderRadius: 99, transition: "width 0.6s ease" }} />
            </div>
            {completedCount < totalCount && (
              <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 7, fontWeight: 500 }}>
                {activeStep === "sow" ? "Complete SOW to unlock Business Requirements" : activeStep === "brd" ? "Complete BRD to unlock Functional Requirements" : activeStep === "frd" ? "Complete FRD to unlock Architecture Document" : ""}
              </p>
            )}
          </div>
        </div>

        {/* Quick Generate Banner */}
        <div style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)", borderRadius: 12, padding: "16px 22px", marginBottom: 22, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, animation: "fadeInUp 0.55s 0.05s ease both", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>⚡</div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#fff", marginBottom: 2 }}>Parallel Document Generation</div>
              <div style={{ fontSize: 11.5, color: "#a5b4fc", fontWeight: 400 }}>Generate multiple documents simultaneously from your pre-sale proposal</div>
            </div>
          </div>
          <button onClick={() => { setShowBatchModal(true); setBatchJobStatus({}); setBatchFinished(false); }} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.12)", color: "#fff", fontWeight: 700, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, transition: "background 0.15s" }} onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.22)")} onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}>
            Select Documents →
          </button>
        </div>

        {/* Completion celebration banner */}
        {(completedCount === totalCount || activeStep === "done") && (
          <div style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)", border: "1.5px solid #86efac", borderRadius: 14, padding: "16px 28px", marginBottom: 28, display: "flex", alignItems: "center", gap: 14, justifyContent: "center", animation: "celebrationPop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both" }}>
            <span style={{ fontSize: 24, animation: "approvedGlow 2s ease-in-out infinite" }}>🎉</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#15803d", marginBottom: 2 }}>All documents completed successfully!</div>
              <div style={{ fontSize: 12, color: "#16a34a" }}>Your complete project foundation is ready to present.</div>
            </div>
          </div>
        )}

        {/* Pipeline stepper */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 0, marginBottom: 36, animation: "fadeInUp 0.55s 0.08s ease both" }}>
          {PIPELINE.map((step, i) => {
            const stepDone = step.key === "presale" || isApproved(step.key);
            const stepInReview = step.key !== "presale" && isGenerated(step.key) && !isApproved(step.key);
            const stepActive = step.key === activeStep && !stepInReview;
            const isLatestDone = stepDone && step.key === lastDoneKey;
            return (
              <div key={step.key} style={{ display: "flex", alignItems: "center", gap: 0 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: "50%",
                    background: stepDone ? (isLatestDone ? "#22c55e" : "#86efac") : stepInReview ? "#f59e0b" : stepActive ? "#4f46e5" : "#e8ecf0",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: isLatestDone ? "0 0 0 5px #22c55e22, 0 2px 12px #22c55e40" : stepActive ? "0 0 0 4px #4f46e518" : stepInReview ? "0 0 0 4px #f59e0b18" : "none",
                    animation: isLatestDone ? "pulseGreenRing 2.2s ease-in-out infinite" : stepActive ? "pulseRing 1.8s ease-in-out infinite" : "none",
                    transition: "all 0.3s", flexShrink: 0,
                  }}>
                    {stepDone
                      ? <span style={{ color: "#fff", fontSize: 13, fontWeight: 800 }}>✓</span>
                      : stepInReview
                        ? <span style={{ color: "#fff", fontSize: 12, fontWeight: 800 }}>↻</span>
                        : stepActive
                          ? <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#fff", display: "inline-block" }} />
                          : <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#b0bac4", display: "inline-block" }} />
                    }
                  </div>
                  <span style={{ fontSize: 10, fontWeight: isLatestDone || stepActive || stepInReview ? 700 : 500, color: stepDone ? (isLatestDone ? "#15803d" : "#6fc98a") : stepInReview ? "#d97706" : stepActive ? "#4f46e5" : "#94a3b8", whiteSpace: "nowrap" }}>{step.label}</span>
                </div>
                {i < PIPELINE.length - 1 && (
                  <div style={{ width: 60, height: 2, background: isApproved(PIPELINE[i].key) || PIPELINE[i].key === "presale" ? "linear-gradient(90deg, #86efac, #4ade80)" : "#e8ecf0", margin: "0 5px", marginBottom: 20, flexShrink: 0, transition: "background 0.4s", borderRadius: 2 }} />
                )}
              </div>
            );
          })}
        </div>

        {/* SOW — mandatory step */}
        <div style={{
          background: isApproved("sow") ? "#f8fffe" : isGenerated("sow") ? "#fffdf5" : "#fff",
          border: isApproved("sow") ? "1.5px solid #86efac" : isGenerated("sow") ? "1.5px solid #fde68a" : activeStep === "sow" ? "2px solid #4f46e5" : "1.5px solid #e9edf2",
          borderRadius: 14, padding: "20px 24px", marginBottom: 24,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20,
          boxShadow: isApproved("sow") ? "0 2px 8px rgba(34,197,94,0.08)" : isGenerated("sow") ? "0 2px 8px rgba(245,158,11,0.1)" : activeStep === "sow" ? "0 0 0 4px rgba(79,70,229,0.08), 0 4px 20px rgba(79,70,229,0.12)" : "none",
          transition: "all 0.3s",
          animation: `fadeInUp 0.55s 0.16s ease both${isApproved("sow") ? ", approvedGlow 2.5s ease-in-out infinite" : ""}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: SOW_TYPE.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0, boxShadow: "0 4px 12px rgba(37,99,235,0.25)" }}>
              {SOW_TYPE.icon}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <span style={{ display: "inline-block", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fff", background: isApproved("sow") ? "#22c55e" : isGenerated("sow") ? "#d97706" : "#1d4ed8", padding: "2px 9px", borderRadius: 5 }}>SOW</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: "#64748b", letterSpacing: "0.04em" }}>Mandatory · Step 1</span>
                {activeStep === "sow" && <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: "#4f46e5", borderRadius: 99, padding: "2px 9px" }}>👉 Next Step</span>}
                {isGenerated("sow") && !isApproved("sow") && <span style={{ fontSize: 10, background: "#fef9c3", color: "#854d0e", padding: "1px 7px", borderRadius: 99, fontWeight: 700 }}>Awaiting Approval</span>}
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", marginBottom: 3 }}>{SOW_TYPE.name}</h3>
              <p style={{ fontSize: 12.5, color: "#64748b", lineHeight: 1.5, maxWidth: 540, marginBottom: 10 }}>{SOW_TYPE.description}</p>
              {!isApproved("sow") && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {SOW_TYPE.sections.slice(0, 6).map((s) => (
                    <span key={s} style={{ fontSize: 10, padding: "2px 9px", borderRadius: 99, background: "#f4f6f9", color: "#5a6578", fontWeight: 500 }}>{s}</span>
                  ))}
                  <span style={{ fontSize: 10, padding: "2px 9px", borderRadius: 99, background: "#f4f6f9", color: "#94a3b8", fontWeight: 500 }}>+{SOW_TYPE.sections.length - 6} more</span>
                </div>
              )}
            </div>
          </div>
          {isApproved("sow") ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, paddingRight: 12, borderRight: "1px solid #d1fae5" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 800, flexShrink: 0 }}>✓</div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#15803d" }}>Approved</span>
                {approvedAt.sow && <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400 }}>{approvedAt.sow}</span>}
              </div>
              <button onClick={() => router.push(`/proposal/${docIds.sow}`)} style={{ padding: "9px 20px", borderRadius: 9, border: "none", background: "#0f172a", color: "#fff", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>View</button>
              <a href={getDownloadUrl(docIds.sow!)} download style={{ padding: "9px 16px", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "transparent", color: "#374151", fontWeight: 600, fontSize: 12.5, cursor: "pointer", textDecoration: "none" }}>↓ Download</a>
            </div>
          ) : isGenerated("sow") ? (
            <button
              onClick={() => router.push(`/proposal/${docIds.sow}`)}
              style={{ padding: "11px 22px", borderRadius: 12, border: "1.5px solid #fcd34d", background: "#fffbeb", color: "#92400e", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, display: "flex", alignItems: "center", gap: 7 }}
            >
              Review &amp; Approve →
            </button>
          ) : (
            <button
              onClick={() => generating === null && handleGenerate("sow")}
              disabled={generating !== null}
              style={{ padding: "10px 22px", borderRadius: 9, border: "none", background: generating !== null ? "#e2e8f0" : "#4f46e5", color: generating !== null ? "#94a3b8" : "#fff", fontWeight: 700, fontSize: 13, cursor: generating !== null ? "not-allowed" : "pointer", boxShadow: generating !== null ? "none" : "0 3px 12px rgba(79,70,229,0.28)", whiteSpace: "nowrap", flexShrink: 0, transition: "all 0.18s" }}
            >
              {generating === "sow" ? (
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                  Generating…
                </span>
              ) : "Create Statement of Work →"}
            </button>
          )}
        </div>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, transparent, #e2e8f0)" }} />
          <span style={{ fontSize: 10, fontWeight: 800, color: "#b0bac8", textTransform: "uppercase", letterSpacing: "0.18em", whiteSpace: "nowrap" }}>Technical Documents</span>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #e2e8f0, transparent)" }} />
        </div>

        {/* BRD / FRD / Architecture cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {FOLLOW_UP_TYPES.map((doc, cardIdx) => {
            const locked = isLocked(doc.key);
            const done = isApproved(doc.key);
            const inReview = isGenerated(doc.key) && !isApproved(doc.key);
            const isLoading = generating === doc.key;
            const isAnyGenerating = generating !== null;
            const isHovered = hoveredCard === doc.key;
            const accentColor = doc.accentColor;
            const prevDocLabel = doc.key === "brd" ? "SOW" : doc.key === "frd" ? "BRD" : "FRD";
            const unlockNote = `Approve ${prevDocLabel} to unlock this step`;

            const isNextStep = !locked && !done && !inReview;

            const cardStyle: CSSProperties = {
              background: done ? "#f8fffe" : "#fff",
              borderRadius: 14,
              border: done ? "1.5px solid #d1fae5" : inReview ? "1.5px solid #fde68a" : isNextStep ? "2px solid #4f46e5" : "1.5px solid #f0f2f5",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxShadow: locked ? "none" : done ? "0 2px 8px rgba(34,197,94,0.08)" : isNextStep ? "0 0 0 4px rgba(79,70,229,0.08), 0 4px 20px rgba(79,70,229,0.12)" : inReview ? "0 2px 8px rgba(245,158,11,0.1)" : "0 1px 4px rgba(0,0,0,0.05)",
              transform: isNextStep && isHovered ? "translateY(-3px)" : "translateY(0)",
              transition: "all 0.2s cubic-bezier(0.4,0,0.2,1)",
              cursor: locked ? "default" : "pointer",
              position: "relative",
              animation: `fadeInUp 0.55s ${0.22 + cardIdx * 0.1}s ease both${done ? ", approvedGlow 2.5s ease-in-out infinite" : ""}`,
            };

            return (
              <div key={doc.key} style={cardStyle} onMouseEnter={() => !locked && !done && !inReview && setHoveredCard(doc.key)} onMouseLeave={() => setHoveredCard(null)}>

                {/* Compact header row */}
                <div style={{ padding: "16px 18px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${done ? "#d1fae5" : inReview ? "#fde68a" : "#f0f2f5"}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: locked ? "#f1f5f9" : done ? "linear-gradient(135deg, #bbf7d0, #4ade80)" : inReview ? "linear-gradient(135deg, #fef3c7, #fde68a)" : doc.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0, filter: locked ? "grayscale(1) opacity(0.5)" : "none", transition: "transform 0.2s", transform: isHovered && !locked ? "scale(1.1)" : "scale(1)" }}>{doc.icon}</div>
                    <span style={{ display: "inline-block", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: done ? "#15803d" : inReview ? "#92400e" : "#fff", background: done ? "#dcfce7" : inReview ? "#fef3c7" : accentColor, padding: "3px 9px", borderRadius: 5 }}>{doc.label}</span>
                  </div>
                  {done && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#15803d", background: "#dcfce7", border: "1px solid #86efac", borderRadius: 99, padding: "2px 9px" }}>✓ Approved</span>}
                  {inReview && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#92400e", background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 99, padding: "2px 9px" }}>↻ In Review</span>}
                  {isNextStep && <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: "#4f46e5", borderRadius: 99, padding: "2px 9px", letterSpacing: "0.02em" }}>👉 Next Step</span>}
                  {locked && <span style={{ fontSize: 10.5, fontWeight: 600, color: "#94a3b8", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 99, padding: "2px 9px" }}>🔒 Locked</span>}
                </div>

                {/* Body */}
                <div style={{ padding: "14px 18px 18px", display: "flex", flexDirection: "column", flex: 1, opacity: locked ? 0.5 : 1, transition: "opacity 0.3s", animation: locked ? "lockedPulse 3s ease-in-out infinite" : "none" }}>
                  <h3 style={{ fontSize: 14.5, fontWeight: 700, color: isNextStep ? "#0f172a" : "#374151", marginBottom: 3, lineHeight: 1.3 }}>{doc.name}</h3>
                  <p style={{ fontSize: 11.5, fontWeight: 500, color: done ? "#64748b" : inReview ? "#d97706" : accentColor, marginBottom: 10, opacity: 0.85 }}>{doc.tagline}</p>

                  {/* Key outputs — always visible */}
                  <div style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
                    {doc.keyOutputs.map((output: string) => (
                      <div key={output} style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 11.5, color: locked ? "#94a3b8" : done ? "#374151" : "#374151" }}>
                        <span style={{ color: locked ? "#cbd5e1" : done ? "#22c55e" : isNextStep ? "#4f46e5" : inReview ? "#d97706" : "#94a3b8", fontSize: 12, marginTop: 1, flexShrink: 0 }}>{locked ? "○" : done ? "✔" : "✦"}</span>
                        <span style={{ lineHeight: 1.4, fontWeight: locked ? 400 : 500 }}>{output}</span>
                      </div>
                    ))}
                    {locked && <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, padding: "7px 10px", background: "#f8fafc", borderRadius: 7, border: "1px solid #e9edf2", lineHeight: 1.5 }}>{doc.lockedHint}</div>}
                  </div>

                  {inReview && (
                    <div style={{ marginBottom: 12, padding: "7px 12px", background: "#fffbeb", borderRadius: 8, border: "1px solid #fcd34d", fontSize: 11.5, color: "#92400e", lineHeight: 1.5 }}>
                      Review and <strong>Approve</strong> to unlock the next step.
                    </div>
                  )}

                  {done ? (
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                        <span style={{ width: 17, height: 17, borderRadius: "50%", background: "#22c55e", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 9, fontWeight: 800, flexShrink: 0 }}>✓</span>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: "#15803d" }}>Approved</span>
                        {approvedAt[doc.key as DocKey] && <span style={{ fontSize: 10.5, color: "#94a3b8", fontWeight: 400 }}>· {approvedAt[doc.key as DocKey]}</span>}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => router.push(`/proposal/${docIds[doc.key as DocKey]}`)}
                          onMouseEnter={e => { e.currentTarget.style.background = "#1e293b"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "#0f172a"; }}
                          style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "none", background: "#0f172a", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", transition: "background 0.15s" }}>View Doc</button>
                        <a
                          href={getDownloadUrl(docIds[doc.key as DocKey]!)}
                          download
                          style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "transparent", color: "#374151", fontWeight: 600, fontSize: 12, cursor: "pointer", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", transition: "border-color 0.15s" }}>↓ Download</a>
                      </div>
                    </div>
                  ) : inReview ? (
                    <button
                      onClick={() => router.push(`/proposal/${docIds[doc.key as DocKey]}`)}
                      style={{ width: "100%", padding: "10px 0", borderRadius: 11, border: "1.5px solid #fcd34d", background: "#fffbeb", color: "#92400e", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                    >
                      Review &amp; Approve →
                    </button>
                  ) : (
                    <button
                      onClick={() => !locked && !isAnyGenerating && handleGenerate(doc.key as "brd" | "frd" | "architecture")}
                      disabled={locked || isAnyGenerating}
                      style={{
                        width: "100%", padding: "10px 0", borderRadius: 9, border: "none",
                        background: locked ? "#f1f5f9" : isAnyGenerating && !isLoading ? "#e2e8f0" : "#4f46e5",
                        color: locked ? "#94a3b8" : isAnyGenerating && !isLoading ? "#94a3b8" : "#fff",
                        fontWeight: 700, fontSize: 13, cursor: locked || isAnyGenerating ? "not-allowed" : "pointer",
                        boxShadow: !locked && !isAnyGenerating ? "0 3px 12px rgba(79,70,229,0.28)" : "none",
                        transition: "all 0.18s ease",
                      }}
                    >
                      {isLoading ? (
                        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                          <span style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                          Creating… (~20 sec)
                        </span>
                      ) : locked ? `Complete ${prevDocLabel} to unlock` : `Create ${doc.name.split(" ").slice(0,2).join(" ")} →`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Activity Timeline */}
        {timelineEntries.length > 1 && (
          <div style={{ marginTop: 48 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, transparent, #e2e8f0)" }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.14em", whiteSpace: "nowrap" }}>Activity Timeline</span>
              <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #e2e8f0, transparent)" }} />
            </div>
            <div style={{ maxWidth: 540, margin: "0 auto", display: "flex", flexDirection: "column", gap: 0 }}>
              {timelineEntries.map((entry, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 14, paddingBottom: i < timelineEntries.length - 1 ? 28 : 0, position: "relative", padding: "4px 8px", borderRadius: 8, transition: "background 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  {i < timelineEntries.length - 1 && (
                    <div style={{ position: "absolute", left: 19, top: 30, width: 2, bottom: -4, background: "#e9edf2", zIndex: 0 }} />
                  )}
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: entry.color + "12", border: `1.5px solid ${entry.color}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0, zIndex: 1, position: "relative", marginTop: 1 }}>
                    {entry.icon}
                  </div>
                  <div style={{ paddingTop: 3 }}>
                    <span style={{ fontSize: 12.5, color: "#1e293b", fontWeight: 600 }}>{entry.text}</span>
                    {entry.time && <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 8, fontWeight: 400 }}>{entry.time}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Full-screen generation overlay — matches /generating/[id] experience */}
      {generating && (() => {
        const doc = [...FOLLOW_UP_TYPES, SOW_TYPE].find(d => d.key === generating)!;
        const progressPercent = ([8, 30, 65, 90] as const)[genStep as 0|1|2|3] ?? 8;
        const radius = 80;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference - (progressPercent / 100) * circumference;
        const steps = [
          { label: "Validating Knowledge Base",      id: "validate" },
          { label: "Synthesizing Strategic Context", id: "context"  },
          { label: "Structuring Document Outline",   id: "outline"  },
          { label: "Generating Section Content",     id: "content"  },
          { label: "Finalizing Document",            id: "finalize" },
        ];
        const activeStepIndex =
          genStep === 0 ? 0
          : genStep === 1 ? 1
          : genStep === 2 ? 3
          : 4;
        return (
          <div className="generating-page" style={{ position: "fixed", inset: 0, zIndex: 9999 }}>
            <div className="generating-orb generating-orb-1" />
            <div className="generating-orb generating-orb-2" />

            <div className="generating-center">
              {/* SVG circular progress ring */}
              <div className="generating-circle-wrap">
                <svg width="192" height="192" viewBox="0 0 192 192"
                  style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
                  <circle cx="96" cy="96" r={radius} fill="transparent"
                    stroke="var(--color-border)" strokeWidth="6" />
                  <circle cx="96" cy="96" r={radius} fill="transparent"
                    stroke={doc.accentColor} strokeWidth="6"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1)" }} />
                </svg>
                <div className="generating-circle-inner">
                  <div className="generating-circle-icon">✦</div>
                  <div className="generating-circle-pct">{progressPercent}%</div>
                </div>
              </div>

              {/* Headlines */}
              <h1 className="generating-title">
                Generating your{" "}
                <span className="generating-title-accent" style={{ color: doc.accentColor }}>{doc.label}...</span>
              </h1>
              <p className="generating-subtitle">
                Our AI engine is synthesizing your proposal data into a structured {doc.name}. This usually takes 30–90 seconds.
              </p>

              {/* AI processing log */}
              <div className="generating-log">
                <div className="generating-log-header">
                  <span className="generating-log-label">AI Processing</span>
                  <span className="spinner" style={{ width: 12, height: 12 }} aria-label="Loading" />
                </div>
                <ul className="generating-log-steps" role="list">
                  {steps.map((step, index) => {
                    const isDone   = index < activeStepIndex;
                    const isActive = index === activeStepIndex;
                    return (
                      <li key={step.id}
                        className={`generating-log-step${isDone ? " done" : ""}${isActive ? " active" : ""}`}>
                        <span className="generating-log-step-icon" aria-hidden="true">
                          {isDone ? "✓" : isActive ? "›" : "○"}
                        </span>
                        <span className="generating-log-step-label">{step.label}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <button className="generating-cancel" type="button"
                onClick={() => { setGenerating(null); setGenStep(0); }}>
                <span aria-hidden="true">✕</span> Cancel
              </button>
            </div>
          </div>
        );
      })()}

      {/* Batch Generate Modal */}
      {showBatchModal && (() => {
        const ALL_DOCS = [
          SOW_TYPE,
          ...FOLLOW_UP_TYPES,
        ];
        const anySelected = Object.values(batchChecked).some(Boolean);
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(15,23,42,0.65)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn 0.2s ease" }}
            onClick={() => !batchRunning && setShowBatchModal(false)}>
            <div style={{ background: "#fff", borderRadius: 22, padding: "32px 36px", width: "100%", maxWidth: 540, boxShadow: "0 32px 80px rgba(0,0,0,0.22)", border: "1px solid #e2e8f0", animation: "fadeInUp 0.3s ease" }}
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 22 }}>
                <div>
                  <h2 style={{ fontSize: 19, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>⚡ Batch Document Generation</h2>
                  <p style={{ fontSize: 12.5, color: "#64748b", lineHeight: 1.5 }}>Select documents to generate directly from your pre-sale proposal. All selected documents will be generated in parallel without requiring sequential approvals.</p>
                </div>
                {!batchRunning && (
                  <button onClick={() => setShowBatchModal(false)} style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: "#f1f5f9", color: "#64748b", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginLeft: 12 }}>✕</button>
                )}
              </div>

              {/* Document rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
                {ALL_DOCS.map((doc) => {
                  const status = batchJobStatus[doc.key];
                  const isGenerating = status === "generating";
                  const isDone = status === "done";
                  const isError = status === "error";
                  const checked = batchChecked[doc.key];
                  const docId = batchDocIds[doc.key];
                  return (
                    <div key={doc.key} onClick={() => !batchRunning && setBatchChecked(prev => ({ ...prev, [doc.key]: !prev[doc.key] }))}
                      style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 14, border: `1.5px solid ${isDone ? "#86efac" : isError ? "#fca5a5" : isGenerating ? "#c7d2fe" : checked ? "#6366f1" : "#e2e8f0"}`, background: isDone ? "#f0fdf4" : isError ? "#fef2f2" : isGenerating ? "#eef2ff" : checked ? "#fafbff" : "#f8fafc", cursor: batchRunning ? "default" : "pointer", transition: "all 0.15s" }}>
                      {/* Icon */}
                      <div style={{ width: 42, height: 42, borderRadius: 11, background: doc.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{doc.icon}</div>
                      {/* Text */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 1 }}>{doc.name}</div>
                        <div style={{ fontSize: 11.5, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{doc.tagline}</div>
                      </div>
                      {/* Status / checkbox */}
                      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
                        {isDone && docId ? (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={e => { e.stopPropagation(); router.push(`/proposal/${docId}`); }} style={{ padding: "6px 12px", borderRadius: 7, border: "none", background: "#0f172a", color: "#fff", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>View</button>
                            <a href={getDownloadUrl(docId)} download onClick={e => e.stopPropagation()} style={{ padding: "6px 10px", borderRadius: 7, border: "1.5px solid #e2e8f0", color: "#374151", fontWeight: 600, fontSize: 11, cursor: "pointer", textDecoration: "none", display: "flex", alignItems: "center" }}>↓</a>
                          </div>
                        ) : isError ? (
                          <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>✗ Error</span>
                        ) : isGenerating ? (
                          <span style={{ width: 18, height: 18, border: "2.5px solid #c7d2fe", borderTopColor: "#6366f1", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                        ) : (
                          <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${checked ? "#6366f1" : "#cbd5e1"}`, background: checked ? "#6366f1" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
                            {checked && <span style={{ color: "#fff", fontSize: 12, fontWeight: 800 }}>✓</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reference file upload */}
              {!batchRunning && !batchFinished && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0f172a", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>📎</span> Reference Files <span style={{ fontSize: 11, fontWeight: 500, color: "#94a3b8" }}>(optional)</span>
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 11, border: "1.5px dashed #c7d2fe", background: "#f8fafc", cursor: "pointer", transition: "all 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = "#6366f1")}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = "#c7d2fe")}>
                    <input type="file" multiple accept=".pdf,.doc,.docx,.txt,.md" style={{ display: "none" }}
                      onChange={e => {
                        const files = Array.from(e.target.files ?? []);
                        setBatchFiles(prev => {
                          const existing = new Set(prev.map(f => f.name));
                          return [...prev, ...files.filter(f => !existing.has(f.name))];
                        });
                        e.target.value = "";
                      }} />
                    <span style={{ fontSize: 20 }}>⬆️</span>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: "#374151" }}>Upload reference documents</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>PDF, DOC, DOCX, TXT, MD — combined with pre-sale proposal</div>
                    </div>
                  </label>
                  {batchFiles.length > 0 && (
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 5 }}>
                      {batchFiles.map((f, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", background: "#eef2ff", borderRadius: 8, border: "1px solid #c7d2fe" }}>
                          <span style={{ fontSize: 14 }}>📄</span>
                          <span style={{ flex: 1, fontSize: 12, color: "#374151", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                          <span style={{ fontSize: 11, color: "#94a3b8" }}>{(f.size / 1024).toFixed(0)} KB</span>
                          <button onClick={() => setBatchFiles(prev => prev.filter((_, j) => j !== i))}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 14, padding: 0, lineHeight: 1 }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {batchFiles.length > 0 && (
                    <div style={{ marginTop: 8, padding: "7px 12px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #86efac", fontSize: 11.5, color: "#15803d", display: "flex", alignItems: "center", gap: 5 }}>
                      ✓ Pre-sale proposal + {batchFiles.length} reference file{batchFiles.length > 1 ? "s" : ""} = richer document generation
                    </div>
                  )}
                </div>
              )}

              {/* Footer */}
              {batchFinished ? (
                <div style={{ background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: 10, padding: "14px 18px", textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#15803d", marginBottom: 4 }}>🎉 All generations started!</div>
                  <div style={{ fontSize: 12, color: "#16a34a", marginBottom: 12 }}>Documents are being generated. Click View to monitor progress.</div>
                  <button onClick={() => setShowBatchModal(false)} style={{ padding: "9px 24px", borderRadius: 9, border: "none", background: "#15803d", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Back to Pipeline</button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={handleBatchGenerate} disabled={batchRunning || !anySelected}
                    style={{ flex: 1, padding: "12px 0", borderRadius: 11, border: "none", background: batchRunning || !anySelected ? "#e2e8f0" : "linear-gradient(135deg, #4f46e5, #6366f1)", color: batchRunning || !anySelected ? "#94a3b8" : "#fff", fontWeight: 700, fontSize: 14, cursor: batchRunning || !anySelected ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.15s" }}>
                    {batchRunning ? (
                      <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} /> Processing…</>
                    ) : `Start Generation (${Object.values(batchChecked).filter(Boolean).length})`}
                  </button>
                  {!batchRunning && (
                    <button onClick={() => setShowBatchModal(false)} style={{ padding: "12px 20px", borderRadius: 11, border: "1.5px solid #e2e8f0", background: "#fff", color: "#64748b", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* All Documents Modal */}
      {showAllDocsModal && (() => {
        const generatedCount = [docIds.sow, docIds.brd, docIds.frd, docIds.architecture].filter(Boolean).length;
        const approvedCount = PIPELINE.filter(s => s.key !== "presale" && isApproved(s.key)).length;
        const handleDownloadAll = () => {
          ([proposalId, docIds.sow, docIds.brd, docIds.frd, docIds.architecture] as number[]).filter(Boolean).forEach((id, i) => {
            setTimeout(() => { const a = document.createElement("a"); a.href = getDownloadUrl(id); a.download = ""; document.body.appendChild(a); a.click(); document.body.removeChild(a); }, i * 600);
          });
        };
        return (
        <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(15,23,42,0.65)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn 0.2s ease" }} onClick={() => setShowAllDocsModal(false)}>
          <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 510, maxHeight: "88vh", overflow: "auto", boxShadow: "0 32px 80px rgba(0,0,0,0.22)", animation: "fadeInUp 0.3s cubic-bezier(0.34,1.56,0.64,1)" }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            {activeStep === "done" ? (
              <div style={{ padding: "18px 24px 14px", background: "linear-gradient(135deg, #f0fdf4, #dcfce7)", borderBottom: "1px solid #bbf7d0", borderRadius: "20px 20px 0 0", position: "relative", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 24 }}>✅</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#15803d", marginBottom: 1 }}>All documents are ready</div>
                  <div style={{ fontSize: 11.5, color: "#16a34a" }}>Your project documentation is complete and ready for delivery</div>
                </div>
                <button onClick={() => setShowAllDocsModal(false)} style={{ width: 30, height: 30, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.06)", color: "#374151", fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
              </div>
            ) : (
              <div style={{ padding: "20px 24px 14px", borderBottom: "1px solid #f0f2f5", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div>
                  <h2 style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", marginBottom: 3 }}>📂 All Documents</h2>
                  <p style={{ fontSize: 12, color: "#64748b" }}>Track and access your complete document pipeline</p>
                </div>
                <button onClick={() => setShowAllDocsModal(false)} style={{ width: 30, height: 30, borderRadius: "50%", border: "none", background: "#f1f5f9", color: "#64748b", fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} onMouseEnter={e => (e.currentTarget.style.background = "#e2e8f0")} onMouseLeave={e => (e.currentTarget.style.background = "#f1f5f9")}>✕</button>
              </div>
            )}

            {/* Smart summary strip */}
            <div style={{ padding: "8px 24px", background: "#f8fafc", borderBottom: "1px solid #f0f2f5", display: "flex", gap: 14, alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#15803d" }}>✓ {approvedCount} approved</span>
              <span style={{ color: "#e2e8f0" }}>·</span>
              <span style={{ fontSize: 11, color: "#64748b" }}>{generatedCount + 1} of 5 generated</span>
              <span style={{ color: "#e2e8f0" }}>·</span>
              <span style={{ fontSize: 11, color: "#64748b" }}>Ready to share with client</span>
            </div>

            {/* Document List */}
            <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Pre-Sale */}
              <div onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 14px rgba(0,0,0,0.08)"; }} onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", background: "#f8fafc", borderRadius: 11, border: "1px solid #e9edf2", transition: "all 0.2s ease" }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #4f46e5, #818cf8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>📄</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 1 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0f172a" }}>Pre-Sale Proposal</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: "#dcfce7", color: "#15803d" }}>✓ Complete</span>
                  </div>
                  <p style={{ fontSize: 11, color: "#64748b" }}>Foundation for all project documents</p>
                </div>
                <div style={{ display: "flex", gap: 7, flexShrink: 0 }}>
                  <button onClick={() => { router.push(`/proposal/${proposalId}`); setShowAllDocsModal(false); }} style={{ padding: "6px 13px", borderRadius: 7, border: "none", background: "#0f172a", color: "#fff", fontWeight: 600, fontSize: 11.5, cursor: "pointer" }}>View</button>
                  <a href={getDownloadUrl(proposalId)} download style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", cursor: "pointer", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>↓</a>
                </div>
              </div>

              {/* SOW */}
              {isGenerated("sow") ? (
                <div onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = isApproved("sow") ? "0 4px 14px rgba(34,197,94,0.14)" : "0 4px 14px rgba(0,0,0,0.08)"; }} onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", background: isApproved("sow") ? "#f8fffe" : "#fffdf5", borderRadius: 11, border: `1px solid ${isApproved("sow") ? "#86efac" : "#fde68a"}`, transition: "all 0.2s ease" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: SOW_TYPE.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{SOW_TYPE.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 1 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0f172a" }}>{SOW_TYPE.name}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: isApproved("sow") ? "#dcfce7" : "#fef3c7", color: isApproved("sow") ? "#15803d" : "#d97706" }}>{isApproved("sow") ? "✓ Approved" : "↻ In Review"}</span>
                    </div>
                    <p style={{ fontSize: 11, color: "#64748b" }}>Scope, deliverables &amp; commercial terms</p>
                  </div>
                  <div style={{ display: "flex", gap: 7, flexShrink: 0 }}>
                    <button onClick={() => { router.push(`/proposal/${docIds.sow}`); setShowAllDocsModal(false); }} style={{ padding: "6px 13px", borderRadius: 7, border: "none", background: "#0f172a", color: "#fff", fontWeight: 600, fontSize: 11.5, cursor: "pointer" }}>View</button>
                    <a href={getDownloadUrl(docIds.sow!)} download style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", cursor: "pointer", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>↓</a>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 15px", background: "#f8fafc", borderRadius: 11, border: "1px dashed #cbd5e1", opacity: 0.55 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 9, background: "#e9edf2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>📝</div>
                  <div style={{ flex: 1 }}><span style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>{SOW_TYPE.name}</span><p style={{ fontSize: 11, color: "#94a3b8" }}>Not yet generated</p></div>
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "#e9edf2", color: "#64748b", fontWeight: 600 }}>Pending</span>
                </div>
              )}

              {/* BRD, FRD, Architecture */}
              {FOLLOW_UP_TYPES.map((doc) => {
                const generated = isGenerated(doc.key);
                const approved = isApproved(doc.key);
                const isFinal = doc.key === "architecture";
                const docCopy: Record<string, string> = { brd: "Defines what needs to be built", frd: "Specifies detailed system behavior", architecture: "Technical blueprint for development" };
                return generated ? (
                  <div key={doc.key} onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = approved ? "0 4px 14px rgba(34,197,94,0.14)" : "0 4px 14px rgba(0,0,0,0.08)"; }} onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }} style={{ display: "flex", alignItems: "center", gap: 12, padding: isFinal ? "15px 17px" : "13px 15px", background: isFinal ? (approved ? "#fffdf0" : "#fffbeb") : (approved ? "#f8fffe" : "#fffdf5"), borderRadius: 11, border: isFinal ? `2px solid ${approved ? "#fbbf24" : "#fde68a"}` : `1px solid ${approved ? "#86efac" : "#fde68a"}`, transition: "all 0.2s ease", position: "relative" }}>
                    <div style={{ width: isFinal ? 44 : 40, height: isFinal ? 44 : 40, borderRadius: 11, background: doc.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: isFinal ? 21 : 18, flexShrink: 0, boxShadow: isFinal ? "0 2px 10px rgba(0,0,0,0.15)" : "none" }}>{doc.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2, flexWrap: "wrap" }}>
                        <span style={{ fontSize: isFinal ? 13 : 12.5, fontWeight: 700, color: "#0f172a" }}>{doc.name}</span>
                        {isFinal && <span style={{ fontSize: 9.5, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg, #d97706, #f59e0b)", padding: "2px 7px", borderRadius: 5 }}>⭐ Final Output</span>}
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: approved ? "#dcfce7" : "#fef3c7", color: approved ? "#15803d" : "#d97706" }}>{approved ? "✓ Approved" : "↻ In Review"}</span>
                      </div>
                      <p style={{ fontSize: 11, color: "#64748b" }}>{docCopy[doc.key] ?? doc.tagline}</p>
                    </div>
                    <div style={{ display: "flex", gap: 7, flexShrink: 0 }}>
                      <button onClick={() => { router.push(`/proposal/${docIds[doc.key as DocKey]}`); setShowAllDocsModal(false); }} style={{ padding: "6px 13px", borderRadius: 7, border: "none", background: "#0f172a", color: "#fff", fontWeight: 600, fontSize: 11.5, cursor: "pointer" }}>View</button>
                      <a href={getDownloadUrl(docIds[doc.key as DocKey]!)} download style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", cursor: "pointer", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>↓</a>
                    </div>
                  </div>
                ) : (
                  <div key={doc.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 15px", background: "#f8fafc", borderRadius: 11, border: "1px dashed #cbd5e1", opacity: 0.55 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 9, background: "#e9edf2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>{doc.icon}</div>
                    <div style={{ flex: 1 }}><span style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>{doc.name}</span><p style={{ fontSize: 11, color: "#94a3b8" }}>Not yet generated</p></div>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "#e9edf2", color: "#64748b", fontWeight: 600 }}>Pending</span>
                  </div>
                );
              })}
            </div>

            {/* Footer — Download Package CTA */}
            <div style={{ padding: "0 20px 22px" }}>
              <p style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginBottom: 10 }}>Ready to share with your client or development team</p>
              <button onClick={handleDownloadAll} style={{ width: "100%", padding: "12px", borderRadius: 11, background: "linear-gradient(135deg, #1e1b4b, #4f46e5)", color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: "pointer", border: "none", boxShadow: "0 4px 16px rgba(79,70,229,0.32)", letterSpacing: "0.01em", transition: "all 0.2s ease" }} onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 22px rgba(79,70,229,0.45)"; e.currentTarget.style.transform = "translateY(-1px)"; }} onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(79,70,229,0.32)"; e.currentTarget.style.transform = ""; }}>
                📦 Download Complete Project Package
              </button>
            </div>

          </div>
        </div>
        );
      })()}
    </div>
  );
}
