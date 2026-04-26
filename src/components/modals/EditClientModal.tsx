"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";

import styles from "./NewClientModal.module.scss";

import type { Client } from "@/types/client.types";
import { CLIENTS_STORAGE_KEY, INDUSTRIES } from "@/constants";

interface EditClientModalProps {
  client: Client;
  onClose: () => void;
  onClientUpdated: (client: Client) => void;
}

export default function EditClientModal({ client, onClose, onClientUpdated }: EditClientModalProps): JSX.Element | null {
  const [mounted, setMounted] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const [formData, setFormData] = useState({
    clientName: client.name,
    industry: client.industry,
    notes: client.notes || "",
  });

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  function handleInputChange(field: keyof typeof formData, value: string): void {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function handleSave(): void {
    if (!formData.clientName.trim()) {
      toast.error("Client name is required");
      return;
    }

    if (!formData.industry) {
      toast.error("Please select an industry");
      return;
    }

    setIsSaving(true);

    const updatedClient: Client = {
      ...client,
      name: formData.clientName.trim(),
      industry: formData.industry,
      notes: formData.notes,
    };

    try {
      const raw = localStorage.getItem(CLIENTS_STORAGE_KEY);
      const clients = raw ? (JSON.parse(raw) as Client[]) : [];
      const updated = clients.map((c) => (c.id === updatedClient.id ? updatedClient : c));
      localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(updated));

      toast.success(`Client "${updatedClient.name}" updated successfully`);
      onClientUpdated(updatedClient);
    } catch (error) {
      toast.error("Failed to update client");
      setIsSaving(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>Edit Client Details</h2>
            <p className={styles.modalSubtitle}>Update the client workspace information.</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.section}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Client Name</label>
              <input
                type="text"
                className={styles.input}
                placeholder="e.g. Acme Corporation"
                value={formData.clientName}
                onChange={(e) => handleInputChange("clientName", e.target.value)}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Industry</label>
              <select
                className={styles.select}
                value={formData.industry}
                onChange={(e) => handleInputChange("industry", e.target.value)}
              >
                <option value="">Select industry...</option>
                {INDUSTRIES.map((industry) => (
                  <option key={industry} value={industry}>
                    {industry}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              Notes
              <span className={styles.optional}>Optional</span>
            </h3>
            <div className={styles.formGroup}>
              <textarea
                className={styles.textarea}
                placeholder="Add any background context, specific requirements, or observations..."
                value={formData.notes}
                onChange={(e) => handleInputChange("notes", e.target.value)}
                rows={4}
              />
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className="btn btn-secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={isSaving || !formData.clientName.trim() || !formData.industry}
          >
            {isSaving ? (
              <>
                <Loader2 size={16} className={styles.spinner} />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
