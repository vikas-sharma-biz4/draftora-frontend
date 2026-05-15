/**
 * Unit tests for generation state management (Zustand store)
 *
 * Tests the generation slice which manages backend-authoritative
 * generation state for proposal generation.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { useGenerationStore } from '../generationSlice';

describe('generationSlice', () => {
  beforeEach(() => {
    // Reset store state before each test
    useGenerationStore.getState().reset();
  });

  it('should initialize with default state', () => {
    const state = useGenerationStore.getState();

    expect(state.proposalId).toBeNull();
    expect(state.jobId).toBeNull();
    expect(state.status).toBe('queued');
    expect(state.currentStage).toBeNull();
    expect(state.progressPercent).toBe(0);
    expect(state.totalSections).toBe(0);
    expect(state.completedSections).toBe(0);
    expect(state.currentSection).toBeNull();
    expect(state.selectedSections).toEqual([]);
    expect(state.completedSectionKeys).toEqual([]);
    expect(state.isConnected).toBe(false);
    expect(state.isConnecting).toBe(false);
    expect(state.error).toBeNull();
    expect(state.reconnectCount).toBe(0);
  });

  it('should set proposalId', () => {
    useGenerationStore.getState().setProposalId(123);

    const state = useGenerationStore.getState();
    expect(state.proposalId).toBe(123);
  });

  it('should set jobId', () => {
    useGenerationStore.getState().setJobId('gen_test_123');

    const state = useGenerationStore.getState();
    expect(state.jobId).toBe('gen_test_123');
  });

  it('should set status', () => {
    useGenerationStore.getState().setStatus('generating');

    const state = useGenerationStore.getState();
    expect(state.status).toBe('generating');
  });

  it('should set currentStage', () => {
    useGenerationStore.getState().setCurrentStage('parsing');

    const state = useGenerationStore.getState();
    expect(state.currentStage).toBe('parsing');
  });

  it('should set progressPercent', () => {
    useGenerationStore.getState().setProgressPercent(50);

    const state = useGenerationStore.getState();
    expect(state.progressPercent).toBe(50);
  });

  it('should set currentSection', () => {
    useGenerationStore.getState().setCurrentSection('Executive Summary');

    const state = useGenerationStore.getState();
    expect(state.currentSection).toBe('Executive Summary');
  });

  it('should setSelectedSections', () => {
    const sections = ['Executive Summary', 'Technical Approach', 'Pricing'];
    useGenerationStore.getState().setSelectedSections(sections);

    const state = useGenerationStore.getState();
    expect(state.selectedSections).toEqual(sections);
  });

  it('should add completed section', () => {
    useGenerationStore.getState().setSelectedSections(['Executive Summary', 'Technical Approach']);
    useGenerationStore.getState().addCompletedSection('Executive Summary');

    const state = useGenerationStore.getState();
    expect(state.completedSectionKeys).toContain('Executive Summary');
    expect(state.completedSections).toBe(1);
  });

  it('should add multiple completed sections', () => {
    useGenerationStore.getState().setSelectedSections(['Executive Summary', 'Technical Approach', 'Pricing']);
    useGenerationStore.getState().addCompletedSection('Executive Summary');
    useGenerationStore.getState().addCompletedSection('Technical Approach');

    const state = useGenerationStore.getState();
    expect(state.completedSectionKeys).toEqual(['Executive Summary', 'Technical Approach']);
    expect(state.completedSections).toBe(2);
  });

  it('should set completed sections count', () => {
    useGenerationStore.getState().setCompletedSections(5);

    const state = useGenerationStore.getState();
    expect(state.completedSections).toBe(5);
  });

  it('should set connection state', () => {
    useGenerationStore.getState().setConnectionState(true, false);

    const state = useGenerationStore.getState();
    expect(state.isConnected).toBe(true);
    expect(state.isConnecting).toBe(false);
  });

  it('should set connecting state', () => {
    useGenerationStore.getState().setConnectionState(false, true);

    const state = useGenerationStore.getState();
    expect(state.isConnected).toBe(false);
    expect(state.isConnecting).toBe(true);
  });

  it('should set error', () => {
    useGenerationStore.getState().setError('Generation failed');

    const state = useGenerationStore.getState();
    expect(state.error).toBe('Generation failed');
  });

  it('should increment reconnect count', () => {
    useGenerationStore.getState().incrementReconnectCount();
    useGenerationStore.getState().incrementReconnectCount();
    useGenerationStore.getState().incrementReconnectCount();

    const state = useGenerationStore.getState();
    expect(state.reconnectCount).toBe(3);
  });

  it('should reset reconnect count', () => {
    useGenerationStore.getState().incrementReconnectCount();
    useGenerationStore.getState().incrementReconnectCount();
    useGenerationStore.getState().resetReconnectCount();

    const state = useGenerationStore.getState();
    expect(state.reconnectCount).toBe(0);
  });

  it('should set startedAt', () => {
    const timestamp = '2025-01-15T10:00:00Z';
    useGenerationStore.getState().setStartedAt(timestamp);

    const state = useGenerationStore.getState();
    expect(state.startedAt).toBe(timestamp);
  });

  it('should set completedAt', () => {
    const timestamp = '2025-01-15T10:30:00Z';
    useGenerationStore.getState().setCompletedAt(timestamp);

    const state = useGenerationStore.getState();
    expect(state.completedAt).toBe(timestamp);
  });

  it('should set estimated seconds remaining', () => {
    useGenerationStore.getState().setEstimatedSecondsRemaining(45);

    const state = useGenerationStore.getState();
    expect(state.estimatedSecondsRemaining).toBe(45);
  });

  it('should reset all state to defaults', () => {
    // Set some values
    useGenerationStore.getState().setProposalId(123);
    useGenerationStore.getState().setJobId('gen_test_123');
    useGenerationStore.getState().setStatus('generating');
    useGenerationStore.getState().setProgressPercent(50);
    useGenerationStore.getState().setError('Test error');

    // Reset
    useGenerationStore.getState().reset();

    const state = useGenerationStore.getState();
    expect(state.proposalId).toBeNull();
    expect(state.jobId).toBeNull();
    expect(state.status).toBe('queued');
    expect(state.progressPercent).toBe(0);
    expect(state.error).toBeNull();
  });

  it('should track complete generation lifecycle', () => {
    // Simulate complete lifecycle
    useGenerationStore.getState().setProposalId(123);
    useGenerationStore.getState().setJobId('gen_test_123');
    useGenerationStore.getState().setStartedAt('2025-01-15T10:00:00Z');
    useGenerationStore.getState().setStatus('initializing');
    useGenerationStore.getState().setSelectedSections(['Executive Summary', 'Technical Approach', 'Pricing']);
    useGenerationStore.getState().setConnectionState(false, true);
    useGenerationStore.getState().setConnectionState(true, false);
    useGenerationStore.getState().setCurrentStage('parsing');
    useGenerationStore.getState().setStatus('generating');
    useGenerationStore.getState().setCurrentSection('Executive Summary');
    useGenerationStore.getState().addCompletedSection('Executive Summary');
    useGenerationStore.getState().setProgressPercent(33);
    useGenerationStore.getState().setCurrentSection('Technical Approach');
    useGenerationStore.getState().addCompletedSection('Technical Approach');
    useGenerationStore.getState().setProgressPercent(66);
    useGenerationStore.getState().setCurrentSection('Pricing');
    useGenerationStore.getState().addCompletedSection('Pricing');
    useGenerationStore.getState().setProgressPercent(100);
    useGenerationStore.getState().setStatus('completed');
    useGenerationStore.getState().setCompletedAt('2025-01-15T10:30:00Z');

    const state = useGenerationStore.getState();
    expect(state.proposalId).toBe(123);
    expect(state.jobId).toBe('gen_test_123');
    expect(state.status).toBe('completed');
    expect(state.progressPercent).toBe(100);
    expect(state.completedSections).toBe(3);
    expect(state.completedSectionKeys).toEqual(['Executive Summary', 'Technical Approach', 'Pricing']);
    expect(state.isConnected).toBe(true);
  });

  it('should track failed generation lifecycle', () => {
    // Simulate failed lifecycle
    useGenerationStore.getState().setProposalId(456);
    useGenerationStore.getState().setJobId('gen_test_456');
    useGenerationStore.getState().setStartedAt('2025-01-15T11:00:00Z');
    useGenerationStore.getState().setStatus('generating');
    useGenerationStore.getState().setProgressPercent(25);
    useGenerationStore.getState().setError('AI generation timeout');
    useGenerationStore.getState().setStatus('failed');

    const state = useGenerationStore.getState();
    expect(state.status).toBe('failed');
    expect(state.error).toBe('AI generation timeout');
    expect(state.progressPercent).toBe(25);
  });

  it('should track cancelled generation lifecycle', () => {
    // Simulate cancelled lifecycle
    useGenerationStore.getState().setProposalId(789);
    useGenerationStore.getState().setJobId('gen_test_789');
    useGenerationStore.getState().setStartedAt('2025-01-15T12:00:00Z');
    useGenerationStore.getState().setStatus('generating');
    useGenerationStore.getState().setProgressPercent(50);
    useGenerationStore.getState().setStatus('cancelled');

    const state = useGenerationStore.getState();
    expect(state.status).toBe('cancelled');
    expect(state.progressPercent).toBe(50);
  });

  it('should handle reconnection scenario', () => {
    // Simulate reconnection
    useGenerationStore.getState().setProposalId(123);
    useGenerationStore.getState().setConnectionState(false, false);
    useGenerationStore.getState().incrementReconnectCount();
    useGenerationStore.getState().setConnectionState(false, true);
    useGenerationStore.getState().setConnectionState(true, false);
    useGenerationStore.getState().resetReconnectCount();

    const state = useGenerationStore.getState();
    expect(state.isConnected).toBe(true);
    expect(state.reconnectCount).toBe(0);
  });
});
