/**
 * Zustand store for proposal generation state
 *
 * Manages the real-time generation state streamed from backend via SSE.
 * This store is backend-authoritative - it only reflects what the backend sends.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type GenerationStatus =
  | 'queued'
  | 'initializing'
  | 'parsing'
  | 'validating'
  | 'planning'
  | 'generating'
  | 'refining'
  | 'finalizing'
  | 'completed'
  | 'failed'
  | 'cancelled';

interface GenerationState {
  // Core state
  proposalId: number | null;
  jobId: string | null;
  status: GenerationStatus;
  currentStage: string | null;
  progressPercent: number;
  
  // Section tracking
  totalSections: number;
  completedSections: number;
  currentSection: string | null;
  selectedSections: string[];
  completedSectionKeys: string[];
  
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  reconnectCount: number;
  
  // Timing
  startedAt: string | null;
  completedAt: string | null;
  estimatedSecondsRemaining: number | null;
  
  // Actions
  setProposalId: (id: number) => void;
  setJobId: (id: string) => void;
  setStatus: (status: GenerationStatus) => void;
  setCurrentStage: (stage: string | null) => void;
  setProgressPercent: (percent: number) => void;
  setCurrentSection: (section: string | null) => void;
  setSelectedSections: (sections: string[]) => void;
  addCompletedSection: (section: string) => void;
  setCompletedSections: (count: number) => void;
  setTotalSections: (count: number) => void;
  setConnectionState: (isConnected: boolean, isConnecting: boolean) => void;
  setError: (error: string | null) => void;
  incrementReconnectCount: () => void;
  resetReconnectCount: () => void;
  setStartedAt: (timestamp: string) => void;
  setCompletedAt: (timestamp: string | null) => void;
  setEstimatedSecondsRemaining: (seconds: number | null) => void;
  reset: () => void;
}

const INITIAL_STATE: Omit<GenerationState, 'setProposalId' | 'setJobId' | 'setStatus' | 'setCurrentStage' | 'setProgressPercent' | 'setCurrentSection' | 'setSelectedSections' | 'addCompletedSection' | 'setCompletedSections' | 'setTotalSections' | 'setConnectionState' | 'setError' | 'incrementReconnectCount' | 'resetReconnectCount' | 'setStartedAt' | 'setCompletedAt' | 'setEstimatedSecondsRemaining' | 'reset'> = {
  proposalId: null,
  jobId: null,
  status: 'queued',
  currentStage: null,
  progressPercent: 0,
  totalSections: 0,
  completedSections: 0,
  currentSection: null,
  selectedSections: [],
  completedSectionKeys: [],
  isConnected: false,
  isConnecting: false,
  error: null,
  reconnectCount: 0,
  startedAt: null,
  completedAt: null,
  estimatedSecondsRemaining: null,
};

export const useGenerationStore = create<GenerationState>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,
      
      setProposalId: (id) => set({ proposalId: id }),
      setJobId: (id) => set({ jobId: id }),
      setStatus: (status) => set({ status }),
      setCurrentStage: (stage) => set({ currentStage: stage }),
      setProgressPercent: (percent) => set({ progressPercent: percent }),
      setCurrentSection: (section) => set({ currentSection: section }),
      setSelectedSections: (sections) => set({ selectedSections: sections }),
      addCompletedSection: (section) => set((state) => ({
        completedSectionKeys: [...state.completedSectionKeys, section],
        completedSections: state.completedSections + 1,
      })),
      setCompletedSections: (count) => set({ completedSections: count }),
      setTotalSections: (count) => set({ totalSections: count }),
      setConnectionState: (isConnected, isConnecting) => set({ isConnected, isConnecting }),
      setError: (error) => set({ error }),
      incrementReconnectCount: () => set((state) => ({ reconnectCount: state.reconnectCount + 1 })),
      resetReconnectCount: () => set({ reconnectCount: 0 }),
      setStartedAt: (timestamp) => set({ startedAt: timestamp }),
      setCompletedAt: (timestamp) => set({ completedAt: timestamp }),
      setEstimatedSecondsRemaining: (seconds) => set({ estimatedSecondsRemaining: seconds }),
      
      reset: () => set(INITIAL_STATE),
    }),
    {
      name: 'generation-storage',
      // Only persist certain fields
      partialize: (state) => ({
        proposalId: state.proposalId,
        jobId: state.jobId,
        status: state.status,
        currentStage: state.currentStage,
        progressPercent: state.progressPercent,
        totalSections: state.totalSections,
        completedSections: state.completedSections,
        currentSection: state.currentSection,
        selectedSections: state.selectedSections,
        completedSectionKeys: state.completedSectionKeys,
        startedAt: state.startedAt,
      }),
    }
  )
);

// Selectors for common use cases
export const selectGenerationStatus = (state: GenerationState) => state.status;
export const selectGenerationProgress = (state: GenerationState) => state.progressPercent;
export const selectIsGenerating = (state: GenerationState) => 
  ['queued', 'initializing', 'parsing', 'validating', 'planning', 'generating', 'refining', 'finalizing'].includes(state.status);
export const selectIsCompleted = (state: GenerationState) => state.status === 'completed';
export const selectIsFailed = (state: GenerationState) => state.status === 'failed';
export const selectIsCancelled = (state: GenerationState) => state.status === 'cancelled';
