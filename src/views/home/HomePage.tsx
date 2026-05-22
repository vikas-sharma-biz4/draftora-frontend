"use client";



import dynamic from "next/dynamic";

import { useState, useEffect, useRef, useMemo } from "react";

import { Search, X, CheckCircle, Settings, Sparkles, FileText, Check } from "lucide-react";



import styles from "./HomePage.module.scss";



import { PROPOSAL_TEMPLATES, SPECIAL_CARDS, SECTION_DISPLAY_NAMES } from "@/constants";

import { useDraftSessionStore } from "@/store/features/drafts/draftSessionSlice";

import {

  useProposalTitle,

  useClientId,

} from "@/store/features/wizard/proposalWizardSlice";

import DynamicPipeline from "@/components/common/DynamicPipeline";

import { useDraftAutoSave } from "@/hooks/useDraftAutoSave";

import { useClients } from "@/hooks/useClients";



const PageLayout = dynamic(() => import("@/layouts/AppLayout"), { ssr: false });



const TemplateSelectionModal = dynamic(() => import("@/components/modals/TemplateSelectionModal/TemplateSelectionModal").then(mod => mod.default), {

  ssr: false,

});



const RecreateTemplateModal = dynamic(

  () => import("@/components/modals/RecreateTemplateModal"),

  { ssr: false }

);



type SelectionMode = "template" | "scratch" | "recreate";



