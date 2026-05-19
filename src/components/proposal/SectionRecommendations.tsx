"use client";

import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "@/utils/toast";
import { getSectionRecommendations, type SectionRecommendation } from "@/services/proposal.service";
import { SECTION_DISPLAY_NAMES } from "@/constants";
import styles from "./SectionRecommendations.module.scss";
import { logger } from "@/utils/logger";
import { usePrefetchedRecommendations, useRecommendationsFetchStatus } from "@/store/features/wizard/proposalWizardSlice";

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
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [userPrompt, setUserPrompt] = useState<string>("");
  const [isEditingPrompt, setIsEditingPrompt] = useState<boolean>(false);
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());

  // Load prefetched recommendations from store
  const prefetchedRecommendations = usePrefetchedRecommendations();
  const recommendationsFetchStatus = useRecommendationsFetchStatus();

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

  // Auto-load prefetched recommendations when they arrive from store
  useEffect(() => {
    if (prefetchedRecommendations && prefetchedRecommendations.length > 0) {
      logger.info('[SectionRecommendations] Loading prefetched recommendations from store', { count: prefetchedRecommendations.length });
      setRecommendations(prefetchedRecommendations);
    }
  }, [prefetchedRecommendations]);

  const fetchRecommendations = async (customPrompt?: string): Promise<void> => {
    const ctx = contextRef.current;
    const docCtx = documentContextRef.current;
    const prompt = customPrompt ?? userPrompt;

    // Allow API call if there's either context/document context OR a user prompt
    if (!ctx && !docCtx && !prompt) {
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
        userPrompt: prompt || null,
      });

      setRecommendations(recs);
    } catch (error) {
      logger.error("Failed to fetch recommendations:", error);
      toast.error("Failed to generate recommendations. Please try again");
      setRecommendations([]);
    } finally {
      setIsLoading(false);
    }
  };


  const handleAddSection = (rec: SectionRecommendation, index: number): void => {
    const sectionKey = rec.sectionTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

    // Check if section already exists to prevent duplicates
    if (existingSections.includes(sectionKey)) {
      toast.info(`"${rec.sectionTitle}" is already in your Table of Contents`);
      return;
    }

    logger.info('[SectionRecommendations] Adding section to TOC', { sectionKey, sectionTitle: rec.sectionTitle });

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
      // No-op: auto-fetch is now triggered via prefetchRecommendations() in ParametersPage
    },
  }));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <h3>AI Section Recommendations</h3>
          {isRevealed && recommendationsFetchStatus === 'loading' && recommendations.length === 0 && (
            <span className={styles.loadingBadge}>Generating...</span>
          )}
        </div>
      </div>

      {!isRevealed ? (
        <div className={styles.ctaState}>
          <button
            className={styles.ctaBtn}
            onClick={() => setIsRevealed(true)}
          >
            Generate
          </button>
          <p className={styles.ctaHint}>AI is analyzing your context in the background</p>
        </div>
      ) : recommendationsFetchStatus === 'loading' && recommendations.length === 0 ? (
        <div className={styles.loadingState}>
          <div className={styles.spinner}></div>
          <p>Analyzing your context and generating recommendations...</p>
          <span className={styles.loadingHint}>This usually takes 5–10 seconds</span>
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
          ) : recommendationsFetchStatus === 'loading' ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner}></div>
              <p>Analyzing your context and generating recommendations...</p>
              <span className={styles.loadingHint}>This usually takes 5–10 seconds</span>
            </div>
          ) : recommendations.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No recommendations available</p>
              <span className={styles.emptyHint}>
                {!context && !documentContext && !userPrompt
                  ? "Add context, upload documents, or enter a custom prompt to get AI recommendations"
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
