"use client";

import React, { useRef, useState, useEffect } from "react";
import { Sparkles, RefreshCw, GripVertical, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { getSectionRecommendations, type SectionRecommendation } from "@/api/proposalApi";
import { SECTION_DISPLAY_NAMES } from "@/constants";
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

  useEffect(() => {
    if (!hasAutoFetchedRef.current && (context || documentContext)) {
      hasAutoFetchedRef.current = true;
      fetchRecommendationsInBackground();
    }
  }, [context, documentContext]);

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
        section_key: key,
        section_name: SECTION_DISPLAY_NAMES[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        include: "",
        exclude: "",
        purpose: "",
      }));

      const recs = await getSectionRecommendations({
        template_id: templateIdRef.current,
        existing_sections: existingSectionsRef.current,
        existing_sections_with_rules: existingSectionsWithRules,
        context: fullContext,
        user_prompt: customPrompt ?? userPrompt ?? null,
      });

      setRecommendations(recs);
      setHasUserRequested(true);
    } catch (error) {
      console.error("Failed to fetch recommendations:", error);
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
        section_key: key,
        section_name: SECTION_DISPLAY_NAMES[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        include: "",
        exclude: "",
        purpose: "",
      }));

      const recs = await getSectionRecommendations({
        template_id: templateIdRef.current,
        existing_sections: existingSectionsRef.current,
        existing_sections_with_rules: existingSectionsWithRules,
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
    const sectionKey = rec.section_title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    
    // Check if section already exists to prevent duplicates
    if (existingSections.includes(sectionKey)) {
      toast.info(`"${rec.section_title}" is already in your Table of Contents`);
      return;
    }
    
    onAddSection(sectionKey, rec.section_title);
    toast.success(`Added "${rec.section_title}" to Table of Contents`);
    
    // Remove from recommendations list
    setRecommendations(prev => prev.filter((_, i) => i !== index));
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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <Sparkles size={20} className={styles.sparkleIcon} />
          <h3>AI Section Recommendations</h3>
          {isBackgroundLoading && (
            <span className={styles.backgroundLoadingIndicator} title="Loading recommendations in background...">
              <RefreshCw size={14} className={styles.spinning} />
            </span>
          )}
        </div>
        <div className={styles.headerActions}>
          {(recommendations.length === 0 || !hasUserRequested) && !isBackgroundLoading && (
            <button
              className={styles.getRecommendationsBtn}
              onClick={handleGetRecommendations}
              disabled={isLoading}
            >
              {isLoading && <RefreshCw size={14} className={styles.spinning} style={{ marginRight: '6px' }} />}
              Get AI based Recommended Sections
            </button>
          )}
          {hasUserRequested && recommendations.length > 0 && (
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
      </div>

      {!hasUserRequested && !isBackgroundLoading ? (
        <div className={styles.ctaState}>
          <Sparkles size={28} className={styles.ctaIcon} />
          <p className={styles.ctaText}>AI is ready to suggest the best sections for your proposal</p>
        </div>
      ) : isBackgroundLoading && !hasUserRequested ? (
        <div className={styles.ctaState}>
          <Sparkles size={28} className={styles.ctaIcon} />
          <p className={styles.ctaText}>AI is analyzing your context to suggest the best sections...</p>
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
                const isExpanded = expandedCards.has(index);
                return (
                  <div
                    key={`${sectionKey}-${index}`}
                    className={styles.recommendationCard}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("section_key", sectionKey);
                      e.dataTransfer.setData("section_title", rec.section_title);
                      e.dataTransfer.setData("recommendation_index", index.toString());
                      e.dataTransfer.effectAllowed = "copy";
                    }}
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
                        className={styles.expandBtn}
                        onClick={() => toggleCardExpansion(index)}
                        title={isExpanded ? "Collapse details" : "Expand details"}
                      >
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                      <button
                        className={styles.addBtn}
                        onClick={() => handleAddSection(rec, index)}
                        title="Add to section structure"
                      >
                        <Plus size={18} />
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
}
