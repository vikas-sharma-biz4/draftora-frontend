"use client";

import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { Sparkles, RefreshCw, GripVertical, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "@/utils/toast";
import { getSectionRecommendations, type SectionRecommendation } from "@/services/proposal.service";
import { SECTION_DISPLAY_NAMES } from "@/constants";
import styles from "./SectionRecommendations.module.scss";
import { logger } from "@/utils/logger";

export interface SectionRecommendationsRef {
  removeRecommendation: (sectionKey: string) => void;
  startBackgroundFetch: () => void;
}

interface SectionRecommendationsProps {
  templateId?: string | null;
  existingSections: string[];
  context: string;
  documentContext: string;
  onAddSection: (sectionKey: string, title: string) => void;
  onSectionAdded?: (sectionKey: string) => void;
}

const SectionRecommendations = forwardRef<SectionRecommendationsRef, SectionRecommendationsProps>((
  {
    templateId,
    existingSections,
    context,
    documentContext,
    onAddSection,
    onSectionAdded,
  }: SectionRecommendationsProps,
  ref
) => {
  const [recommendations, setRecommendations] = useState<SectionRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasUserRequested, setHasUserRequested] = useState<boolean>(false);
  const [userPrompt, setUserPrompt] = useState<string>("");
  const [isEditingPrompt, setIsEditingPrompt] = useState<boolean>(false);
  const [isBackgroundLoading, setIsBackgroundLoading] = useState<boolean>(false);
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const hasAutoFetchedRef = useRef<boolean>(false);

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

  // Removed automatic background fetching - user must click Generate button

  const fetchRecommendationsInBackground = async (customPrompt?: string): Promise<void> => {
    const ctx = contextRef.current;
    const docCtx = documentContextRef.current;

    if (!ctx && !docCtx) {
      return;
    }

    setIsBackgroundLoading(true);
    try {
      const fullContext = [docCtx, ctx].filter(Boolean).join("\n\n");

      const existingSectionsWithRules = existingSectionsRef.current.map((key) => ({
        sectionKey: key,
        sectionName: SECTION_DISPLAY_NAMES[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        include: "",
        exclude: "",
        purpose: "",
      }));

      const recs = await getSectionRecommendations({
        templateId: templateIdRef.current,
        existingSections: existingSectionsRef.current,
        existingSectionsWithRules: existingSectionsWithRules,
        context: fullContext,
        userPrompt: customPrompt ?? userPrompt ?? null,
      });

      setRecommendations(recs);
      setHasUserRequested(true);
    } catch (error) {
      logger.error("Failed to fetch recommendations:", error);
      setRecommendations([]);
    } finally {
      setIsBackgroundLoading(false);
    }
  };

  const fetchRecommendations = async (customPrompt?: string): Promise<void> => {
    const ctx = contextRef.current;
    const docCtx = documentContextRef.current;

    if (!ctx && !docCtx) {
      return;
    }

    setIsLoading(true);
    try {
      const fullContext = [docCtx, ctx].filter(Boolean).join("\n\n");

      const existingSectionsWithRules = existingSectionsRef.current.map((key) => ({
        sectionKey: key,
        sectionName: SECTION_DISPLAY_NAMES[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        include: "",
        exclude: "",
        purpose: "",
      }));

      const recs = await getSectionRecommendations({
        templateId: templateIdRef.current,
        existingSections: existingSectionsRef.current,
        existingSectionsWithRules: existingSectionsWithRules,
        context: fullContext,
        userPrompt: customPrompt ?? userPrompt ?? null,
      });

      setRecommendations(recs);
      setHasUserRequested(true);
    } catch (error) {
      logger.error("Failed to fetch recommendations:", error);
      toast.error("Failed to generate recommendations. Please try again.");
      setRecommendations([]);
    } finally {
      setIsLoading(false);
    }
  };


  const handleGetRecommendations = (): void => {
    setHasUserRequested(true);
    setRecommendations([]);
    fetchRecommendations();
  };

  const handleRegenerate = (): void => {
    setHasUserRequested(true);
    setRecommendations([]);
    fetchRecommendations();
  };

  const handleAddSection = (rec: SectionRecommendation, index: number): void => {
    const sectionKey = rec.sectionTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

    // Check if section already exists to prevent duplicates
    if (existingSections.includes(sectionKey)) {
      toast.info(`"${rec.sectionTitle}" is already in your Table of Contents`);
      return;
    }

    onAddSection(sectionKey, rec.sectionTitle);
    toast.success(`Added "${rec.sectionTitle}" to Table of Contents`);

    // Remove from recommendations list
    setRecommendations(prev => prev.filter((_, i) => i !== index));

    // Notify parent that section was added
    if (onSectionAdded) {
      onSectionAdded(sectionKey);
    }
  };

  const toggleCardExpansion = (index: number): void => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const handlePromptChange = (): void => {
    setIsEditingPrompt(false);
    if (userPrompt.trim()) {
      setHasUserRequested(true);
      setRecommendations([]);
      fetchRecommendations(userPrompt);
    }
  };

  const handlePromptKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handlePromptChange();
    }
  };

  // Expose removeRecommendation and startBackgroundFetch methods to parent via ref
  useImperativeHandle(ref, () => ({
    removeRecommendation: (sectionKey: string) => {
      setRecommendations((prev) => {
        const index = prev.findIndex(
          (rec) => rec.sectionTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') === sectionKey
        );
        if (index !== -1) {
          return prev.filter((_, i) => i !== index);
        }
        return prev;
      });
    },
    startBackgroundFetch: () => {
      fetchRecommendationsInBackground();
    },
  }));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <h3>AI Section Recommendations</h3>
        </div>
        <div className={styles.headerActions}>
          {!hasUserRequested && (
            <button
              className={styles.getRecommendationsBtn}
              onClick={handleGetRecommendations}
              disabled={isLoading}
            >
              Generate
            </button>
          )}
        </div>
      </div>

      {!hasUserRequested ? (
        <div className={styles.ctaState}>
          <p className={styles.ctaText}>Click Generate to get AI-powered section recommendations</p>
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
                  onKeyDown={handlePromptKeyDown}
                  placeholder="e.g., Focus on technical sections, emphasize security aspects... (Press Enter to apply)"
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
                const sectionKey = rec.sectionTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
                const isExpanded = expandedCards.has(index);
                return (
                  <div
                    key={`${sectionKey}-${index}`}
                    className={styles.recommendationCard}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("section_key", sectionKey);
                      e.dataTransfer.setData("section_title", rec.sectionTitle);
                      e.dataTransfer.setData("recommendation_index", index.toString());
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onDragEnd={() => {
                      // Clean up drag state to prevent indefinite dragging
                    }}
                  >
                    <div className={styles.cardHeader}>
                      <div className={styles.cardTitleSection}>
                        <h4 className={styles.cardTitle}>{rec.sectionTitle}</h4>
                        <div className={styles.relevanceScore}>
                          <div className={styles.scoreBar}>
                            <div
                              className={styles.scoreBarFill}
                              style={{ width: `${rec.relevanceScore * 100}%` }}
                            />
                          </div>
                          <span className={styles.scoreText}>
                            {Math.round(rec.relevanceScore * 100)}%
                          </span>
                        </div>
                      </div>
                      <button
                        className={styles.expandBtn}
                        onClick={() => toggleCardExpansion(index)}
                        title={isExpanded ? "Collapse details" : "Expand details"}
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      <button
                        className={styles.addBtn}
                        onClick={() => handleAddSection(rec, index)}
                        title="Add to section structure"
                      >
                        Add
                      </button>
                    </div>
                    {isExpanded && (
                      <div className={styles.cardContent}>
                        <p className={styles.cardDescription}>{rec.description}</p>
                        <p className={styles.cardReasoning}>
                          <strong>Why:</strong> {rec.reasoning}
                        </p>
                        {rec.purpose && (
                          <p className={styles.cardPurpose}>
                            <strong>Purpose:</strong> {rec.purpose}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </>
      )}
    </div>
  );
});

SectionRecommendations.displayName = "SectionRecommendations";

export default SectionRecommendations;
