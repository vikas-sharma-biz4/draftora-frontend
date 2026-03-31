"use client";

import { useRouter } from "next/navigation";

import styles from "./page.module.scss";

import Sidebar from "@/components/common/Sidebar";
import { useProposal } from "@/context/ProposalContext";
import { useSaveDraft } from "@/hooks/useSaveDraft";

export default function StepOnePage(): JSX.Element {
  const { proposalData, updateProposalData, setCurrentStep } = useProposal();
  const router = useRouter();
  const handleSaveDraft = useSaveDraft();

  function handleNext(): void {
    if (!proposalData.title.trim() || !proposalData.clientName.trim()) {
      alert("Please provide a Proposal Title and Client Name before continuing.");
      return;
    }
    setCurrentStep(2);
    router.push("/knowledge-base");
  }

  const descriptionTags = extractTags(proposalData.description);

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <div className="page-badge">Creation Workflow</div>
        <h1 className="page-title">Step 1: Core Objectives &amp; Context</h1>
        <p className="page-subtitle">
          Define the proposal title, target client, and the strategic objective.
          The richer your prompt, the more accurate and tailored your AI-generated
          proposal will be.
        </p>

        <div className="grid-2 mb-24">
          <div className="form-group">
            <label className="form-label">Proposal Title</label>
            <input
              className="form-input"
              type="text"
              placeholder="Enterprise Solution for Nexus Corp"
              value={proposalData.title}
              onChange={(e) =>
                updateProposalData({ title: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label className="form-label">Client Name</label>
            <input
              className="form-input"
              type="text"
              placeholder="Nexus Corp"
              value={proposalData.clientName}
              onChange={(e) =>
                updateProposalData({ clientName: e.target.value })
              }
            />
          </div>
        </div>

        <div className="card mb-24">
          <div className="flex-between mb-8">
            <label className="form-label mb-0">
              The Strategic Prompt
            </label>
            <span className="form-label form-label-tip">
              Be specific — mention tech stack, goals, pain points, timelines
            </span>
          </div>
          <textarea
            className="form-textarea min-h-textarea"
            placeholder={
              "Describe the project scope, client's core challenge, desired outcomes, technical constraints, and any specific requirements...\n\nExample: We need to build a HIPAA-compliant patient management portal for a mid-sized hospital network. The solution must integrate with their existing EHR system, support 500+ concurrent users, and be deployed on AWS with 99.9% SLA."
            }
            value={proposalData.description}
            onChange={(e) =>
              updateProposalData({ description: e.target.value })
            }
          />
          {descriptionTags.length > 0 && (
            <div className="flex-row mt-12 flex-wrap gap-6">
              {descriptionTags.map((tag) => (
                <span key={tag} className="badge badge-muted">
                  #{tag}
                </span>
              ))}
              <button className="btn btn-dark btn-sm ml-auto">
                ✦ AI Assist
              </button>
            </div>
          )}
          {descriptionTags.length === 0 && (
            <div className={`flex-row mt-12 ${styles.aiAssistRow}`}>
              <button className="btn btn-dark btn-sm">✦ AI Assist</button>
            </div>
          )}
        </div>

        <div className="grid-3">
          <div
            className="card feature-placeholder"
          >
            <div className="feature-placeholder-icon">📎</div>
            <div className="form-label text-muted">
              Add Case Study
            </div>
          </div>
          <div
            className="card feature-placeholder"
          >
            <div className="feature-placeholder-icon">📊</div>
            <div className="form-label text-muted">
              Core Metrics
            </div>
          </div>
          <div
            className="card feature-placeholder"
          >
            <div className="feature-placeholder-icon">🛡️</div>
            <div className="form-label text-muted">
              Compliance Focus
            </div>
          </div>
        </div>

        <div className="page-footer">
          <div className="page-footer-left" />
          <div className="page-footer-right">
            <button
              className="btn btn-secondary"
              onClick={handleSaveDraft}
            >
              Save Draft
            </button>
            <button className="btn btn-primary" onClick={handleNext}>
              Next: Knowledge Base →
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function extractTags(text: string): string[] {
  if (!text || text.length < 20) return [];
  const techKeywords = [
    "React",
    "Next.js",
    "NextJS",
    "Vue",
    "Angular",
    "Node.js",
    "Python",
    "FastAPI",
    "Django",
    "Flask",
    "AWS",
    "Azure",
    "GCP",
    "Docker",
    "Kubernetes",
    "PostgreSQL",
    "MySQL",
    "MongoDB",
    "Redis",
    "TypeScript",
    "JavaScript",
    "Java",
    "Go",
    "Rust",
    "Security",
    "HIPAA",
    "GDPR",
    "API",
    "REST",
    "GraphQL",
    "Microservices",
    "Serverless",
    "Mobile",
    "iOS",
    "Android",
    "CI/CD",
  ];
  return techKeywords
    .filter((kw) => text.toLowerCase().includes(kw.toLowerCase()))
    .slice(0, 5);
}
