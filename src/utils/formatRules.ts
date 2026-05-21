/**
 * Format Rules Utility
 *
 * Generates format rules for AI content generation based on template type and section context.
 * These rules guide the AI in determining the optimal content format (table, bullets, diagram, paragraph).
 */

import type { TemplateType } from "@/interfaces/proposalInterfaces";

/**
 * Format rules mapping for different template types.
 * These provide guidance to the AI on how to structure content based on the template.
 */
const TEMPLATE_FORMAT_RULES: Partial<Record<TemplateType, string>> = {
  brd: `For Business Requirement Documents:
- Use structured format with clear sections
- Include requirement tables with ID, description, priority, and acceptance criteria
- Use numbered lists for requirements
- Include business rules in separate sections
- Format functional requirements as user stories where applicable`,
  frd: `For Functional Requirement Documents:
- Use structured format with functional specifications
- Include feature descriptions and acceptance criteria
- Use tables for requirement tracking
- Include technical specifications with clear headings
- Format as structured paragraphs with subheadings`,
  srs: `For Software Requirement Specifications:
- Use formal specification format
- Include system requirements in table format
- Use numbered lists for requirements
- Include interface specifications
- Format with clear hierarchical structure`,
  architecture: `For Architecture Documents:
- Use structured format with component descriptions
- Include architecture diagrams (if applicable)
- Use tables for technology stack comparisons
- Include system design patterns
- Format with clear sections for each architectural component`,
  sow: `For Statements of Work:
- Use formal business document format
- Include deliverables in table format
- Use numbered lists for milestones
- Include pricing tables
- Format as structured paragraphs with clear headings`,
  mvp: `For MVP (Minimum Viable Product) Documents:
- Use lean, focused format
- Include feature prioritization tables
- Use bullet points for feature descriptions
- Include timeline in table format
- Format as concise sections with clear priorities`,
  poc: `For Proof of Concept Documents:
- Use experimental format
- Include hypothesis and test cases in tables
- Use bullet points for test results
- Include success criteria
- Format as structured sections with clear objectives`,
  design: `For Design Documents:
- Use visual format with design specifications
- Include design system tables
- Use bullet points for design principles
- Include component descriptions
- Format with clear sections for each design aspect`,
  predefined: `For Predefined Templates:
- Use standard proposal format
- Include structured sections based on template
- Use appropriate format (tables, bullets, paragraphs) based on section type
- Follow industry best practices`,
  custom: `For Custom Templates:
- Use flexible format based on user instructions
- Adapt format to section requirements
- Use tables, bullets, or paragraphs as appropriate
- Follow user-provided guidelines`,
  scratch: `For Scratch/Blank Templates:
- Use flexible format based on section content
- Determine optimal format based on section purpose
- Use appropriate structure for the content type
- Follow general best practices`,
  recreate: `For Recreate Mode:
- Match the format of the original document
- Preserve structure and formatting
- Use tables, bullets, or paragraphs as in the original
- Maintain consistency with source material`,
};

/**
 * Section-specific format hints based on section name keywords.
 * These provide additional guidance for specific section types.
 */
const SECTION_FORMAT_HINTS: Record<string, string> = {
  "timeline": "Use table format with columns for phase, duration, deliverables, and dependencies.",
  "milestone": "Use table format with columns for milestone, date, description, and status.",
  "budget": "Use table format with columns for item, cost, quantity, and total.",
  "pricing": "Use table format with columns for service/feature, pricing tier, and cost.",
  "team": "Use table format with columns for role, name, experience, and responsibilities.",
  "technology": "Use table format comparing technologies with pros, cons, and use cases.",
  "stack": "Use table format with columns for technology, purpose, and version.",
  "requirement": "Use table format with columns for ID, requirement, priority, and acceptance criteria.",
  "deliverable": "Use table format with columns for deliverable, description, timeline, and acceptance criteria.",
  "feature": "Use bullet points with clear descriptions and priorities.",
  "benefit": "Use bullet points for clear, concise benefit statements.",
  "risk": "Use table format with columns for risk, likelihood, impact, and mitigation.",
  "architecture": "Use structured paragraphs with diagrams (if applicable) and component descriptions.",
  "workflow": "Use step-by-step numbered list or diagram format.",
  "process": "Use numbered list or flow diagram format.",
  "api": "Use table format with columns for endpoint, method, description, and parameters.",
  "database": "Use table format for schema descriptions and relationships.",
  "integration": "Use table format with columns for system, integration type, and status.",
};

/**
 * Generate format rules based on template type and section context.
 *
 * @param templateType - The proposal template type
 * @param sectionName - The name of the section being generated
 * @param instructions - User-provided instructions for the section
 * @returns Format rules string to guide AI generation
 */
export function generateFormatRules(
  templateType?: string,
  sectionName?: string,
  instructions?: string
): string {
  const rules: string[] = [];

  // Add template-specific format rules
  if (templateType && templateType in TEMPLATE_FORMAT_RULES) {
    rules.push(TEMPLATE_FORMAT_RULES[templateType as TemplateType]!);
  }

  // Add section-specific format hints based on section name
  if (sectionName) {
    const sectionLower = sectionName.toLowerCase();
    for (const [keyword, hint] of Object.entries(SECTION_FORMAT_HINTS)) {
      if (sectionLower.includes(keyword)) {
        rules.push(hint);
        break;
      }
    }
  }

  // Add general format guidance
  rules.push(`General Format Guidelines:
- Use Markdown formatting for structure
- Use **bold** for important terms and concepts
- Use ## or ### for subheadings
- Ensure consistent formatting throughout
- Match the tone and style of the proposal
- Use tables for structured data
- Use bullet points for lists and features
- Use numbered lists for sequential items
- Use clear paragraphs for narrative content`);

  // If user provided instructions, acknowledge them
  if (instructions) {
    rules.push(`User Instructions:
- Prioritize user-provided instructions over general guidelines
- Adapt format to match user's specific requirements`);
  }

  // Add AI format determination instruction
  rules.push(`AI Format Determination:
- Analyze the section name and instructions to determine the optimal format
- Choose between table, bullets, diagram, or paragraph format based on content type
- Ensure the chosen format best presents the information
- Return the determined format type in the response metadata`);

  return rules.join("\n\n");
}

/**
 * Get a simple format hint for a section based on its name.
 * This is a lighter version for quick format suggestions.
 *
 * @param sectionName - The name of the section
 * @returns Format hint string or empty string if no match
 */
export function getSectionFormatHint(sectionName?: string): string {
  if (!sectionName) return "";

  const sectionLower = sectionName.toLowerCase();
  for (const [keyword, hint] of Object.entries(SECTION_FORMAT_HINTS)) {
    if (sectionLower.includes(keyword)) {
      return hint;
    }
  }

  return "";
}
