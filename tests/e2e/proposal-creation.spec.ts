/**
 * End-to-end tests for proposal creation wizard
 * 
 * These tests verify the complete user flow from landing page
 * to proposal generation using Playwright.
 * 
 * To run: npx playwright test
 */

import { test, expect } from '@playwright/test';

test.describe('Proposal Creation Wizard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
  });

  test('should complete full proposal creation flow', async ({ page }) => {
    // Step 1: Select template type
    await page.click('[data-testid="template-mvp"]');
    
    // Step 2: Select or create client
    await page.click('[data-testid="select-client-button"]');
    await page.fill('[data-testid="client-search"]', 'Test Client');
    
    // If client doesn't exist, create new one
    const clientExists = await page.isVisible('[data-testid="client-Test Client"]');
    if (!clientExists) {
      await page.click('[data-testid="create-new-client"]');
      await page.fill('[data-testid="client-name-input"]', 'Test Client');
      await page.fill('[data-testid="client-industry-input"]', 'Technology');
      await page.click('[data-testid="save-client-button"]');
    } else {
      await page.click('[data-testid="client-Test Client"]');
    }
    
    // Step 3: Fill proposal details
    await page.fill('[data-testid="proposal-title"]', 'E2E Test Proposal');
    await page.fill('[data-testid="proposal-description"]', 'This is an end-to-end test proposal');
    
    // Step 4: Select sections
    await page.click('[data-testid="section-executive_summary"]');
    await page.click('[data-testid="section-project_understanding"]');
    await page.click('[data-testid="section-proposed_solution"]');
    
    // Step 5: Configure preferences
    await page.selectOption('[data-testid="tone-select"]', 'professional');
    await page.selectOption('[data-testid="length-select"]', 'balanced');
    
    // Step 6: Submit and wait for generation
    await page.click('[data-testid="generate-proposal-button"]');
    
    // Wait for generation to complete (with timeout)
    await expect(page.locator('[data-testid="generation-status"]')).toContainText('completed', {
      timeout: 60000, // 60 seconds for AI generation
    });
    
    // Step 7: Verify proposal was created
    await expect(page.locator('[data-testid="proposal-title-display"]')).toContainText('E2E Test Proposal');
    
    // Step 8: Verify sections were generated
    await expect(page.locator('[data-testid="section-executive_summary-content"]')).toBeVisible();
    await expect(page.locator('[data-testid="section-project_understanding-content"]')).toBeVisible();
  });

  test('should handle document upload flow', async ({ page }) => {
    // Select template
    await page.click('[data-testid="template-custom"]');
    
    // Upload document
    const fileInput = page.locator('[data-testid="document-upload-input"]');
    await fileInput.setInputFiles('tests/fixtures/sample-document.pdf');
    
    // Wait for upload to complete
    await expect(page.locator('[data-testid="upload-status"]')).toContainText('Upload complete');
    
    // Verify document appears in list
    await expect(page.locator('[data-testid="uploaded-document-sample-document.pdf"]')).toBeVisible();
    
    // Continue with proposal creation
    await page.fill('[data-testid="proposal-title"]', 'Proposal with Document');
    await page.click('[data-testid="generate-proposal-button"]');
    
    // Verify generation started
    await expect(page.locator('[data-testid="generation-status"]')).toContainText('generating');
  });

  test('should handle section editing flow', async ({ page }) => {
    // Assume proposal already exists, navigate to it
    await page.goto('/proposals/1'); // Replace with actual proposal ID
    
    // Click edit button on a section
    await page.click('[data-testid="edit-section-executive_summary"]');
    
    // Edit content in rich text editor
    const editor = page.locator('[data-testid="section-editor"]');
    await editor.click();
    await editor.fill('Updated executive summary content');
    
    // Save changes
    await page.click('[data-testid="save-section-button"]');
    
    // Verify save success
    await expect(page.locator('[data-testid="save-status"]')).toContainText('Saved');
    
    // Verify content was updated
    await expect(page.locator('[data-testid="section-executive_summary-content"]')).toContainText('Updated executive summary content');
  });

  test('should handle section regeneration', async ({ page }) => {
    await page.goto('/proposals/1');
    
    // Click regenerate button
    await page.click('[data-testid="regenerate-section-executive_summary"]');
    
    // Optionally add additional instructions
    await page.fill('[data-testid="regeneration-instructions"]', 'Make it more technical');
    await page.click('[data-testid="confirm-regenerate"]');
    
    // Wait for regeneration
    await expect(page.locator('[data-testid="regeneration-status"]')).toContainText('completed', {
      timeout: 30000,
    });
    
    // Verify new content appeared
    await expect(page.locator('[data-testid="section-executive_summary-content"]')).not.toBeEmpty();
  });

  test('should handle version management', async ({ page }) => {
    await page.goto('/proposals/1');
    
    // Open version history
    await page.click('[data-testid="version-history-button"]');
    
    // Verify version list appears
    await expect(page.locator('[data-testid="version-list"]')).toBeVisible();
    
    // Click on a previous version
    await page.click('[data-testid="version-item-0"]');
    
    // Verify version content is displayed
    await expect(page.locator('[data-testid="version-preview"]')).toBeVisible();
    
    // Restore version
    await page.click('[data-testid="restore-version-button"]');
    await page.click('[data-testid="confirm-restore"]');
    
    // Verify restoration success
    await expect(page.locator('[data-testid="restore-status"]')).toContainText('Version restored');
  });

  test('should handle errors gracefully', async ({ page }) => {
    // Attempt to create proposal without required fields
    await page.click('[data-testid="template-mvp"]');
    await page.click('[data-testid="generate-proposal-button"]');
    
    // Verify validation errors appear
    await expect(page.locator('[data-testid="error-client-required"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-title-required"]')).toBeVisible();
    
    // Verify form doesn't submit
    await expect(page.locator('[data-testid="generation-status"]')).not.toBeVisible();
  });

  test('should handle network errors', async ({ page }) => {
    // Intercept API calls and simulate network error
    await page.route('**/api/v1/proposals/', route => {
      route.abort('failed');
    });
    
    // Attempt to create proposal
    await page.click('[data-testid="template-mvp"]');
    await page.fill('[data-testid="proposal-title"]', 'Network Error Test');
    await page.click('[data-testid="generate-proposal-button"]');
    
    // Verify error message appears
    await expect(page.locator('[data-testid="error-message"]')).toContainText('network error');
  });

  test('should auto-save draft progress', async ({ page }) => {
    // Fill in partial proposal data
    await page.click('[data-testid="template-mvp"]');
    await page.fill('[data-testid="proposal-title"]', 'Auto-save Test');
    
    // Wait for auto-save indicator
    await expect(page.locator('[data-testid="auto-save-status"]')).toContainText('Saved', {
      timeout: 5000,
    });
    
    // Refresh page
    await page.reload();
    
    // Verify data was restored
    await expect(page.locator('[data-testid="proposal-title"]')).toHaveValue('Auto-save Test');
  });
});

test.describe('Accessibility', () => {
  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/');
    
    // Tab through interactive elements
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
    
    // Verify all interactive elements are reachable
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      const focused = page.locator(':focus');
      await expect(focused).toBeVisible();
    }
  });

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/');
    
    // Verify important elements have ARIA labels
    await expect(page.locator('[aria-label="Select template type"]')).toBeVisible();
    await expect(page.locator('[aria-label="Proposal title"]')).toBeVisible();
  });
});
