"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";
import { toast } from "@/utils/toast";
import { logger } from "@/utils/logger";

import styles from "../NewClientModal.module.scss";
import Button from "@/components/common/Button";
import { Input, Select, Textarea } from "@/components/common/Input";
import FormField from "@/components/common/FormField";

import { INDUSTRIES } from "@/constants";
import { useClientStore } from "@/store/features/clients/clientSlice";
import { useModalHistory } from "@/hooks/useModalHistory";
import type { Client } from "@/services/client.service";

interface EditClientModalProps {
  client: Client;
  onClose: () => void;
  onClientUpdated: (client: Client) => void;
}

export default function EditClientModal({
  client,
  onClose,
  onClientUpdated,
}: EditClientModalProps): JSX.Element | null {
  const updateClientInStore = useClientStore((state) => state.updateClientApi);
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

  // Enable browser back button to close modal
  useModalHistory({ isOpen: true, onClose, modalId: "edit-client-modal" });

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

  async function handleSave(): Promise<void> {
    if (!formData.clientName.trim()) {
      toast.error("Client name is required");
      return;
    }

    if (!formData.industry) {
      toast.error("Please select an industry");
      return;
    }

    setIsSaving(true);

    try {
      const updatedClient = await updateClientInStore(client.id, {
        name: formData.clientName.trim(),
        industry: formData.industry,
        notes: formData.notes || undefined,
      });

      toast.success(`Client "${updatedClient.name}" updated`);
      onClientUpdated(updatedClient);
    } catch (error) {
      logger.error("Failed to update client:", error);
      toast.error("Failed to update client");
    } finally {
      setIsSaving(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>Edit Client Details</h2>
            <p className={styles.modalSubtitle}>Update the client workspace information.</p>
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

        <div className={styles.modalBody}>
          <div className={styles.section}>
            <FormField label="Client Name">
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="text"
                  placeholder="e.g. Acme Corporation"
                  value={formData.clientName}
                  onChange={(e) => handleInputChange("clientName", e.target.value)}
                />
              )}
            </FormField>

            <FormField label="Industry">
              {(fieldProps) => (
                <Select
                  {...fieldProps}
                  value={formData.industry}
                  onChange={(e) => handleInputChange("industry", e.target.value)}
                >
                  <option value="">Select industry...</option>
                  {INDUSTRIES.map((industry) => (
                    <option key={industry} value={industry}>
                      {industry}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              Notes
              <span className={styles.optional}>Optional</span>
            </h3>
            <FormField label="">
              {(fieldProps) => (
                <Textarea
                  {...fieldProps}
                  placeholder="Add any background context, specific requirements, or observations..."
                  value={formData.notes}
                  onChange={(e) => handleInputChange("notes", e.target.value)}
                  rows={4}
                />
              )}
            </FormField>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!formData.clientName.trim() || !formData.industry}
            loading={isSaving}
          >
            Save Changes
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
