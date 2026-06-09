"use client";

import React from "react";
import type { ProposalTemplate } from "@/interfaces/proposalInterfaces";
import styles from "./TemplateSelectionModal.module.scss";

interface TemplateGridProps {
  templates: ProposalTemplate[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function TemplateGrid({
  templates,
  selectedId,
  onSelect,
}: TemplateGridProps): JSX.Element {
  return (
    <div className={styles.section}>
      <label className={styles.label}>Select a Template</label>
      <div className={styles.templateGrid}>
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            className={`${styles.templateCard} ${selectedId === template.id ? styles.selected : ""}`}
            onClick={() => onSelect(template.id)}
            aria-pressed={selectedId === template.id}
          >
            <div className={styles.templateCardIcon}>{template.icon}</div>
            <div className={styles.templateCardInfo}>
              <div className={styles.templateCardTitle}>{template.name}</div>
              <div className={styles.templateCardDescription}>{template.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
