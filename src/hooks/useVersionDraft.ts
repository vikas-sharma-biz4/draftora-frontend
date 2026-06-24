/**
 * Hook for branching a new pending draft from a History (approved / rejected)
 * proposal.
 *
 * Usage:
 *   const { isCreating, draftId, triggerVersionDraft } = useVersionDraft(parentProposalId);
 *
 *   // Inside an edit-click handler:
 *   const newId = await triggerVersionDraft("section_edit");
 *   // URL is updated to /review?proposalId={newId} when called from the review
 *   // page, or /proposal/{newId} from any other page.
 */

import { useState, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createVersionDraft } from "@/services/proposal";
import { useProposalStore } from "@/store/features/proposals/proposalSlice";
import type { ProposalListItem, VersionDraftTrigger } from "@/interfaces/proposalInterfaces";
import { toast } from "@/utils/toast";
import { logger } from "@/utils/logger";

interface UseVersionDraftReturn {
  isCreating: boolean;
  draftId: number | null;
  triggerVersionDraft: (trigger: VersionDraftTrigger) => Promise<number | null>;
}

export function useVersionDraft(parentProposalId: number): UseVersionDraftReturn {
  const router = useRouter();
  const pathname = usePathname();
  const addVersionDraft = useProposalStore((s) => s.addVersionDraft);
  const invalidateCache = useProposalStore((s) => s.invalidateCache);

  const [isCreating, setIsCreating] = useState(false);
  const [draftId, setDraftId] = useState<number | null>(null);

  // Guard against double-firing: if a branch is already in flight, return the
  // existing draftId immediately rather than creating another child proposal.
  const pendingRef = useRef<number | null>(null);

  const triggerVersionDraft = useCallback(
    async (trigger: VersionDraftTrigger): Promise<number | null> => {
      // If a branch is already in flight for this parent, return that id.
      if (pendingRef.current !== null) {
        return pendingRef.current;
      }

      setIsCreating(true);
      try {
        const draft = await createVersionDraft(parentProposalId, trigger);

        pendingRef.current = draft.id;
        setDraftId(draft.id);

        // Add to the store's versionDrafts list for optimistic display.
        // Missing ProposalListItem fields are filled with inert defaults — the
        // DraftsPage renders only the version-specific fields from this shape.
        const listItem: ProposalListItem = {
          id: draft.id,
          title: draft.title,
          clientId: 0,
          clientName: "",
          status: draft.status,
          approvalStatus: draft.approvalStatus as "pending" | "approved" | "rejected",
          tone: "professional",
          lengthPreference: "balanced",
          templateType: "scratch",
          createdAt: draft.createdAt,
          updatedAt: draft.createdAt,
          versionLabel: draft.versionLabel,
          parentProposalId: draft.parentProposalId,
          rootProposalId: draft.rootProposalId,
        };
        addVersionDraft(listItem);

        // Invalidate the main proposals cache so the DraftsPage refetches
        // the full list with accurate metadata on next mount.
        invalidateCache();

        logger.info(
          "[useVersionDraft] Version draft created | parentId=%d | draftId=%d | label=%s | trigger=%s",
          parentProposalId,
          draft.id,
          draft.versionLabel,
          trigger
        );

        // Navigate back to the same page context but targeting the new draft.
        // Review page → stay on review. All other pages → go to proposal output.
        const destination = pathname.startsWith("/review")
          ? `/review?proposalId=${draft.id}`
          : `/proposal/${draft.id}`;
        router.push(destination);

        return draft.id;
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Failed to create version draft.";
        logger.error("[useVersionDraft] createVersionDraft failed:", error);
        toast.error(msg);
        return null;
      } finally {
        setIsCreating(false);
        // Clear the in-flight guard so the hook can be reused if the user
        // navigates back and triggers another branch.
        pendingRef.current = null;
      }
    },
    [parentProposalId, addVersionDraft, invalidateCache, router, pathname]
  );

  return { isCreating, draftId, triggerVersionDraft };
}
