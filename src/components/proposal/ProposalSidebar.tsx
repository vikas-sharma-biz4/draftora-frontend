/**
 * ProposalSidebar component
 * 
 * Handles sidebar section management including:
 * - Section list display with active state
 * - Section renaming
 * - Section removal
 * - Adding new sections
 */

"use client";

import { useState } from 'react';
import { Pencil, X, Check, Plus } from 'lucide-react';
import { toast } from '@/utils/toast';
import { MESSAGES } from '@/constants/messages';
import {
  addProposalSection,
  removeProposalSection,
} from '@/services/proposal.service';

interface SectionMeta {
  key: string;
  label: string;
  hasContent: boolean;
}

interface ProposalSidebarProps {
  proposalId: number;
  sections: SectionMeta[];
  activeSection: string;
  onSectionClick: (key: string) => void;
  onSectionRenamed: (key: string, newLabel: string) => void;
  onSectionRemoved: (key: string) => void;
  onSectionAdded: (key: string, label: string, content: string) => void;
}

export default function ProposalSidebar({
  proposalId,
  sections,
  activeSection,
  onSectionClick,
  onSectionRenamed,
  onSectionRemoved,
  onSectionAdded,
}: ProposalSidebarProps): JSX.Element {
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');
  const [showAddInput, setShowAddInput] = useState<boolean>(false);
  const [addLabelValue, setAddLabelValue] = useState<string>('');
  const [addingSection, setAddingSection] = useState<boolean>(false);

  function startRename(key: string, currentLabel: string): void {
    setRenamingKey(key);
    setRenameValue(currentLabel);
  }

  function saveRename(key: string): void {
    const label = renameValue.trim();
    if (!label) return;
    onSectionRenamed(key, label);
    setRenamingKey(null);
  }

  async function handleRemoveSection(key: string): Promise<void> {
    if (sections.length <= 1) {
      toast.error(MESSAGES.PROPOSAL_MIN_SECTIONS);
      return;
    }
    try {
      await removeProposalSection(proposalId, key);
      onSectionRemoved(key);
      toast.success(MESSAGES.PROPOSAL_SECTION_REMOVED);
    } catch {
      toast.error(MESSAGES.PROPOSAL_SECTION_REMOVE_FAILED);
    }
  }

  async function handleAddSection(): Promise<void> {
    const label = addLabelValue.trim();
    if (!label) return;
    
    const key =
      'custom_' +
      label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 40);

    if (sections.some(s => s.key === key)) {
      toast.error(MESSAGES.PROPOSAL_SECTION_NAME_EXISTS);
      return;
    }

    setAddingSection(true);
    try {
      toast.info(MESSAGES.PROPOSAL_SECTION_GENERATING);
      const result = await addProposalSection(proposalId, { key, label });
      onSectionAdded(key, label, result.content);
      setAddLabelValue('');
      setShowAddInput(false);
      toast.success(MESSAGES.PROPOSAL_SECTION_ADDED(label));
    } catch (error) {
      const message = error instanceof Error ? error.message : MESSAGES.PROPOSAL_SECTION_ADD_FAILED;
      toast.error(message);
    } finally {
      setAddingSection(false);
    }
  }

  return (
    <nav className="proposal-sidebar" aria-label="Proposal sections">
      <div className="proposal-sidebar-title">Sections</div>

      <ul className="proposal-sidebar-links">
        {sections.map(({ key, label, hasContent }) => {
          const isActive = activeSection === key;
          const isRenaming = renamingKey === key;

          return (
            <li key={key}>
              <div
                className={`proposal-sidebar-section-row${isActive ? ' active' : ''}`}
                onClick={() => !isRenaming && onSectionClick(key)}
              >
                <span
                  className={`proposal-sidebar-dot ${hasContent ? 'has-content' : 'empty'}`}
                />

                {isRenaming ? (
                  <input
                    className="proposal-sidebar-section-edit-input"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveRename(key);
                      if (e.key === 'Escape') setRenamingKey(null);
                    }}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="proposal-sidebar-section-name">
                    {label}
                  </span>
                )}

                {isRenaming ? (
                  <div className="proposal-sidebar-section-actions flex-center">
                    <button
                      className="proposal-sidebar-icon-btn"
                      title="Save rename"
                      onClick={(e) => { e.stopPropagation(); saveRename(key); }}
                    >
                      <Check size={11} />
                    </button>
                    <button
                      className="proposal-sidebar-icon-btn"
                      title="Cancel"
                      onClick={(e) => { e.stopPropagation(); setRenamingKey(null); }}
                    >
                      <X size={11} />
                    </button>
                  </div>
                ) : (
                  <div className="proposal-sidebar-section-actions">
                    <button
                      className="proposal-sidebar-icon-btn"
                      title="Rename section"
                      onClick={(e) => { e.stopPropagation(); startRename(key, label); }}
                    >
                      <Pencil size={11} />
                    </button>
                    <button
                      className="proposal-sidebar-icon-btn danger"
                      title="Remove section"
                      onClick={(e) => { e.stopPropagation(); handleRemoveSection(key); }}
                    >
                      <X size={11} />
                    </button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Add section */}
      {showAddInput ? (
        <div className="proposal-sidebar-add-wrap">
          <input
            className="proposal-sidebar-section-edit-input w-full mb-6"
            placeholder="Section name…"
            value={addLabelValue}
            onChange={(e) => setAddLabelValue(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddSection();
              if (e.key === 'Escape') {
                setShowAddInput(false);
                setAddLabelValue('');
              }
            }}
            disabled={addingSection}
          />
          <div className="proposal-sidebar-add-actions">
            <button
              className="btn btn-primary btn-xs"
              onClick={handleAddSection}
              disabled={addingSection}
            >
              {addingSection ? '…' : 'Add'}
            </button>
            <button
              className="btn btn-ghost btn-xs-ghost"
              onClick={() => {
                setShowAddInput(false);
                setAddLabelValue('');
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          className="proposal-sidebar-add-btn"
          onClick={() => setShowAddInput(true)}
        >
          <Plus size={12} />
          Add section
        </button>
      )}
    </nav>
  );
}
