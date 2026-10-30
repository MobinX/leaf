import { describe, expect, test } from 'bun:test';
import {
  escapeHTML,
  latexToMathML,
  latexToOMML,
  renderMathFallback,
  renderMathHTML,
} from './math';

describe('latexToMathML', () => {
  test('produces a MathML element', () => {
    const mathml = latexToMathML('x^2 + y^2 = z^2');
    expect(mathml.startsWith('<math')).toBe(true);
    expect(mathml.includes('</math>')).toBe(true);
  });

  test('maps LaTeX onto the matching MathML structures', () => {
    expect(latexToMathML('\\frac{1}{2}')).toContain('<mfrac>');
    expect(latexToMathML('\\sqrt{2}')).toContain('<msqrt>');
    expect(latexToMathML('x_i')).toContain('<msub>');
  });

  test('drops the TeX annotation', () => {
    expect(latexToMathML('x+1')).not.toContain('<annotation');
  });

  test('returns an empty string for an empty expression', () => {
    expect(latexToMathML('')).toBe('');
    expect(latexToMathML('   ')).toBe('');
  });

  test('returns an empty string for an unparsable expression', () => {
    expect(latexToMathML('\\frac{unclosed')).toBe('');
  });
});

describe('latexToOMML', () => {
  test('produces an Office math element', () => {
    const omml = latexToOMML('x^2');
    expect(omml.includes('<m:oMath')).toBe(true);
    expect(omml.includes('xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"')).toBe(true);
  });

  test('a fraction becomes a Word fraction', () => {
    const omml = latexToOMML('\\frac{a}{b}');
    expect(omml).toContain('<m:f>');
    expect(omml).toContain('<m:num>');
    expect(omml).toContain('<m:den>');
  });

  test('a square root becomes a Word radical', () => {
    const omml = latexToOMML('\\sqrt{x}');
    expect(omml).toContain('<m:rad>');
  });

  test('a superscript becomes a Word superscript', () => {
    const omml = latexToOMML('x^{2}');
    expect(omml).toContain('<m:sSup>');
  });

  test('the quadratic formula survives the round trip', () => {
    const omml = latexToOMML('\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}');
    expect(omml).toContain('<m:f>');
    expect(omml).toContain('<m:rad>');
    expect(omml).toContain('<m:sSup>');
    // The numerator and denominator are both present.
    expect(omml).toContain('<m:num>');
    expect(omml).toContain('<m:den>');
  });

  test('returns an empty string when there is nothing to convert', () => {
    expect(latexToOMML('')).toBe('');
    expect(latexToOMML('\\frac{unclosed')).toBe('');
  });
});

describe('renderMathHTML', () => {
  test('renders KaTeX markup', () => {
    const html = renderMathHTML('x^2');
    expect(html).toContain('katex');
    expect(html.includes('<span')).toBe(true);
  });

  test('falls back to an escaped literal for an unparsable expression', () => {
    expect(renderMathHTML('\\frac{unclosed')).toContain('katex');
  });

  test('an empty expression renders nothing', () => {
    expect(renderMathHTML('')).toBe('');
  });
});

describe('escaping', () => {
  test('escapes HTML significant characters', () => {
    expect(escapeHTML('<b>&"')).toBe('&lt;b&gt;&amp;&quot;');
  });

  test('the math fallback is escaped', () => {
    expect(renderMathFallback('<script>')).toBe('&lt;script&gt;');
  });
});
