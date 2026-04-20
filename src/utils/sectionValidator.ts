/**
 * Section content validation utilities
 * Ensures sections follow required structural templates
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates "Similar Projects" section structure
 * Expected format:
 * - Project Name (bold heading)
 * - Description paragraph
 * - Key Highlights (bullet list)
 * - Conclusion paragraph
 */
export function validateSimilarProjectsStructure(content: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for minimum content
  if (!content || content.trim().length < 50) {
    errors.push("Content is too short. Please add project details.");
    return { isValid: false, errors, warnings };
  }

  // Check for bold headings (project names)
  const boldHeadingPattern = /\*\*[^*]+\*\*|\<strong\>[^<]+\<\/strong\>|\<h3[^>]*\>[^<]+\<\/h3\>/g;
  const headings = content.match(boldHeadingPattern);
  
  if (!headings || headings.length === 0) {
    warnings.push("No project names found. Use bold text or headings for project names.");
  }

  // Check for bullet points (highlights)
  const hasBullets = /[-*]\s+/.test(content) || /<li>/i.test(content) || /<ul>/i.test(content);
  if (!hasBullets) {
    warnings.push("No bullet points found. Consider adding key highlights as a list.");
  }

  // Check for paragraphs
  const paragraphPattern = /<p>|^[A-Z][^<\n]{30,}/gm;
  const paragraphs = content.match(paragraphPattern);
  
  if (!paragraphs || paragraphs.length < 2) {
    warnings.push("Add more descriptive paragraphs for project context and conclusion.");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates table structure
 * Ensures tables have proper headers and at least one data row
 */
export function validateTableStructure(content: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const hasTableTag = /<table/i.test(content);
  const hasMarkdownTable = /\|[^|]+\|/.test(content);

  if (!hasTableTag && !hasMarkdownTable) {
    errors.push("No table structure found.");
    return { isValid: false, errors, warnings };
  }

  // Check for headers
  const hasHeaders = /<th/i.test(content) || /\|[-:]+\|/.test(content);
  if (!hasHeaders) {
    errors.push("Table must have header row.");
  }

  // Check for data rows
  const hasDataRows = /<td/i.test(content) || (hasMarkdownTable && content.split('\n').filter(line => line.includes('|')).length > 2);
  if (!hasDataRows) {
    warnings.push("Table appears empty. Add at least one data row.");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates paragraph-only sections
 * Ensures no bullet points or tables are present
 */
export function validateParagraphOnlyStructure(content: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for bullet points
  const hasBullets = /[-*]\s+/.test(content) || /<li>/i.test(content) || /<ul>/i.test(content) || /<ol>/i.test(content);
  if (hasBullets) {
    errors.push("This section should use paragraphs only. Remove bullet points.");
  }

  // Check for tables
  const hasTables = /<table/i.test(content) || /\|[^|]+\|/.test(content);
  if (hasTables) {
    errors.push("This section should use paragraphs only. Remove tables.");
  }

  // Check for minimum paragraph content
  if (content.trim().length < 100) {
    warnings.push("Content is too short. Add more detailed paragraphs.");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates that important terms are bolded
 */
export function validateBoldUsage(content: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const hasBold = /\*\*[^*]+\*\*/.test(content) || /<strong>/i.test(content) || /<b>/i.test(content);
  
  if (!hasBold) {
    warnings.push("Consider highlighting important terms using bold text.");
  }

  return {
    isValid: true, // This is a warning-only check
    errors,
    warnings,
  };
}

/**
 * Main validation dispatcher
 * Routes to appropriate validator based on section key
 */
export function validateSectionContent(sectionKey: string, content: string): ValidationResult {
  // Sections that must be paragraph-only
  const paragraphOnlySections = ['introduction', 'project_understanding'];
  
  if (paragraphOnlySections.includes(sectionKey)) {
    return validateParagraphOnlyStructure(content);
  }

  // Similar projects needs special structure
  if (sectionKey === 'similar_projects') {
    return validateSimilarProjectsStructure(content);
  }

  // Table sections
  if (sectionKey.includes('technology_stack') || sectionKey.includes('comparison')) {
    return validateTableStructure(content);
  }

  // Default: check for bold usage
  return validateBoldUsage(content);
}
