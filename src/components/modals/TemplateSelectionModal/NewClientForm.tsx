"use client";

import React from "react";

import { Input, Select, Textarea } from "@/components/common/Input";
import FormField from "@/components/common/FormField";
import styles from "./TemplateSelectionModal.module.scss";
import FileUploadZone from "./FileUploadZone";
import { INDUSTRIES } from "@/constants";
import type { NewClientFormData } from "@/interfaces/clientInterfaces";
import type { UploadedFile } from "./types";

interface NewClientFormProps {
  formData: NewClientFormData;
  otherIndustry: string;
  uploadedFiles: UploadedFile[];
  onInputChange: (field: keyof NewClientFormData, value: string) => void;
  onOtherIndustryChange: (value: string) => void;
  onProcessFiles: (files: FileList | null) => void;
  onRemoveFile: (fileId: string) => void;
}

export default function NewClientForm({
  formData,
  otherIndustry,
  uploadedFiles,
  onInputChange,
  onOtherIndustryChange,
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

        <FormField label="Industry *">
          {(fieldProps) => (
            <>
              <Select
                {...fieldProps}
                value={formData.industry}
                onChange={(e) => {
                  onInputChange("industry", e.target.value);
                  if (e.target.value !== "Other") onOtherIndustryChange("");
                }}
              >
                <option value="" disabled hidden>
                  Select industry...
                </option>
                {INDUSTRIES.map((industry) => (
                  <option key={industry} value={industry}>
                    {industry}
                  </option>
                ))}
              </Select>
              {formData.industry === "Other" && (
                <Input
                  type="text"
                  placeholder="Please specify your industry"
                  value={otherIndustry}
                  onChange={(e) => onOtherIndustryChange(e.target.value)}
                  style={{ marginTop: "8px" }}
                  aria-required="true"
                />
              )}
            </>
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
