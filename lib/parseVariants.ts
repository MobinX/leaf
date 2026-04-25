/**
 * Parse AI-generated variants from the returned object
 * Converts HTML strings containing variant sections into a structured object
 */

export interface ParsedVariants {
  theory: string[]; // 3 HTML variants
  common: string; // HTML with tables, calculations, data
  results_discussion: string[]; // 3 HTML variants
}

/**
 * Parse the AI output object into a clean variant structure
 * The AI returns exactly what we need, so this is mostly validation
 */
export function parseVariants(aiOutput: {
  theory: string[];
  common: string;
  results_discussion: string[];
}): ParsedVariants {
  // Validate structure
  if (
    !Array.isArray(aiOutput.theory) ||
    aiOutput.theory.length !== 3 ||
    !aiOutput.theory.every((t) => typeof t === 'string')
  ) {
    throw new Error('Invalid theory variants: expected 3 HTML strings');
  }

  if (typeof aiOutput.common !== 'string' || !aiOutput.common.trim()) {
    throw new Error('Invalid common content: expected non-empty HTML string');
  }

  if (
    !Array.isArray(aiOutput.results_discussion) ||
    aiOutput.results_discussion.length !== 3 ||
    !aiOutput.results_discussion.every((r) => typeof r === 'string')
  ) {
    throw new Error('Invalid results_discussion variants: expected 3 HTML strings');
  }

  return {
    theory: aiOutput.theory,
    common: aiOutput.common,
    results_discussion: aiOutput.results_discussion,
  };
}

/**
 * Convert HTML variants to Tiptap-compatible format
 * Wraps each variant in a section with data attributes for toolbar selection
 */
export function wrapVariantsForEditor(parsed: ParsedVariants): string {
  const theory = parsed.theory
    .map(
      (html, idx) =>
        `<section data-variant="theory" data-variant-count="${idx + 1}">${html}</section>`
    )
    .join('');

  const common = `<section data-variant="common">${parsed.common}</section>`;

  const discussion = parsed.results_discussion
    .map(
      (html, idx) =>
        `<section data-variant="results_discussion" data-variant-count="${idx + 1}">${html}</section>`
    )
    .join('');

  return `${theory}${common}${discussion}`;
}

/**
 * Extract a specific variant for display
 */
export function getVariant(
  parsed: ParsedVariants,
  section: 'theory' | 'results_discussion',
  index: 0 | 1 | 2
): string {
  if (index < 0 || index > 2) {
    throw new Error('Variant index must be 0, 1, or 2');
  }
  return parsed[section][index];
}

/**
 * Build editor content from selected variants
 */
export function buildEditorContent(
  parsed: ParsedVariants,
  selectedTheory: 0 | 1 | 2,
  selectedDiscussion: 0 | 1 | 2
): string {
  const theoryHtml = parsed.theory[selectedTheory];
  const commonHtml = parsed.common;
  const discussionHtml = parsed.results_discussion[selectedDiscussion];

  return `
    <section data-variant="theory" data-selected="true">
      ${theoryHtml}
    </section>
    <section data-variant="common">
      ${commonHtml}
    </section>
    <section data-variant="results_discussion" data-selected="true">
      ${discussionHtml}
    </section>
  `.trim();
}
