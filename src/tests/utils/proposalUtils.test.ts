/**
 * Tests for src/utils/proposalUtils.ts
 */

import { getTemplateTypeLabel } from "@/utils/proposalUtils";
import type { ProposalListItem } from "@/interfaces/proposalInterfaces";

type LabelInput = Pick<ProposalListItem, "templateId" | "templateType">;

const make = (templateId: string | null, templateType: string): LabelInput => ({
  templateId,
  templateType: templateType as ProposalListItem["templateType"],
});

describe("getTemplateTypeLabel", () => {
  // Known templateId labels
  it('returns "SaaS" for templateId=saas', () => {
    expect(getTemplateTypeLabel(make("saas", "predefined"))).toBe("SaaS");
  });

  it('returns "Consulting" for templateId=consulting', () => {
    expect(getTemplateTypeLabel(make("consulting", "predefined"))).toBe("Consulting");
  });

  it('returns "Agency" for templateId=agency', () => {
    expect(getTemplateTypeLabel(make("agency", "predefined"))).toBe("Agency");
  });

  it('returns "E-Commerce" for templateId=ecommerce', () => {
    expect(getTemplateTypeLabel(make("ecommerce", "predefined"))).toBe("E-Commerce");
  });

  it('returns "Enterprise" for templateId=enterprise', () => {
    expect(getTemplateTypeLabel(make("enterprise", "predefined"))).toBe("Enterprise");
  });

  // Unknown templateId — falls back to the id itself
  it("returns the templateId value for unknown ids", () => {
    expect(getTemplateTypeLabel(make("unknown-id", "predefined"))).toBe("unknown-id");
  });

  // No templateId — fall through to templateType switch
  it('returns "Template" for templateType=predefined (no templateId)', () => {
    expect(getTemplateTypeLabel(make(null, "predefined"))).toBe("Template");
  });

  it('returns "Custom" for templateType=custom', () => {
    expect(getTemplateTypeLabel(make(null, "custom"))).toBe("Custom");
  });

  it('returns "From Scratch" for templateType=scratch', () => {
    expect(getTemplateTypeLabel(make(null, "scratch"))).toBe("From Scratch");
  });

  it("returns templateType string for unknown templateType", () => {
    expect(getTemplateTypeLabel(make(null, "legacy-type"))).toBe("legacy-type");
  });

  it('returns "Template" when both templateId and templateType are empty', () => {
    expect(
      getTemplateTypeLabel({
        templateId: null,
        templateType: "" as ProposalListItem["templateType"],
      })
    ).toBe("Template");
  });
});
