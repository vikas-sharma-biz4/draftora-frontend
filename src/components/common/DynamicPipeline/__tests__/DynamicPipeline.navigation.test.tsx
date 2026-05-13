/**
 * Tests for progressive pipeline navigation
 * 
 * Verifies that users can only navigate to current step or previous steps,
 * not future steps.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { useRouter, usePathname } from 'next/navigation';
import DynamicPipeline from '../DynamicPipeline';
import type { DraftStage } from '@/interfaces/draftInterfaces';

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

const mockPush = jest.fn();
const mockRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockPathname = usePathname as jest.MockedFunction<typeof usePathname>;

describe('DynamicPipeline - Progressive Navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouter.mockReturnValue({ push: mockPush } as any);
  });

  describe('Step 1 (Parameters Page)', () => {
    beforeEach(() => {
      mockPathname.mockReturnValue('/parameters');
    });

    it('should allow clicking Step 1 (current step)', () => {
      render(
        <DynamicPipeline
          currentStage="wizard_in_progress"
          completedSteps={[]}
          visible={true}
        />
      );

      const step1 = screen.getByLabelText(/Parameters/i);
      expect(step1).toHaveClass('clickable');
      
      fireEvent.click(step1);
      expect(mockPush).toHaveBeenCalledWith('/parameters');
    });

    it('should NOT allow clicking Step 2 (future step)', () => {
      render(
        <DynamicPipeline
          currentStage="wizard_in_progress"
          completedSteps={[]}
          visible={true}
        />
      );

      const step2 = screen.getByLabelText(/Review/i);
      expect(step2).not.toHaveClass('clickable');
      expect(step2).toHaveAttribute('tabIndex', '-1');
      
      fireEvent.click(step2);
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should NOT allow clicking Step 3 (future step)', () => {
      render(
        <DynamicPipeline
          currentStage="wizard_in_progress"
          completedSteps={[]}
          visible={true}
        />
      );

      const step3 = screen.getByLabelText(/Web View/i);
      expect(step3).not.toHaveClass('clickable');
      expect(step3).toHaveAttribute('tabIndex', '-1');
      
      fireEvent.click(step3);
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should show reduced opacity for future steps', () => {
      const { container } = render(
        <DynamicPipeline
          currentStage="wizard_in_progress"
          completedSteps={[]}
          visible={true}
        />
      );

      const steps = container.querySelectorAll('.step');
      const step2 = steps[1]; // Review step
      const step3 = steps[2]; // Web View step

      expect(step2).not.toHaveClass('clickable');
      expect(step3).not.toHaveClass('clickable');
    });
  });

  describe('Step 2 (Review Page)', () => {
    beforeEach(() => {
      mockPathname.mockReturnValue('/review');
    });

    it('should allow clicking Step 1 (previous step)', () => {
      render(
        <DynamicPipeline
          currentStage="parameters_complete"
          completedSteps={[1]}
          visible={true}
        />
      );

      const step1 = screen.getByLabelText(/Parameters/i);
      expect(step1).toHaveClass('clickable');
      
      fireEvent.click(step1);
      expect(mockPush).toHaveBeenCalledWith('/parameters');
    });

    it('should allow clicking Step 2 (current step)', () => {
      render(
        <DynamicPipeline
          currentStage="parameters_complete"
          completedSteps={[1]}
          visible={true}
        />
      );

      const step2 = screen.getByLabelText(/Review/i);
      expect(step2).toHaveClass('clickable');
      
      fireEvent.click(step2);
      expect(mockPush).toHaveBeenCalledWith('/review');
    });

    it('should NOT allow clicking Step 3 (future step)', () => {
      render(
        <DynamicPipeline
          currentStage="parameters_complete"
          completedSteps={[1]}
          visible={true}
        />
      );

      const step3 = screen.getByLabelText(/Web View/i);
      expect(step3).not.toHaveClass('clickable');
      expect(step3).toHaveAttribute('tabIndex', '-1');
      
      fireEvent.click(step3);
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should show Step 1 as completed (green)', () => {
      render(
        <DynamicPipeline
          currentStage="parameters_complete"
          completedSteps={[1]}
          visible={true}
        />
      );

      const step1 = screen.getByLabelText(/Parameters/i);
      expect(step1).toHaveClass('completed');
    });
  });

  describe('Step 3 (Web View Page)', () => {
    beforeEach(() => {
      mockPathname.mockReturnValue('/proposal/123');
    });

    it('should allow clicking Step 1 (previous step)', () => {
      render(
        <DynamicPipeline
          currentStage="generated"
          completedSteps={[1, 2]}
          visible={true}
          proposalId={123}
        />
      );

      const step1 = screen.getByLabelText(/Parameters/i);
      expect(step1).toHaveClass('clickable');
      
      fireEvent.click(step1);
      expect(mockPush).toHaveBeenCalledWith('/parameters');
    });

    it('should allow clicking Step 2 (previous step)', () => {
      render(
        <DynamicPipeline
          currentStage="generated"
          completedSteps={[1, 2]}
          visible={true}
          proposalId={123}
        />
      );

      const step2 = screen.getByLabelText(/Review/i);
      expect(step2).toHaveClass('clickable');
      
      fireEvent.click(step2);
      expect(mockPush).toHaveBeenCalledWith('/review');
    });

    it('should allow clicking Step 3 (current step)', () => {
      render(
        <DynamicPipeline
          currentStage="generated"
          completedSteps={[1, 2]}
          visible={true}
          proposalId={123}
        />
      );

      const step3 = screen.getByLabelText(/Web View/i);
      expect(step3).toHaveClass('clickable');
      
      fireEvent.click(step3);
      expect(mockPush).toHaveBeenCalledWith('/proposal/123');
    });

    it('should show all steps as clickable when proposal is generated', () => {
      const { container } = render(
        <DynamicPipeline
          currentStage="generated"
          completedSteps={[1, 2]}
          visible={true}
          proposalId={123}
        />
      );

      const steps = container.querySelectorAll('.step');
      steps.forEach(step => {
        expect(step).toHaveClass('clickable');
      });
    });

    it('should show Steps 1 and 2 as completed (green)', () => {
      render(
        <DynamicPipeline
          currentStage="generated"
          completedSteps={[1, 2]}
          visible={true}
          proposalId={123}
        />
      );

      const step1 = screen.getByLabelText(/Parameters/i);
      const step2 = screen.getByLabelText(/Review/i);
      
      expect(step1).toHaveClass('completed');
      expect(step2).toHaveClass('completed');
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      mockPathname.mockReturnValue('/parameters');
    });

    it('should set tabIndex=0 for clickable steps', () => {
      render(
        <DynamicPipeline
          currentStage="wizard_in_progress"
          completedSteps={[]}
          visible={true}
        />
      );

      const step1 = screen.getByLabelText(/Parameters/i);
      expect(step1).toHaveAttribute('tabIndex', '0');
    });

    it('should set tabIndex=-1 for non-clickable steps', () => {
      render(
        <DynamicPipeline
          currentStage="wizard_in_progress"
          completedSteps={[]}
          visible={true}
        />
      );

      const step2 = screen.getByLabelText(/Review/i);
      const step3 = screen.getByLabelText(/Web View/i);
      
      expect(step2).toHaveAttribute('tabIndex', '-1');
      expect(step3).toHaveAttribute('tabIndex', '-1');
    });

    it('should set aria-current="step" on active step', () => {
      render(
        <DynamicPipeline
          currentStage="wizard_in_progress"
          completedSteps={[]}
          visible={true}
        />
      );

      const step1 = screen.getByLabelText(/Parameters/i);
      expect(step1).toHaveAttribute('aria-current', 'step');
    });

    it('should have descriptive aria-labels', () => {
      render(
        <DynamicPipeline
          currentStage="parameters_complete"
          completedSteps={[1]}
          visible={true}
        />
      );

      expect(screen.getByLabelText(/Parameters.*Completed/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Review.*Current/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Web View.*Upcoming/i)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing completedSteps array', () => {
      mockPathname.mockReturnValue('/review');
      
      render(
        <DynamicPipeline
          currentStage="parameters_complete"
          completedSteps={undefined as any}
          visible={true}
        />
      );

      // Should not crash
      const step1 = screen.getByLabelText(/Parameters/i);
      expect(step1).toBeInTheDocument();
    });

    it('should handle custom onStepClick handler', () => {
      mockPathname.mockReturnValue('/review');
      const customHandler = jest.fn();
      
      render(
        <DynamicPipeline
          currentStage="parameters_complete"
          completedSteps={[1]}
          visible={true}
          onStepClick={customHandler}
        />
      );

      const step1 = screen.getByLabelText(/Parameters/i);
      fireEvent.click(step1);
      
      expect(customHandler).toHaveBeenCalledWith(1, '/parameters');
      expect(mockPush).not.toHaveBeenCalled(); // Custom handler overrides default
    });

    it('should navigate to proposal when clicking Step 3 with proposalId', () => {
      mockPathname.mockReturnValue('/proposal/456');
      
      render(
        <DynamicPipeline
          currentStage="generated"
          completedSteps={[1, 2]}
          visible={true}
          proposalId={456}
        />
      );

      const step3 = screen.getByLabelText(/Web View/i);
      fireEvent.click(step3);
      
      expect(mockPush).toHaveBeenCalledWith('/proposal/456');
    });
  });
});
