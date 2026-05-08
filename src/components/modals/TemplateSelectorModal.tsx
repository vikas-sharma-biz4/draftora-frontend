"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { PROPOSAL_TEMPLATES } from "@/constants";
import { Check } from "lucide-react";

interface TemplateSelectorModalProps {
  currentTemplateId: string | null;
  currentTemplateType: string;
  onClose: () => void;
  onSave: (templateId: string, templateType: string) => void;
}

export default function TemplateSelectorModal({
  currentTemplateId,
  currentTemplateType,
  onClose,
  onSave,
}: TemplateSelectorModalProps): JSX.Element | null {
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      setMounted(false);
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  function handleTemplateSelect(templateId: string, templateType: string): void {
    onSave(templateId, templateType);
    onClose();
  }

  if (!mounted) return null;

  return createPortal(
    <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: "800px", maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Select Proposal Template</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-description">
            Choose a template to define the structure and sections of your proposal.
            Changing the template will update the sections accordingly.
          </p>

          <div className="template-grid">
            {PROPOSAL_TEMPLATES.map((template) => {
              const isSelected = template.id === currentTemplateId;
              return (
                <div
                  key={template.id}
                  className={`template-card ${isSelected ? "selected" : ""}`}
                  onClick={() => handleTemplateSelect(template.id, template.templateType)}
                >
                  <div className={`template-card-icon ${template.gradientClass}`}>
                    {template.icon}
                  </div>
                  <div className="template-card-content">
                    <div className="template-card-header">
                      <h3 className="template-card-title">{template.name}</h3>
                      {isSelected && <Check size={16} className="template-check" />}
                    </div>
                    <span className="template-card-category">{template.category}</span>
                    <p className="template-card-description">{template.description}</p>
                    <div className="template-card-sections">
                      <span className="template-sections-count">
                        {template.sections.length} sections
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
