/**
 * Math rendering for every export target.
 *
 * The editor stores equations as LaTeX in a `<math data-latex="…">` node. Each
 * output format needs a different representation:
 *
 * | Target          | Representation                                   |
 * |-----------------|--------------------------------------------------|
 * | PDF / print     | KaTeX HTML (rendered by the browser)             |
 * | Word (.docx)    | OMML — a *native, editable* Word equation        |
 * | Google Docs     | PNG raster of the KaTeX render (pixel perfect)   |
 *
 * The Word path goes LaTeX → MathML (KaTeX) → OMML (`mathml2omml`), which is
 * the same route Microsoft Word itself takes when you paste an equation.
 */

import katex from 'katex';
import { mml2omml } from 'mathml2omml';

/** KaTeX wraps the MathML payload in a `<span class="katex">`. */
const MATHML_PATTERN = /<math\b[\s\S]*?<\/math>/i;

/** KaTeX adds the original TeX as an `<annotation>`; OMML has no place for it. */
const ANNOTATION_PATTERN = /<annotation\b[^>]*>[\s\S]*?<\/annotation>/gi;

/**
 * Converts LaTeX to a MathML fragment (the `<math>` element only).
 *
 * Returns an empty string when the expression cannot be parsed.
 */
export function latexToMathML(latex: string): string {
  const source = (latex ?? '').trim();
  if (!source) return '';

  let html: string;
  try {
    html = katex.renderToString(source, {
      output: 'mathml',
      displayMode: false,
      throwOnError: false,
    });
  } catch {
    return '';
  }

  const match = html.match(MATHML_PATTERN);
  if (!match) return '';

  // Dropping the annotation keeps `mathml2omml` from logging an unsupported
  // element on every conversion.
  return match[0].replace(ANNOTATION_PATTERN, '');
}

/**
 * Converts LaTeX to OMML — the Office Open XML math markup that Word renders
 * as a real, editable equation (and that Google Docs converts into its own
 * equation objects on .docx import).
 */
export function latexToOMML(latex: string): string {
  const mathml = latexToMathML(latex);
  if (!mathml) return '';

  try {
    return mml2omml(mathml);
  } catch {
    return '';
  }
}

/**
 * KaTeX HTML for the expression. Used by the PDF/print path, where the
 * browser does the typesetting.
 */
export function renderMathHTML(latex: string): string {
  const source = (latex ?? '').trim();
  if (!source) return '';

  try {
    return katex.renderToString(source, {
      output: 'html',
      displayMode: false,
      throwOnError: false,
      strict: 'ignore',
    });
  } catch {
    return escapeHTML(source);
  }
}

/** The plain-text fallback used when an expression cannot be rendered. */
export function renderMathFallback(latex: string): string {
  return escapeHTML((latex ?? '').trim());
}

export function escapeHTML(value: string): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
