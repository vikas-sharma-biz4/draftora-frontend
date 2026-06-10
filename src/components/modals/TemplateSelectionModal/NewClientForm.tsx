"use client";

import React from "react";

import { Input, Textarea } from "@/components/common/Input";
import FormField from "@/components/common/FormField";
import styles from "./TemplateSelectionModal.module.scss";
import FileUploadZone from "./FileUploadZone";
import type { NewClientFormData } from "@/interfaces/clientInterfaces";
import type { UploadedFile } from "./types";

interface NewClientFormProps {
  formData: NewClientFormData;
  uploadedFiles: UploadedFile[];
  onInputChange: (field: keyof NewClientFormData, value: string) => void;
  onProcessFiles: (files: FileList | null) => void;
  onRemoveFile: (fileId: string) => void;
}

export default function NewClientForm({
  formData,
  uploadedFiles,
  onInputChange,
  onProcessFiles,
  onRemoveFile,
}: NewClientFormProps): JSX.Element {
  return (
    <>
      <div className={styles.section}>
        <FormField label="Client Name *">
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="text"
              placeholder="e.g. Acme Corporation"
              value={formData.clientName}
              onChange={(e) => onInputChange("clientName", e.target.value)}
              aria-required="true"
            />
          )}
        </FormField>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          Initial Context &amp; Notes <span className={styles.optional}>Optional</span>
        </h3>
        <FormField label="">
          {(fieldProps) => (
            <Textarea
              {...fieldProps}
              placeholder="Add any background context, specific requirements, or initial observations..."
              value={formData.notes}
              onChange={(e) => onInputChange("notes", e.target.value)}
              rows={4}
            />
          )}
        </FormField>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Upload Documents</h3>
        <FileUploadZone
          inputId="new-client-file-upload"
          uploadedFiles={uploadedFiles}
          onProcessFiles={onProcessFiles}
          onRemoveFile={onRemoveFile}
        />
      </div>
    </>
  );
}
