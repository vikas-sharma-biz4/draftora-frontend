"use client";

import React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import Button from "@/components/common/Button";
import { Input, Textarea } from "@/components/common/Input";
import FormField from "@/components/common/FormField";
import styles from "./TemplateSelectionModal.module.scss";

import { useTemplateModal } from "./useTemplateModal";
import TemplateGrid from "./TemplateGrid";
import ClientSearchDropdown from "./ClientSearchDropdown";
import DocumentKnowledgeBase from "./DocumentKnowledgeBase";
import NewClientForm from "./NewClientForm";
import { PROPOSAL_TEMPLATES } from "@/constants";
import type { TemplateSelectionModalProps } from "./types";

export default function TemplateSelectionModal(
  props: TemplateSelectionModalProps
): JSX.Element | null {
  const {
    templateId,
    templateName,
    onClose,
    isScratch = false,
    enableTemplateSelection = false,
  } = props;

  const {
    mounted,
    clients,
    loading,
    selectedClientId,
    selectedClient,
    filteredClients,
    selectedDocuments,
    selectedTemplateIdState,
    clientSearchQuery,
    showClientDropdown,
    highlightedIndex,
    proposalName,
    proposalDescription,
    initialContextNotes,
    uploadedFiles,
    viewingDocId,
    modalView,
    showTemplateSelector,
    isPending,
    newClientFormData,
    isCreatingClient,
    setProposalName,
    setProposalDescription,
    setInitialContextNotes,
    setSelectedTemplateIdState,
    processFileList,
    handleRemoveFile,
    handleRemoveAllFiles,
    handleClientSelect,
    handleClientSearchChange,
    handleClientSearchFocus,
    handleClientSearchBlur,
    handleClientKeyDown,
    toggleDocument,
    toggleAllDocuments,
    handleViewDocument,
    handleContinue,
    handleNewClientClick,
    handleNewClientInputChange,
    handleCreateClient,
  } = useTemplateModal(props);

  if (!mounted) return null;

  const showTemplateGrid =
    enableTemplateSelection ||
    showTemplateSelector ||
    (!!selectedClientId && !templateId && !isScratch);

  const modalTitle =
    modalView === "new_client"
      ? "Add New Client"
      : isScratch
        ? "Start From Scratch"
        : "Create Proposal from Template";

  const modalSubtitle =
    modalView === "new_client" ? (
      "Enter details to provision a new client workspace."
    ) : isScratch ? (
      "Build a proposal without a predefined template"
    ) : (
      <>
        Using <strong>{templateName}</strong> template
      </>
    );

  return createPortal(
    <div className={styles.modalOverlay}>
      <div
        className={styles.modalContent}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tsm-title"
        data-testid="template-selection-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ────────────────────────────────────────────────── */}
        <div className={styles.modalHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div>
              <h2 id="tsm-title" className={styles.modalTitle}>
                {modalTitle}
              </h2>
              <p className={styles.modalSubtitle}>{modalSubtitle}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            iconOnly
            onClick={onClose}
            aria-label="Close"
            className={styles.closeBtn}
          >
            <X size={20} />
          </Button>
        </div>

        {/* ── Body ──────────────────────────────────────────────────── */}
        <div className={styles.modalBody}>
          {modalView === "new_client" ? (
            <NewClientForm
              formData={newClientFormData}
              uploadedFiles={uploadedFiles}
              onInputChange={handleNewClientInputChange}
              onProcessFiles={processFileList}
              onRemoveFile={handleRemoveFile}
            />
          ) : (
            <>
              {showTemplateGrid && (
                <TemplateGrid
                  templates={PROPOSAL_TEMPLATES}
                  selectedId={selectedTemplateIdState}
                  onSelect={setSelectedTemplateIdState}
                />
              )}

              <ClientSearchDropdown
                filteredClients={filteredClients}
                allClients={clients}
                loading={loading}
                selectedClientId={selectedClientId}
                clientSearchQuery={clientSearchQuery}
                showDropdown={showClientDropdown}
                highlightedIndex={highlightedIndex}
                onSearchChange={handleClientSearchChange}
                onFocus={handleClientSearchFocus}
                onBlur={handleClientSearchBlur}
                onKeyDown={handleClientKeyDown}
                onClientSelect={handleClientSelect}
                onNewClient={handleNewClientClick}
              />

              <FormField label="Proposal Name">
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    type="text"
                    placeholder="e.g. Q4 Digital Transformation Initiative"
                    value={proposalName}
                    onChange={(e) => setProposalName(e.target.value)}
                  />
                )}
              </FormField>

              {initialContextNotes && (
                <FormField label="Initial Context & Notes">
                  {(fieldProps) => (
                    <Textarea
                      {...fieldProps}
                      placeholder="Initial context and notes from client creation..."
                      value={initialContextNotes}
                      onChange={(e) => setInitialContextNotes(e.target.value)}
                      rows={4}
                    />
                  )}
                </FormField>
              )}

              <FormField label="Project Brief">
                {(fieldProps) => (
                  <Textarea
                    {...fieldProps}
                    placeholder="Describe the project scope, client's core challenge, desired outcomes, technical constraints, and any specific requirements..."
                    value={proposalDescription}
                    onChange={(e) => setProposalDescription(e.target.value)}
                  />
                )}
              </FormField>

              {selectedClient && (
                <DocumentKnowledgeBase
                  selectedClient={selectedClient}
                  selectedClientId={selectedClientId!}
                  selectedDocuments={selectedDocuments}
                  uploadedFiles={uploadedFiles}
                  viewingDocId={viewingDocId}
                  onToggleDocument={toggleDocument}
                  onToggleAll={toggleAllDocuments}
                  onViewDocument={handleViewDocument}
                  onProcessFiles={processFileList}
                  onRemoveFile={handleRemoveFile}
                  onRemoveAll={handleRemoveAllFiles}
                />
              )}
            </>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────────── */}
        <div className={styles.modalFooter}>
          {modalView === "new_client" ? (
            <Button
              variant="primary"
              onClick={handleCreateClient}
              disabled={!newClientFormData.clientName.trim()}
              loading={isCreatingClient}
              style={{ marginLeft: "auto" }}
            >
              Create Client
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleContinue}
              disabled={uploadedFiles.some((f) => f.status === "parsing")}
              loading={isPending}
              style={{ marginLeft: "auto" }}
            >
              {isPending ? "Starting..." : "Continue to Wizard"}
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
