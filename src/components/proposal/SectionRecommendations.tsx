"use client";

import React, { useRef, useState, useEffect } from "react";
import { Sparkles, RefreshCw, GripVertical, Plus } from "lucide-react";
import { toast } from "sonner";
import { getSectionRecommendations, type SectionRecommendation } from "@/api/proposalApi";
import styles from "./SectionRecommendations.module.scss";

interface SectionRecommendationsProps {
  templateId?: string | null;
  existingSections: string[];
  context: string;
  documentContext: string;
  onAddSection: (sectionKey: string, title: string) => void;
}

export default function SectionRecommendations({
  templateId,
  existingSections,
  context,
  documentContext,
  onAddSection,
}: SectionRecommendationsProps): JSX.Element {
  const [recommendations, setRecommendations] = useState<SectionRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasUserRequested, setHasUserRequested] = useState<boolean>(false);
  const [userPrompt, setUserPrompt] = useState<string>("");
  const [isEditingPrompt, setIsEditingPrompt] = useState<boolean>(false);

  const contextRef = useRef(context);
  const documentContextRef = useRef(documentContext);
  const templateIdRef = useRef(templateId);
  const existingSectionsRef = useRef(existingSections);

  useEffect(() => {
    contextRef.current = context;
    documentContextRef.current = documentContext;
    templateIdRef.current = templateId;
    existingSectionsRef.current = existingSections;
  });

  const fetchRecommendations = async (customPrompt?: string): Promise<void> => {
    const ctx = contextRef.current;
    const docCtx = documentContextRef.current;

    if (!ctx && !docCtx) {
      return;
    }

    setIsLoading(true);
    try {
      const fullContext = [docCtx, ctx].filter(Boolean).join("\n\n");

      const recs = await getSectionRecommendations({
        template_id: templateIdRef.current,
        existing_sections: existingSectionsRef.current,
        context: fullContext,
        user_prompt: customPrompt ?? userPrompt ?? null,
      });

      setRecommendations(recs);
    } catch (error) {
      console.error("Failed to fetch recommendations:", error);
      setRecommendations([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGetRecommendations = (): void => {
    setHasUserRequested(true);
  };

  const handleRegenerate = (): void => {
    setHasUserRequested(true);
    setRecommendations([]);
    fetchRecommendations();
  };

  const handleAddSection = (rec: SectionRecommendation): void => {
    const sectionKey = rec.section_title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    onAddSection(sectionKey, rec.section_title);
    toast.success(`Added "${rec.section_title}" to section structure`);
  };

  const handlePromptChange = (): void => {
    setIsEditingPrompt(false);
    if (userPrompt.trim()) {
      setHasUserRequested(true);
      setRecommendations([]);
      fetchRecommendations(userPrompt);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <Sparkles size={20} className={styles.sparkleIcon} />
          <h3>AI Section Recommendations</h3>
        </div>
        {hasUserRequested && (
          <button
            className={styles.regenerateBtn}
            onClick={handleRegenerate}
            disabled={isLoading}
            title="Regenerate recommendations"
          >
            <RefreshCw size={16} className={isLoading ? styles.spinning : ""} />
          </button>
        )}
      </div>

      {!hasUserRequested ? (
        <div className={styles.ctaState}>
          <Sparkles size={28} className={styles.ctaIcon} />
          <p className={styles.ctaText}>AI is ready to suggest the best sections for your proposal</p>
          <button
            className={styles.ctaBtn}
            onClick={handleGetRecommendations}
          >
            ✨ Get AI Recommendations
          </button>
        </div>
      ) : (
        <>
          <div className={styles.promptSection}>
            <label className={styles.promptLabel}>
              Custom Prompt (Optional)
            </label>
            {isEditingPrompt ? (
              <div className={styles.promptEditContainer}>
                <textarea
                  className={styles.promptTextarea}
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  placeholder="e.g., Focus on technical sections, emphasize security aspects..."
                  rows={3}
                />
                <div className={styles.promptActions}>
                  <button
                    className={styles.promptCancelBtn}
                    onClick={() => setIsEditingPrompt(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className={styles.promptApplyBtn}
                    onClick={handlePromptChange}
                  >
                    Apply & Regenerate
                  </button>
                </div>
              </div>
            ) : (
              <div
                className={styles.promptDisplay}
                onClick={() => setIsEditingPrompt(true)}
              >
                {userPrompt || "Click to add custom guidance for AI..."}
              </div>
            )}
          </div>

          {isLoading ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner}></div>
              <p>Loading recommendations...</p>
            </div>
          ) : recommendations.length === 0 ? (
            <div className={styles.emptyState}>
              <Sparkles size={32} className={styles.emptyIcon} />
              <p>No recommendations available</p>
              <span className={styles.emptyHint}>
                {!context && !documentContext
                  ? "Add context or upload documents to get AI recommendations"
                  : "All relevant sections are already selected"}
              </span>
            </div>
          ) : (
            <div className={styles.recommendationsList}>
              {recommendations.map((rec, index) => {
                const sectionKey = rec.section_title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
                return (
                  <div
                    key={`${sectionKey}-${index}`}
                    className={styles.recommendationCard}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("section_key", sectionKey);
                      e.dataTransfer.setData("section_title", rec.section_title);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    title={rec.reasoning}
                  >
                    <div className={styles.cardHeader}>
                      <div className={styles.cardDragHandle}>
                        <GripVertical size={16} />
                      </div>
                      <div className={styles.cardTitleSection}>
                        <h4 className={styles.cardTitle}>{rec.section_title}</h4>
                        <div className={styles.relevanceScore}>
                          <div className={styles.scoreBar}>
                            <div
                              className={styles.scoreBarFill}
                              style={{ width: `${rec.relevance_score * 100}%` }}
                            />
                          </div>
                          <span className={styles.scoreText}>
                            {Math.round(rec.relevance_score * 100)}%
                          </span>
                        </div>
                      </div>
                      <button
                        className={styles.addBtn}
                        onClick={() => handleAddSection(rec)}
                        title="Add to section structure"
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                    <p className={styles.cardDescription}>{rec.description}</p>
                    <p className={styles.cardReasoning}>
                      <strong>Why:</strong> {rec.reasoning}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          <div className={styles.footer}>
            <p className={styles.footerHint}>
              💡 Drag sections to reorder or click <Plus size={14} /> to add
            </p>
          </div>
        </>
      )}
    </div>
  );
}
