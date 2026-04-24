"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Search, FileText } from "lucide-react";
import { toast } from "sonner";

import styles from "./EditModal.module.scss";
import type { ClientDocument } from "@/types/client.types";

interface KnowledgeBaseSelectorModalProps {
  availableDocuments: ClientDocument[];
  selectedDocumentIds: string[];
  onClose: () => void;
  onSave: (selectedIds: string[]) => void;
}

export default function KnowledgeBaseSelectorModal({
  availableDocuments,
  selectedDocumentIds,
  onClose,
  onSave,
}: KnowledgeBaseSelectorModalProps): JSX.Element | null {
  const [mounted, setMounted] = useState<boolean>(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedDocumentIds));
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const filteredDocuments = availableDocuments.filter((doc) =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function toggleDocument(docId: string): void {
    setSelected((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) {
        newSet.delete(docId);
      } else {
        newSet.add(docId);
      }
      return newSet;
    });
  }

  function toggleAll(): void {
    if (selected.size === availableDocuments.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(availableDocuments.map((d) => d.id)));
    }
  }

  function handleSave(): void {
    onSave(Array.from(selected));
    toast.success(`${selected.size} document(s) selected`);
  }

  if (!mounted) return null;

  return createPortal(
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>Select Knowledge Base Documents</h2>
            <p className={styles.modalSubtitle}>
              Choose documents to include as context for this proposal
            </p>
          </div>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.searchBar}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className={styles.actionBar}>
            <button className={styles.toggleAllButton} onClick={toggleAll}>
              {selected.size === availableDocuments.length ? "Deselect All" : "Select All"}
            </button>
            <span className={styles.counter}>{selected.size} document(s) selected</span>
          </div>

          {filteredDocuments.length === 0 ? (
            <div className={styles.emptyState}>
              <FileText size={48} className={styles.emptyIcon} />
              <p className={styles.emptyText}>
                {searchQuery ? "No documents match your search" : "No documents available"}
              </p>
            </div>
          ) : (
            <div className={styles.documentList}>
              {filteredDocuments.map((doc) => {
                const isSelected = selected.has(doc.id);
                return (
                  <div
                    key={doc.id}
                    className={`${styles.documentItem} ${isSelected ? styles.selected : ""}`}
                    onClick={() => toggleDocument(doc.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleDocument(doc.id)}
                      className={styles.checkbox}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className={styles.documentInfo}>
                      <span className={styles.documentName}>{doc.name}</span>
                      <span className={styles.documentMeta}>
                        {doc.size ? `${(Number(doc.size) / 1024).toFixed(1)} KB` : ""} • {doc.date}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
          <button className={styles.saveButton} onClick={handleSave}>
            Save Changes
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
