"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import styles from "./page.module.scss";

import { useProposal } from "@/context/ProposalContext";
import { useSaveDraft } from "@/hooks/useSaveDraft";
import { formatBytes } from "@/utils/formatBytes";

const Sidebar = dynamic(() => import("@/components/common/Sidebar"), {
  ssr: false,
  loading: () => <div className="sidebar-skeleton" />,
});

const MAX_FILE_SIZE_MB = 10;
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt", ".png", ".jpg", ".jpeg"];

function getFileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "📄";
  if (ext === "docx" || ext === "doc") return "📝";
  if (["png", "jpg", "jpeg"].includes(ext ?? "")) return "🖼️";
  return "📃";
}

export default function KnowledgeBasePage(): JSX.Element {
  const { proposalData, updateProposalData, setCurrentStep } = useProposal();
  const router = useRouter();
  const handleSaveDraft = useSaveDraft();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [webRefInput, setWebRefInput] = useState<string>("");

  // filesMeta persists after refresh (files are cleared but metadata remains)

  function handleFileDrop(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  }

  function addFiles(incoming: File[]): void {
    const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024;

    const validType = incoming.filter((f) => {
      const ext = "." + (f.name.split(".").pop() ?? "");
      if (!ALLOWED_EXTENSIONS.includes(ext.toLowerCase())) {
        toast.error(`${f.name}: unsupported file type.`);
        return false;
      }
      return true;
    });

    const validSize = validType.filter((f) => {
      if (f.size > maxBytes) {
        toast.error(`${f.name} exceeds the ${MAX_FILE_SIZE_MB} MB limit.`);
        return false;
      }
      return true;
    });

    const merged = [...proposalData.files, ...validSize];
    const unique = merged.filter(
      (f, idx, arr) =>
        arr.findIndex((x) => x.name === f.name && x.size === f.size) === idx
    );
    
    const newMeta = unique.map((f) => ({ name: f.name, size: f.size, type: f.type }));
    const mergedMeta = [...proposalData.filesMeta];
    
    newMeta.forEach((meta) => {
      const exists = mergedMeta.some(
        (m) => m.name === meta.name && m.size === meta.size
      );
      if (!exists) {
        mergedMeta.push(meta);
      }
    });
    
    updateProposalData({
      files: unique,
      filesMeta: mergedMeta,
    });

    if (validSize.length > 0) {
      toast.success(
        `${validSize.length} file${validSize.length > 1 ? "s" : ""} added.`
      );
    }
  }

  function removeFile(index: number): void {
    const updated = proposalData.files.filter((_, i) => i !== index);
    updateProposalData({ files: updated });
  }

  function removeAllFiles(): void {
    updateProposalData({ files: [], filesMeta: [] });
    toast.success("All documents removed.");
  }

  function removeMetaFile(index: number): void {
    const metaToRemove = proposalData.filesMeta[index];
    const updatedMeta = proposalData.filesMeta.filter((_, i) => i !== index);
    
    // Also remove the corresponding file from the files array
    const updatedFiles = proposalData.files.filter(
      (f) => !(f.name === metaToRemove.name && f.size === metaToRemove.size)
    );
    
    updateProposalData({ 
      filesMeta: updatedMeta,
      files: updatedFiles 
    });
  }

  function addWebRef(): void {
    const trimmed = webRefInput.trim();
    if (!trimmed) return;
    if (!proposalData.webReferences.includes(trimmed)) {
      updateProposalData({
        webReferences: [...proposalData.webReferences, trimmed],
      });
    }
    setWebRefInput("");
  }

  function removeWebRef(ref: string): void {
    updateProposalData({
      webReferences: proposalData.webReferences.filter((r) => r !== ref),
    });
  }

  function handleNext(): void {
    setCurrentStep(3);
    router.push("/templates");
  }

  function handleBack(): void {
    setCurrentStep(1);
    router.push("/");
  }

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <div className="page-badge">Phase 02</div>
        <h1 className="page-title">Step 2: Knowledge Base &amp; Assets.</h1>
        <p className="page-subtitle">
          Upload supporting documents and add reference URLs to ground the AI in
          real project context. Better sources produce more accurate proposals.
        </p>

        <div className={styles.twoColLayout}>
          {/* Left column */}
          <div>
            {/* Upload zone */}
            <div
              className={`upload-zone ${isDragging ? "dragging" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <span className="upload-zone-icon">📂</span>
              <p className="upload-zone-title">Upload Source Documents</p>
              <p className="upload-zone-subtitle">
                Drag &amp; drop or click to browse
                <br />
                PDF, DOCX, TXT, PNG, JPG, JPEG — max {MAX_FILE_SIZE_MB} MB each
              </p>
              <button
                className="btn btn-primary btn-sm"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              >
                Browse Files
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ALLOWED_EXTENSIONS.join(",")}
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
            </div>

            {/* Active file list - shows filesMeta (persists after refresh) */}
            {proposalData.filesMeta.length > 0 && (
              <div className={styles.fileListSection}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <div className={`form-label ${styles.fileListLabel}`} style={{ marginBottom: 0 }}>
                    Active Assets ({proposalData.filesMeta.length})
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={removeAllFiles}
                    style={{ color: "#ef4444", fontSize: 12 }}
                  >
                    ✕ Remove All
                  </button>
                </div>
                <ul className="file-list">
                  {proposalData.filesMeta.map((fileMeta, idx) => {
                    const isActiveFile = proposalData.files.some(
                      (f) => f.name === fileMeta.name && f.size === fileMeta.size
                    );
                    return (
                      <li key={`${fileMeta.name}-${idx}`} className="file-item">
                        <div className="file-item-info">
                          <span className="file-item-icon">
                            {getFileIcon(fileMeta.name)}
                          </span>
                          <span className="file-item-name">{fileMeta.name}</span>
                          <span className="file-item-size">
                            {formatBytes(fileMeta.size)}
                          </span>
                          <span className={`badge ${isActiveFile ? "badge-success" : "badge-info"}`}>
                            {isActiveFile ? "Queued" : "Saved"}
                          </span>
                        </div>
                        <div className="file-item-actions">
                          <button
                            className={`btn btn-ghost btn-sm ${styles.removeDangerBtn}`}
                            onClick={() => removeMetaFile(idx)}
                          >
                            ✕
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}


            {/* Web references - DISABLED: Uncomment to re-enable */}
            {/* <div className={styles.webRefSection}>
              <div className={`form-label ${styles.webRefLabel}`}>
                Add Web References
              </div>
              <div className="flex-row">
                <input
                  className="form-input"
                  type="url"
                  placeholder="https://docs.example.com/requirements"
                  value={webRefInput}
                  onChange={(e) => setWebRefInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addWebRef(); }}
                />
                <button
                  className={`btn btn-secondary ${styles.addLinkBtn}`}
                  onClick={addWebRef}
                >
                  Add Link
                </button>
              </div>
              {proposalData.webReferences.length > 0 && (
                <ul className="web-ref-list">
                  {proposalData.webReferences.map((ref) => (
                    <li key={ref} className="web-ref-item">
                      <span className="web-ref-url">{ref}</span>
                      <button
                        className={`btn btn-ghost btn-sm ${styles.removeRefBtn}`}
                        onClick={() => removeWebRef(ref)}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div> */}
          </div>

          {/* Right column — Contextual Instructions */}
          <div className={`card ${styles.contextCard}`}>
            <div className="card-title">Contextual Instructions</div>
            <p className={styles.contextHint}>
              Tell the AI how to interpret your uploaded assets and what angle
              to take on the content.
            </p>
            <textarea
              className={`form-textarea ${styles.contextTextarea}`}
              placeholder="e.g. Focus on our cloud-native expertise and emphasize security compliance. The client is risk-averse and values reliability above cost."
              value={proposalData.contextualInstructions}
              onChange={(e) =>
                updateProposalData({ contextualInstructions: e.target.value })
              }
            />
            <p className={styles.contextFooter}>
              Your instructions directly influence the generated draft quality.
            </p>
          </div>
        </div>

        <div className="page-footer">
          <div className="page-footer-left">
            <button className="btn btn-ghost" onClick={handleBack}>← Back</button>
          </div>
          <div className="page-footer-right">
            <button className="btn btn-secondary" onClick={handleSaveDraft}>
              Save Draft
            </button>
            <button className="btn btn-primary" onClick={handleNext}>
              Next: Templates →
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