export default function HomePage(): JSX.Element {

  const title = useProposalTitle();

  const clientId = useClientId();

  const draftStage = useDraftSessionStore((s) => s.draftStage);

  const completedSteps = useDraftSessionStore((s) => s.completedSteps);

  const setCurrentDraftId = useDraftSessionStore((s) => s.setCurrentDraftId);



  const hasMeaningfulData = Boolean(title && clientId);

  useDraftAutoSave({ enabled: hasMeaningfulData });



  const [selectionMode, setSelectionMode] = useState<SelectionMode | null>(null);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false);

  const [showRecreateModal, setShowRecreateModal] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState<string>("");

  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { clients: preloadedClients, refetch: refetchClients } = useClients({ autoFetch: false });

  const hasFetchedClients = useRef(false);



  // Workflow steps - dynamically determined based on draftStage

  const workflowSteps = useMemo(() => {

    const stageOrder = ["template_selection", "parameters", "generated", "review"];

    const currentStageIndex = stageOrder.indexOf(draftStage);

    const currentIndex = currentStageIndex === -1 ? 0 : currentStageIndex;



    return [

      {

        id: 1,

        name: "Choose Template",

        icon: currentIndex > 0 ? <Check size={16} /> : <FileText size={16} />,

        active: currentIndex === 0,

        completed: currentIndex > 0,

      },

      {

        id: 2,

        name: "Configure",

        icon: currentIndex > 1 ? <Check size={16} /> : <Settings size={16} />,

        active: currentIndex === 1,

        completed: currentIndex > 1,

      },

      {

        id: 3,

        name: "Generate",

        icon: currentIndex > 2 ? <Check size={16} /> : <Sparkles size={16} />,

        active: currentIndex === 2,

        completed: currentIndex > 2,

      },

      {

        id: 4,

        name: "Review",

        icon: currentIndex > 3 ? <Check size={16} /> : <CheckCircle size={16} />,

        active: currentIndex === 3,

        completed: currentIndex > 3,

      },

    ];

  }, [draftStage]);



  // Fetch clients on home page load (only once)

  useEffect(() => {

    if (!hasFetchedClients.current) {

      hasFetchedClients.current = true;

      refetchClients();

    }

  }, []);



  const showPipeline = draftStage !== "template_selection" && Boolean(title && clientId);



  // Filter templates based on search query and category

  const filteredTemplates = useMemo(() => {

    let filtered = PROPOSAL_TEMPLATES;



    // Apply category filter

    if (categoryFilter !== "all") {

      filtered = filtered.filter((template) => template.category.toLowerCase() === categoryFilter);

    }



    // Apply search filter (only by name)

    if (searchQuery.trim()) {

      const query = searchQuery.toLowerCase();

      filtered = filtered.filter((template) =>

        template.name.toLowerCase().includes(query)

      );

    }



    return filtered;

  }, [searchQuery, categoryFilter]);



  function handleSelectTemplate(id: string): void {

    setSelectedTemplateId(id);

    setCurrentDraftId(null); // Clear draft ID for new proposal

    setShowTemplateModal(true);

  }



  function handleCloseTemplateModal(): void {

    setShowTemplateModal(false);

    setSelectedTemplateId(null);

    setSelectionMode(null);

  }



  function handleSelectScratch(): void {

    setSelectionMode("scratch");

    setSelectedTemplateId(null);

    setCurrentDraftId(null); // Clear draft ID for new proposal

    setShowTemplateModal(true);

  }



  const isScratchSelected = selectionMode === "scratch";

  const isRecreateSelected = selectionMode === "recreate";



  return (

    <PageLayout noPadding>

      <DynamicPipeline

        currentStage={draftStage}

        completedSteps={completedSteps}

        visible={false}

      />

      <h1 className={`page-title ${styles.pageTitle}`}>Choose Your Proposal Type</h1>

        <p className="page-subtitle">

          Select a template that matches your project needs, or start from scratch with AI-powered guidance.

        </p>



        {/* Workflow Steps Indicator */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div className={styles.workflowSteps}>

            {workflowSteps.map((step, index) => (

            <div

              key={step.id}

              className={`${styles.workflowStep} ${step.active ? styles.active : ""} ${step.completed ? styles.completed : ""}`}

            >

              <div className={styles.stepIcon}>{step.icon}</div>

              <span className={styles.stepName}>{step.name}</span>

              {index < workflowSteps.length - 1 && (

                <div className={`${styles.stepConnector} ${step.completed ? styles.connectorCompleted : ""}`} />

              )}

            </div>

          ))}

          </div>
        </div>



        {/* Search and Filter Controls */}

        <div className={styles.controlsContainer}>

          {/* Filter Pills Container */}

          <div className={styles.filterPillsContainer}>

            <div className={styles.filterGroup}>

              <button

                onClick={() => setCategoryFilter("all")}

                className={`${styles.filterPill} ${categoryFilter === "all" ? styles.active : ""}`}

              >

                All

              </button>

              <button

                onClick={() => setCategoryFilter("technical")}

                className={`${styles.filterPill} ${categoryFilter === "technical" ? styles.active : ""}`}

              >

                Technical

              </button>

              <button

                onClick={() => setCategoryFilter("creative")}

                className={`${styles.filterPill} ${categoryFilter === "creative" ? styles.active : ""}`}

              >

                Creative

              </button>

              <button

                onClick={() => setCategoryFilter("documentation")}

                className={`${styles.filterPill} ${categoryFilter === "documentation" ? styles.active : ""}`}

              >

                Documentation

              </button>

            </div>

          </div>



          {/* Search Input */}

          <div className={styles.searchWrapper}>

            <Search size={18} className={styles.searchIcon} />

            <input

              type="text"

              placeholder="Search templates by name ..."

              value={searchQuery}

              onChange={(e) => setSearchQuery(e.target.value)}

              className={styles.searchInput}

            />

            {searchQuery && (

              <button

                onClick={() => setSearchQuery("")}

                className={styles.clearButton}

                aria-label="Clear search"

              >

                <X size={16} />

              </button>

            )}

          </div>

        </div>



        <div className="template-bento-row">

          {filteredTemplates.map((template) => {

            const isSelected = selectionMode === "template" && selectedTemplateId === template.id;

            return (

              <article

                key={template.id}

                className={`tmpl-card${isSelected ? " tmpl-selected" : ""}`}

                onClick={() => handleSelectTemplate(template.id)}

                role="button"

                tabIndex={0}

                onKeyDown={(e) => {

                  if (e.key === "Enter" || e.key === " ") handleSelectTemplate(template.id);

                }}

                aria-pressed={isSelected}

              >

                {isSelected && (

                  <div className="tmpl-selected-badge" aria-hidden="true">

                    ✓

                  </div>

                )}



                <div className={`tmpl-preview ${template.gradientClass}`}>

                  <div className={`tmpl-preview-lines ${styles.previewLines}`} aria-hidden="true">

                    <div className="tmpl-preview-line" />

                    <div className="tmpl-preview-line" />

                    <div className="tmpl-preview-line" />

                    <div className="tmpl-preview-line" />

                  </div>

                  <span className="tmpl-preview-icon" aria-hidden="true">

                    {template.name}

                  </span>

                </div>



                <div className="tmpl-body">

                  <div className="tmpl-desc">{template.description}</div>

                  <div className="tmpl-sections-preview">

                    {template.sections.slice(0, 2).map((key) => (

                      <span key={key} className="badge badge-muted">

                        {SECTION_DISPLAY_NAMES[key] ?? key}

                      </span>

                    ))}

                    {template.sections.length > 2 && (

                      <span className="badge badge-muted">

                        +{template.sections.length - 2} more

                      </span>

                    )}

                  </div>

                </div>

              </article>

            );

          })}

        </div>



        <div className="template-bento-row-secondary">

          <article

            className={`tmpl-card tmpl-scratch${isScratchSelected ? " tmpl-selected" : ""}`}

            onClick={handleSelectScratch}

            role="button"

            tabIndex={0}

            onKeyDown={(e) => {

              if (e.key === "Enter" || e.key === " ") handleSelectScratch();

            }}

            aria-pressed={isScratchSelected}

          >

            {isScratchSelected && (

              <div className="tmpl-selected-badge" aria-hidden="true">

                ✓

              </div>

            )}

            <div className="tmpl-scratch-inner">

              <div className="tmpl-scratch-icon">{SPECIAL_CARDS.START_FROM_SCRATCH.icon}</div>

              <div className="tmpl-scratch-label">{SPECIAL_CARDS.START_FROM_SCRATCH.name}</div>

              <div className="tmpl-scratch-hint">{SPECIAL_CARDS.START_FROM_SCRATCH.description}</div>

            </div>

          </article>



          <article

            className={`tmpl-card tmpl-recreate${isRecreateSelected ? " tmpl-selected" : ""}`}

            onClick={() => {

              setSelectionMode("recreate");

              setShowRecreateModal(true);

            }}

            role="button"

            tabIndex={0}

            onKeyDown={(e) => {

              if (e.key === "Enter" || e.key === " ") {

                setSelectionMode("recreate");

                setShowRecreateModal(true);

              }

            }}

            aria-label="Recreate an existing document with new context"

          >

            <div className="tmpl-upload-inner">

              <div className="tmpl-upload-icon">{SPECIAL_CARDS.RECREATE_TEMPLATE.icon}</div>

              <div className="tmpl-upload-label">{SPECIAL_CARDS.RECREATE_TEMPLATE.name}</div>

              <div className="tmpl-upload-hint">{SPECIAL_CARDS.RECREATE_TEMPLATE.description}</div>

            </div>

          </article>



        </div>



        {showRecreateModal && (

          <RecreateTemplateModal

            onClose={() => {

              setShowRecreateModal(false);

              setSelectionMode(null);

            }}

          />

        )}



        {showTemplateModal && (selectedTemplateId || selectionMode === "scratch") && (

          <TemplateSelectionModal

            templateId={selectedTemplateId ?? null}

            templateName={

              selectedTemplateId

                ? PROPOSAL_TEMPLATES.find((t) => t.id === selectedTemplateId)?.name || ""

                : ""

            }

            isScratch={selectionMode === "scratch"}

            onClose={handleCloseTemplateModal}

            initialClients={preloadedClients ?? undefined}

          />

        )}

    </PageLayout>

  );

}

