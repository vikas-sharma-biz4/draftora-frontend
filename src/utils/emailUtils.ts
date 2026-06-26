/**
 * Replaces any "View Proposal" occurrences in the email HTML with a correct
 * hyperlink to the proposal page. Handles three cases:
 *
 * 1. Plain-text "[View Proposal]" — LLM placeholder stored as-is in the DB.
 * 2. Anchor tags whose href is still the LLM placeholder value, or whose
 *    text content is "view proposal" — catches hallucinated hrefs.
 * 3. Duplicate View Proposal links — keeps only the first occurrence.
 *
 * Skip when proposalId is null (no proposal to link to).
 */
export function fixProposalLinks(html: string, proposalId: number): string {
  if (typeof window === "undefined") return html;

  // Step 1: Replace bare plain-text "[View Proposal]" placeholders (no anchor tag yet).
  const withLinks = html.replace(
    /\[View Proposal\]/gi,
    `<a href="/proposal/${proposalId}">View Proposal</a>`
  );

  // Step 2: Fix existing anchor tags that still carry a wrong href.
  const doc = new DOMParser().parseFromString(withLinks, "text/html");
  doc.querySelectorAll("a").forEach((a) => {
    const href = a.getAttribute("href") ?? "";
    const text = a.textContent?.trim().toLowerCase() ?? "";
    let decodedHref = href;
    try {
      decodedHref = decodeURIComponent(href);
    } catch {
      // href was not URI-encoded — use as-is
    }
    if (text === "view proposal" || decodedHref.toLowerCase() === "[view proposal]") {
      a.setAttribute("href", `/proposal/${proposalId}`);
    }
  });

  // Step 3: Deduplicate — keep only the first View Proposal link; remove extras.
  const proposalLinks = doc.querySelectorAll(`a[href="/proposal/${proposalId}"]`);
  if (proposalLinks.length > 1) {
    proposalLinks.forEach((link, index) => {
      if (index > 0) {
        link.parentNode?.removeChild(link);
      }
    });
  }

  return doc.body.innerHTML;
}
