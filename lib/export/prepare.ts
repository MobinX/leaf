/**
 * Turns the editor's HTML into a DOM that every exporter can consume.
 *
 * The editor stores two custom nodes that plain HTML cannot show:
 *
 *   • `<math data-latex="…">`  — an inline equation.
 *   • `<chart data-datasets="…">` — a rendered chart.
 *
 * Both are replaced here:
 *
 *   • equations become `<span class="export-math" data-export-math="latex">`
 *     placeholders, so each exporter can pick the representation it needs
 *     (KaTeX HTML for PDF, OMML for Word, a raster for Google Docs);
 *   • charts become `<img>` elements holding the PNG that was rendered on
 *     screen, so the export shows exactly what the user sees.
 *
 * Every top-level block is tagged with `data-export-block="<index>"` which is
 * what lets the paginator report *which content ended up on which page*.
 */

import { escapeHTML, renderMathHTML } from './math';

export type ExportBlockKind =
  | 'paragraph'
  | 'heading'
  | 'list'
  | 'table'
  | 'image'
  | 'chart'
  | 'quote'
  | 'code'
  | 'rule'
  | 'other';

export interface ExportBlock {
  /** Index of the block in document order. */
  index: number;
  kind: ExportBlockKind;
  /** 1–6 for headings. */
  headingLevel?: number;
  /** Plain-text preview, used for the page map. */
  text: string;
}

export interface ChartImage {
  /** PNG data URL of the chart as rendered on screen. */
  src: string;
  /** Rendered width in CSS pixels. */
  widthPx: number;
  /** Rendered height in CSS pixels. */
  heightPx: number;
  alignment: string;
}

export interface PreparedExport {
  /** The prepared body element. */
  body: HTMLElement;
  /** Chart images, in document order. */
  charts: ChartImage[];
  /** Block metadata, in document order. */
  blocks: ExportBlock[];
}

/** Attribute used to tag a top-level block for the page map. */
export const BLOCK_ATTRIBUTE = 'data-export-block';

/** Attribute carrying the LaTeX source of an equation placeholder. */
export const MATH_ATTRIBUTE = 'data-export-math';

/** Attribute marking an image that was produced from a chart node. */
export const CHART_ATTRIBUTE = 'data-export-chart';

const BLOCK_TEXT_LIMIT = 160;

/**
 * Prepares the editor HTML for export.
 *
 * @param html       The editor's HTML (`editor.getHTML()`).
 * @param chartImages The rendered charts, in the same document order as the
 *                    `<chart>` nodes in `html`.
 */
export function prepareExport(html: string, chartImages: ChartImage[] = []): PreparedExport {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(`<body>${html ?? ''}</body>`, 'text/html');
  const body = parsed.body;

  replaceMathNodes(body);
  const charts = replaceChartNodes(body, chartImages);

  const blocks: ExportBlock[] = [];
  Array.from(body.children).forEach((child, index) => {
    child.setAttribute(BLOCK_ATTRIBUTE, String(index));
    blocks.push(describeBlock(child, index));
  });

  return { body, charts, blocks };
}

function replaceMathNodes(root: HTMLElement): void {
  const nodes = Array.from(root.querySelectorAll('math'));
  nodes.forEach((node) => {
    const latex = node.getAttribute('data-latex') ?? node.textContent ?? '';
    const placeholder = document.createElement('span');
    placeholder.className = 'export-math';
    placeholder.setAttribute(MATH_ATTRIBUTE, latex);
    node.replaceWith(placeholder);
  });
}

function replaceChartNodes(root: HTMLElement, chartImages: ChartImage[]): ChartImage[] {
  const nodes = Array.from(root.querySelectorAll('chart'));
  const used: ChartImage[] = [];

  nodes.forEach((node, index) => {
    const image = chartImages[index];
    if (!image) return;

    const img = document.createElement('img');
    img.setAttribute(CHART_ATTRIBUTE, String(index));
    img.setAttribute('src', image.src);
    img.setAttribute('alt', 'Chart');
    if (image.widthPx > 0) img.setAttribute('width', String(Math.round(image.widthPx)));
    if (image.heightPx > 0) img.setAttribute('height', String(Math.round(image.heightPx)));
    img.setAttribute('style', 'max-width: 100%; height: auto;');
    if (image.alignment) img.setAttribute('data-alignment', image.alignment);

    node.replaceWith(img);
    used.push(image);
  });

  return used;
}

function describeBlock(element: Element, index: number): ExportBlock {
  const tag = element.tagName.toLowerCase();
  const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, BLOCK_TEXT_LIMIT);

  if (/^h[1-6]$/.test(tag)) {
    return {
      index,
      kind: 'heading',
      headingLevel: Number(tag.slice(1)),
      text,
    };
  }

  switch (tag) {
    case 'p':
      return { index, kind: 'paragraph', text };
    case 'ul':
    case 'ol':
      return { index, kind: 'list', text };
    case 'table':
      return { index, kind: 'table', text };
    case 'blockquote':
      return { index, kind: 'quote', text };
    case 'pre':
      return { index, kind: 'code', text };
    case 'hr':
      return { index, kind: 'rule', text };
    case 'img':
    case 'figure':
      return { index, kind: 'image', text };
    default:
      break;
  }

  if (element.querySelector('img')) return { index, kind: 'image', text };
  if (element.querySelector('table')) return { index, kind: 'table', text };

  return { index, kind: 'other', text };
}

/**
 * Reads the text alignment of a block, so the exporters can honour it.
 */
export function readTextAlign(element: Element): 'left' | 'center' | 'right' | 'justify' | null {
  const style = (element.getAttribute('style') ?? '').toLowerCase();
  const match = style.match(/text-align\s*:\s*(left|center|right|justify)/);
  const value = match?.[1];
  if (value === 'left' || value === 'center' || value === 'right' || value === 'justify') {
    return value;
  }
  return null;
}

/** Serialises a prepared body back to HTML. */
export function serializeBody(body: HTMLElement): string {
  return body.innerHTML;
}

/**
 * Renders every equation placeholder with KaTeX.
 *
 * Used by the paths that typeset the document in the browser (PDF and
 * print). The DOCX path reads the LaTeX source instead and turns it into
 * native Word math.
 */
export function renderMathPlaceholders(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>(`[${MATH_ATTRIBUTE}]`).forEach((element) => {
    const latex = element.getAttribute(MATH_ATTRIBUTE) ?? '';
    element.innerHTML = renderMathHTML(latex);
  });
}

/** A standalone HTML document for the Google Docs import path. */
export function buildStandaloneHTML(options: {
  title: string;
  bodyHTML: string;
  style: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHTML(options.title)}</title>
<style>${options.style}</style>
</head>
<body>
${options.bodyHTML}
</body>
</html>`;
}
