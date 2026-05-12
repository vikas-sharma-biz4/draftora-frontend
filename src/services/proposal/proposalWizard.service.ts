/**
 * Proposal wizard step navigation services
 *
 * Track visited pipeline steps and validate step access on the backend.
 */

import { http } from "@/config/httpClient";

/**
 * Record that the user has visited a specific wizard pipeline step.
 */
export async function markProposalStepVisited(
  proposalId: number,
  stepId: number
): Promise<void> {
  await http.post<null>(`/proposals/${proposalId}/mark-step-visited/`, {
    target_step: stepId,
  });
}

/**
 * Check whether the user is allowed to access a specific wizard pipeline step.
 * Returns false on network/auth failure so callers can block navigation gracefully.
 */
export async function validateProposalStepAccess(
  proposalId: number,
  stepId: number
): Promise<boolean> {
  const data = await http.post<{ can_access: boolean }>(`/proposals/${proposalId}/validate-step-access/`, {
    target_step: stepId,
  });
  return data.can_access === true;
}
