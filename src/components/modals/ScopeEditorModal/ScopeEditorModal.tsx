"use client";

import React, { useState, useMemo } from "react";
import { X } from "lucide-react";
import { toast } from "@/utils/toast";

import styles from "../EditModal.module.scss";
import BaseModal from "@/components/common/BaseModal";
import Button from "@/components/common/Button";
import { Input, Textarea } from "@/components/common/Input";
import FormField from "@/components/common/FormField";
import { useClients } from "@/hooks/useClients";

interface ScopeEditorModalProps {
  proposalTitle: string;
  clientName: string;
  clientId: number | null;
  description: string;
  onClose: () => void;
  onSave: (data: {
    title: string;
    clientName: string;
    clientId: number | null;
    description: string;
  }) => void;
}

export default function ScopeEditorModal({
  proposalTitle,
  clientName,
  clientId,
  description,
  onClose,
  onSave,
}: ScopeEditorModalProps): JSX.Element | null {
  const [title, setTitle] = useState<string>(proposalTitle);
  const [desc, setDesc] = useState<string>(description);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(clientId);
  const [clientSearchQuery, setClientSearchQuery] = useState<string>(clientName);
  const [showClientDropdown, setShowClientDropdown] = useState<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const { clients, isLoading } = useClients({ autoFetch: true });

  const filteredClients = useMemo(() => {
    if (!clientSearchQuery.trim()) return clients;
    return clients.filter((c) => c.name.toLowerCase().includes(clientSearchQuery.toLowerCase()));
  }, [clients, clientSearchQuery]);

  function handleClientSelect(id: number, name: string): void {
    setSelectedClientId(id);
    setClientSearchQuery(name);
    setShowClientDropdown(false);
    setHighlightedIndex(-1);
  }

  function handleClientSearchChange(value: string): void {
    setClientSearchQuery(value);
    setShowClientDropdown(true);
    setHighlightedIndex(-1);
    if (!value.trim()) {
      setSelectedClientId(null);
    }
  }

  function handleClientSearchFocus(): void {
    setShowClientDropdown(true);
  }

  function handleClientSearchBlur(): void {
    setTimeout(() => {
      setShowClientDropdown(false);
      setHighlightedIndex(-1);
    }, 300);
  }

  function handleClientKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (!showClientDropdown || filteredClients.length === 0) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => Math.min(prev + 1, filteredClients.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredClients.length) {
          const selected = filteredClients[highlightedIndex];
          handleClientSelect(selected.id, selected.name);
        }
        break;
      case "Escape":
        setShowClientDropdown(false);
        setHighlightedIndex(-1);
        break;
    }
  }

  function handleSave(): void {
    if (!title.trim() || title.trim().length < 3) {
      toast.error("Proposal title must be at least 3 characters");
      return;
    }

    if (!clientSearchQuery.trim()) {
      toast.error("Client name is required");
      return;
    }

    onSave({
      title: title.trim(),
      clientName: clientSearchQuery.trim(),
      clientId: selectedClientId,
      description: desc.trim(),
    });
  }

  return (
    <BaseModal isOpen={true} onClose={onClose} size="md" labelId="scope-modal-title">
      <div className={styles.modalHeader}>
        <h2 id="scope-modal-title" className={styles.modalTitle}>
          Edit Client Details
        </h2>
        <Button
          variant="ghost"
          iconOnly
          onClick={onClose}
          aria-label="Close"
          className={styles.closeButton}
        >
          <X size={20} />
        </Button>
      </div>

      <div className={styles.modalBody}>
        <FormField label="Proposal Title *">
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter proposal title"
              autoFocus
            />
          )}
        </FormField>

        <FormField label="Client Name *">
          {(fieldProps) =>
            isLoading ? (
              <p className={styles.emptyText}>Loading clients...</p>
            ) : clients.length === 0 ? (
              <Input
                {...fieldProps}
                type="text"
                value={clientSearchQuery}
                onChange={(e) => setClientSearchQuery(e.target.value)}
                placeholder="Enter client name"
              />
            ) : (
              <div className={styles.searchWrapper}>
                <Input
                  {...fieldProps}
                  type="text"
                  placeholder="Search for a client..."
                  value={clientSearchQuery}
                  onChange={(e) => handleClientSearchChange(e.target.value)}
                  onFocus={handleClientSearchFocus}
                  onBlur={handleClientSearchBlur}
                  onKeyDown={handleClientKeyDown}
                />

                {showClientDropdown && filteredClients.length > 0 && (
                  <div className={styles.clientDropdown}>
                    {filteredClients.map((c, index) => (
                      <button
                        key={c.id}
                        type="button"
                        className={[
                          styles.clientOption,
                          selectedClientId === c.id ? styles.selectedOption : "",
                          index === highlightedIndex ? styles.highlighted : "",
                        ].join(" ")}
                        onPointerDown={(e) => {
                          e.preventDefault();
                          handleClientSelect(c.id, c.name);
                        }}
                      >
                        <div className={styles.clientOptionMain}>
                          <span className={styles.clientOptionName}>{c.name}</span>
                          <span className={styles.clientOptionIndustry}>{c.industry}</span>
                        </div>
                        <div className={styles.clientOptionMeta}>
                          {c.documents?.length || 0} docs
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {showClientDropdown && filteredClients.length === 0 && clientSearchQuery.trim() && (
                  <div className={styles.clientDropdown}>
                    <div className={styles.noResults}>
                      No clients found matching &ldquo;{clientSearchQuery}&rdquo;
                    </div>
                  </div>
                )}
              </div>
            )
          }
        </FormField>

        <FormField label="Strategic Prompt Snippet">
          {(fieldProps) => (
            <Textarea
              {...fieldProps}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Enter strategic context or instructions for the AI"
              rows={4}
            />
          )}
        </FormField>
      </div>

      <div className={styles.modalFooter}>
        <Button variant="primary" onClick={handleSave} className={styles.saveButton}>
          Save Changes
        </Button>
      </div>
    </BaseModal>
  );
}
