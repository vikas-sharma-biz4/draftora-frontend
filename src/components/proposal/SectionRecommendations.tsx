"use client";

import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "@/utils/toast";
import { getSectionRecommendations, type SectionRecommendation } from "@/services/proposal.service";
import { SECTION_DISPLAY_NAMES } from "@/constants";
import Spinner from "@/components/common/Spinner";
import styles from "./SectionRecommendations.module.scss";
import { logger } from "@/utils/logger";

const RECOMMENDATIONS_SESSION_KEY = "section_recommendations_cache_v1";

export interface SectionRecommendationsRef {
  removeRecommendation: (sectionKey: string) => void;
  startBackgroundFetch: () => void;
  restoreRecommendation: (sectionKey: string, recommendation: SectionRecommendation, originalIndex?: number) => void;
  clearRecommendations: () => void;
}

interface SectionRecommendationsProps {
  templateId?: string | null;
  existingSections: string[];
  context: string;
  documentContext: string;
  onAddSection: (sectionKey: string, title: string, recommendation?: SectionRecommendation, originalIndex?: number) => void;
  onSectionAdded?: (sectionKey: string) => void;
  proposalId?: number | null;
}

const SectionRecommendations = forwardRef<SectionRecommendationsRef, SectionRecommendationsProps>((
  {
    templateId,
    existingSections,
    context,
    documentContext,
    onAddSection,
    onSectionAdded,
    proposalId,
  }: SectionRecommendationsProps,
  ref
) => {
  // For new proposals (no proposalId), always start fresh — ignore any cached state
  const isNewProposal = proposalId === null || proposalId === undefined;

  const [recommendations, setRecommendations] = useState<SectionRecommendation[]>(() => {
    if (isNewProposal || typeof window === "undefined") return [];
    try {
      const cached = sessionStorage.getItem(RECOMMENDATIONS_SESSION_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as { recommendations: SectionRecommendation[]; isRevealed: boolean; proposalId?: number };
        if (parsed.proposalId === proposalId && Array.isArray(parsed.recommendations)) {
          return parsed.recommendations;
        }
      }
    } catch { /* ignore */ }
    return [];
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRevealed, setIsRevealed] = useState<boolean>(() => {
    if (isNewProposal || typeof window === "undefined") return false;
    try {
      const cached = sessionStorage.getItem(RECOMMENDATIONS_SESSION_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as { recommendations: SectionRecommendation[]; isRevealed: boolean; proposalId?: number };
        if (parsed.proposalId === proposalId) {
          return parsed.isRevealed === true;
        }
      }
    } catch { /* ignore */ }
    return false;
  });
  const [showPromptInput, setShowPromptInput] = useState<boolean>(false);
  const [userPrompt, setUserPrompt] = useState<string>("");
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());

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

  useEffect(() => {
    if (isNewProposal) return;
    try {
      sessionStorage.setItem(
        RECOMMENDATIONS_SESSION_KEY,
        JSON.stringify({ recommendations, isRevealed, proposalId })
      );
    } catch { /* ignore */ }
  }, [recommendations, isRevealed, proposalId, isNewProposal]);


  const fetchRecommendations = async (customPrompt?: string): Promise<void> => {
    const ctx = contextRef.current;
    const docCtx = documentContextRef.current;
    const prompt = customPrompt ?? userPrompt;

    setIsLoading(true);
    setRecommendations([]); // Clear existing recommendations to show loading state
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

    logger.info('[SectionRecommendations] Adding section to TOC', { sectionKey, sectionTitle: rec.sectionTitle, originalIndex: index });

    onAddSection(sectionKey, rec.sectionTitle, rec, index);
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
    if (userPrompt.trim()) {
      setRecommendations([]);
      setShowPromptInput(false);
      fetchRecommendations(userPrompt);
    }
  };

  const handlePromptKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handlePromptChange();
    }
  };

  const handleGenerateClick = async (): Promise<void> => {
    if (!isRevealed) {
      // First click: fetch recommendations via API
      setIsLoading(true);
      try {
        await fetchRecommendations();
        setIsRevealed(true);
      } catch (error) {
        logger.error("Failed to fetch recommendations on generate click", error);
      } finally {
        setIsLoading(false);
      }
    } else {
      // Regenerate: if input is not shown, show it
      if (!showPromptInput) {
        setShowPromptInput(true);
      } else {
        // If input is shown, check if it has content
        if (userPrompt.trim()) {
          // Has content: trigger API with prompt
          setIsLoading(true);
          try {
            await fetchRecommendations(userPrompt);
            setShowPromptInput(false);
          } catch (error) {
            logger.error("Failed to regenerate recommendations", error);
          } finally {
            setIsLoading(false);
          }
        } else {
          // Empty: close the input without triggering API
          setShowPromptInput(false);
        }
      }
    }
  };

  const handleRetryFetch = (): void => {
    setRecommendations([]);
    fetchRecommendations();
  };

  // Expose removeRecommendation, startBackgroundFetch, and restoreRecommendation methods to parent via ref
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
    restoreRecommendation: (sectionKey: string, recommendation: SectionRecommendation, originalIndex?: number) => {
      setRecommendations((prev) => {
        // Check if recommendation already exists to avoid duplicates
        const normalizedKey = sectionKey.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
        const existingIndex = prev.findIndex(
          (rec) => rec.sectionTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') === normalizedKey
        );
        if (existingIndex !== -1) {
          // Already exists, don't add duplicate
          return prev;
        }
        // Insert at original index if provided, otherwise add to end
        if (originalIndex !== undefined && originalIndex >= 0 && originalIndex <= prev.length) {
          const newRecs = [...prev];
          newRecs.splice(originalIndex, 0, recommendation);
          return newRecs;
        }
        return [...prev, recommendation];
      });
    },
    clearRecommendations: () => {
      setRecommendations([]);
      setIsRevealed(false);
      setShowPromptInput(false);
      setUserPrompt("");
      try {
        sessionStorage.removeItem(RECOMMENDATIONS_SESSION_KEY);
      } catch { /* ignore */ }
    },
  }));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <h3>AI Section Recommendations</h3>
        </div>
        <button
          className={styles.ctaBtn}
          disabled={isLoading}
          aria-busy={isLoading || undefined}
          onClick={handleGenerateClick}
        >
          {isLoading ? (
            <span className={styles.ctaBtnLoadingContent}>
              <Spinner size="sm" />
              <span>{isRevealed ? "Regenerating..." : "Generating..."}</span>
            </span>
          ) : (
            isRevealed ? "Regenerate" : "Generate"
          )}
        </button>
      </div>

      {showPromptInput && (
            <div className={styles.promptSection}>
              <div className={styles.promptEditContainer}>
                <textarea
                  className={styles.promptTextarea}
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  onKeyDown={handlePromptKeyDown}
                  placeholder="e.g., Focus on technical sections, emphasize security aspects... (Press Enter to apply)"
                  rows={3}
                />
              </div>
            </div>
          )}

          {isRevealed && !isLoading && recommendations.length > 0 && (
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

    </div>
  );
});

SectionRecommendations.displayName = "SectionRecommendations";

export default SectionRecommendations;
