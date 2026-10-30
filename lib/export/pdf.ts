/**
 * Selectable PDF export.
 *
 * Built the same way the Word export is built (`docx.ts`): the prepared DOM
 * is walked block by block onto sheets with the **exact** page size and
 * margins, using the **same** page-break set, so every block starts on the
 * same page in both files. Body text, headings, lists and tables are written
 * as real PDF text — selectable and crisp — while equations and charts are
 * embedded as images (the same representation the Google Docs path uses).
 *
 * This replaces the previous screenshot pipeline, which rasterised every
 * page to PNG: that output was not selectable and its pages could drift away
 * from the Word file's.
 */

import { DEFAULT_HEADING_SIZES } from './docx';
import { renderMathHTML } from './math';
import { MATH_ATTRIBUTE, readTextAlign } from './prepare';
import type { ExportPageGeometry } from './styles';

export interface PdfExportOptions {
  /** The prepared body element (equations still LaTeX placeholders). */
  body: HTMLElement;
  geometry: ExportPageGeometry;
  /** Indices of the blocks that start a new page — shared with the .docx. */
  pageBreakBlocks?: Set<number>;
  /** Heading sizes in half-points, measured from the live editor. */
  headingSizes?: Record<number, number>;
  /** Document title, used for the file properties. */
  title?: string;
}

/** Millimetres per typographic point. */
const PT_TO_MM = 25.4 / 72;

/** Body copy: 12pt, matching the Word export's default run. */
const BODY_SIZE_PT = 12;
/** Body line spacing, matching the Word export (`w:line="300"` = 1.25). */
const BODY_LINE_FACTOR = 1.25;
/** Space after a body paragraph: 120 twips, as in the Word export. */
const BODY_AFTER_MM = (120 / 1440) * 25.4;

/** Heading spacing: 240/120 twips before/after, as in the Word export. */
const HEADING_BEFORE_MM = (240 / 1440) * 25.4;
const HEADING_AFTER_MM = (120 / 1440) * 25.4;

/** List item spacing: 60 twips after, as in the Word export. */
const ITEM_AFTER_MM = (60 / 1440) * 25.4;
/** List indents: 720/1440 twips for level 0/1, as in the Word export. */
const LIST_INDENT_MM = [720, 1440].map((twips) => (twips / 1440) * 25.4);

/** Table cell padding: 100 twips, as in the Word export. */
const CELL_PAD_MM = (100 / 1440) * 25.4;

/**
 * Renders the prepared document into a selectable PDF blob.
 */
export async function exportToPDF(options: PdfExportOptions): Promise<Blob> {
  const { body, geometry } = options;
  const pageBreakBlocks = options.pageBreakBlocks ?? new Set<number>();
  const headingSizes = { ...DEFAULT_HEADING_SIZES, ...(options.headingSizes ?? {}) };

  const { jsPDF } = await import('jspdf');

  // The raster step replaces equation placeholders with images on a clone,
  // so the caller's body (also consumed by the Word export) keeps its LaTeX.
  const working = body.cloneNode(true) as HTMLElement;
  await rasterizeMath(working);

  const pdf = new jsPDF({
    unit: 'mm',
    format: [geometry.widthMm, geometry.heightMm],
    orientation: geometry.widthMm > geometry.heightMm ? 'landscape' : 'portrait',
    // Uncompressed streams keep the text operators readable, which is what
    // the end-to-end test asserts for selectability.
    compress: false,
  });
  pdf.setProperties({
    title: options.title ?? 'Document',
    creator: 'Leaf',
  });

  const blocks = Array.from(working.children) as HTMLElement[];
  const layout = new PdfLayout(pdf, geometry, headingSizes);

  assignBlocksToPages(blocks.length, pageBreakBlocks).forEach((page, pageIndex) => {
    if (pageIndex > 0) layout.addPage();
    page.forEach((blockIndex) => layout.renderBlock(blocks[blockIndex]));
  });

  layout.finish();
  return pdf.output('blob');
}

/**
 * Groups block indices into pages from the shared break set.
 *
 * Page one always starts at block zero; every other page starts at a block
 * in `breaks`. Out-of-range and duplicate breaks are ignored, so the PDF can
 * consume the exact set the Word export consumes.
 */
export function assignBlocksToPages(blockCount: number, breaks?: Set<number>): number[][] {
  if (blockCount <= 0) return [];

  const starts = [0];
  if (breaks) {
    for (const block of breaks) {
      if (Number.isInteger(block) && block > 0 && block < blockCount) {
        starts.push(block);
      }
    }
  }
  starts.sort((a, b) => a - b);

  const pages: number[][] = [];
  for (let index = 0; index < starts.length; index += 1) {
    if (index > 0 && starts[index] === starts[index - 1]) continue;
    const end = index + 1 < starts.length ? starts[index + 1] : blockCount;
    const page: number[] = [];
    for (let block = starts[index]; block < end; block += 1) page.push(block);
    pages.push(page);
  }
  return pages;
}

/**
 * Renders every equation placeholder as a PNG, in place.
 *
 * Mirrors the Google Docs path: the KaTeX render is pixel-perfect, and the
 * capture size is stored so the PDF can lay the image out at its CSS size.
 */
async function rasterizeMath(root: HTMLElement): Promise<void> {
  const holders = Array.from(root.querySelectorAll<HTMLElement>(`[${MATH_ATTRIBUTE}]`));
  if (holders.length === 0) return;

  const { domToCanvas } = await import('modern-screenshot');

  const container = document.createElement('div');
  container.setAttribute('aria-hidden', 'true');
  container.style.cssText = [
    'position: fixed',
    'left: -30000px',
    'top: 0',
    'width: 1200px',
    'pointer-events: none',
    'opacity: 0',
  ].join('; ');

  // The clone has to be laid out in the document to be captured.
  container.appendChild(root);
  document.body.appendChild(container);

  try {
    for (const holder of holders) {
      const latex = holder.getAttribute(MATH_ATTRIBUTE) ?? '';
      holder.innerHTML = renderMathHTML(latex);
      holder.style.display = 'inline-block';

      const scale = 3;
      const canvas = await domToCanvas(holder, {
        scale,
        backgroundColor: '#ffffff',
      });

      const img = document.createElement('img');
      img.setAttribute('src', canvas.toDataURL('image/png'));
      img.setAttribute('alt', latex);
      img.setAttribute('data-pdf-math', 'true');
      img.setAttribute('data-pdf-scale', String(scale));
      img.style.verticalAlign = 'middle';
      holder.replaceWith(img);
    }
  } finally {
    container.remove();
  }
}

/* ------------------------------------------------------------------ */
/*  Inline segments                                                    */
/* ------------------------------------------------------------------ */

/** A flat run of text sharing one style, an image, or a forced line break. */
interface TextSegment {
  text?: string;
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  strike?: boolean;
  subScript?: boolean;
  superScript?: boolean;
  /** `Courier New` for code; anything else resolves to Helvetica. */
  font?: string;
  /** Point size; defaults to the surrounding block size. */
  size?: number;
  /** Hex color without `#`, e.g. `FF0000`. */
  color?: string;
  highlight?: boolean;
  link?: string;
  image?: { src: string };
  lineBreak?: boolean;
}

interface SegmentStyle {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  strike?: boolean;
  subScript?: boolean;
  superScript?: boolean;
  font?: string;
  size?: number;
  color?: string;
  highlight?: boolean;
  link?: string;
}

/**
 * Flattens inline content into styled runs, mirroring the Word export's
 * `buildInline`: the same tags carry the same emphasis in both files. Block
 * tags (`p`, `div`) are transparent; `<br>` forces a line break; images are
 * lifted out as their own segments.
 */
function flattenInline(node: Node, style: SegmentStyle = {}): TextSegment[] {
  const out: TextSegment[] = [];

  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? '';
      if (text) out.push({ text, ...style });
      continue;
    }

    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const element = child as HTMLElement;
    const tag = element.tagName.toLowerCase();

    if (tag === 'br') {
      out.push({ lineBreak: true });
      continue;
    }

    if (tag === 'img') {
      const src = element.getAttribute('src') ?? '';
      if (src) out.push({ image: { src }, ...style });
      continue;
    }

    if (tag === 'a') {
      const href = element.getAttribute('href') ?? '';
      out.push(
        ...flattenInline(element, {
          ...style,
          link: href || undefined,
          underline: true,
          color: style.color ?? '0000FF',
        }),
      );
      continue;
    }

    out.push(...flattenInline(element, styleForTag(tag, style, element)));
  }

  return out;
}

function styleForTag(tag: string, style: SegmentStyle, element: HTMLElement): SegmentStyle {
  const next: SegmentStyle = { ...style };

  switch (tag) {
    case 'strong':
    case 'b':
      next.bold = true;
      break;
    case 'em':
    case 'i':
      next.italics = true;
      break;
    case 'u':
      next.underline = true;
      break;
    case 's':
    case 'strike':
    case 'del':
      next.strike = true;
      break;
    case 'sub':
      next.subScript = true;
      break;
    case 'sup':
      next.superScript = true;
      break;
    case 'code':
      next.font = 'Courier New';
      break;
    case 'mark':
      next.highlight = true;
      break;
    case 'span':
      applyInlineStyle(next, element.getAttribute('style') ?? '');
      break;
    default:
      break;
  }

  return next;
}

/** Reads the inline styles Tiptap emits on `<span>` elements. */
function applyInlineStyle(style: SegmentStyle, css: string): void {
  const size = css.match(/font-size\s*:\s*([\d.]+)\s*pt/i);
  if (size) style.size = Number(size[1]);

  const color = css.match(/color\s*:\s*(?:rgb\([^)]*\)|#[0-9a-f]{3,8}|[a-z]+)/i);
  if (color) {
    const hex = toHexColor(color[1]);
    if (hex) style.color = hex;
  }

  const font = css.match(/font-family\s*:\s*([^;]+)/i);
  if (font) {
    const name = font[1].trim().replace(/["']/g, '').split(',')[0].trim();
    if (name) style.font = name;
  }

  if (/font-weight\s*:\s*(bold|[6-9]00)/i.test(css)) style.bold = true;
  if (/font-style\s*:\s*italic/i.test(css)) style.italics = true;
  if (/text-decoration[^;]*underline/i.test(css)) style.underline = true;
}

function toHexColor(value: string): string | null {
  const trimmed = value.trim();
  const rgb = trimmed.match(/rgb\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\)/i);
  if (rgb) {
    return [rgb[1], rgb[2], rgb[3]]
      .map((part) => Number(part).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }
  const hex = trimmed.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const digits =
      hex[1].length === 3
        ? hex[1]
            .split('')
            .map((char) => char + char)
            .join('')
        : hex[1];
    return digits.toUpperCase();
  }
  const named: Record<string, string> = {
    black: '000000',
    white: 'FFFFFF',
    red: 'FF0000',
    green: '008000',
    blue: '0000FF',
    gray: '808080',
    grey: '808080',
  };
  return named[trimmed.toLowerCase()] ?? null;
}

/* ------------------------------------------------------------------ */
/*  Page layout                                                        */
/* ------------------------------------------------------------------ */

interface Word {
  text: string;
  seg: TextSegment;
  sizePt: number;
  width: number;
}

interface PdfLine {
  words: Word[];
  width: number;
  maxSizePt: number;
}

type TextAlign = 'left' | 'center' | 'right' | 'justify';

/**
 * Flow layout onto PDF pages with the export geometry.
 *
 * Long blocks (paragraphs, list items, table rows) flow across pages the way
 * Paged.js splits them, so content is never clipped; page *starts* still come
 * from the shared break set.
 */
class PdfLayout {
  private pdf: import('jspdf').jsPDF;
  private geometry: ExportPageGeometry;
  private headingSizes: Record<number, number>;
  private x0: number;
  private x1: number;
  private top: number;
  private bottom: number;
  private y: number;

  constructor(pdf: import('jspdf').jsPDF, geometry: ExportPageGeometry, headingSizes: Record<number, number>) {
    this.pdf = pdf;
    this.geometry = geometry;
    this.headingSizes = headingSizes;
    this.x0 = geometry.marginLeftMm;
    this.x1 = geometry.widthMm - geometry.marginRightMm;
    this.top = geometry.marginTopMm;
    this.bottom = geometry.heightMm - geometry.marginBottomMm;
    this.y = this.top;
  }

  get contentWidth(): number {
    return this.x1 - this.x0;
  }

  addPage(): void {
    const { widthMm, heightMm } = this.geometry;
    this.pdf.addPage(
      [widthMm, heightMm],
      widthMm > heightMm ? 'landscape' : 'portrait',
    );
    this.y = this.top;
  }

  /** Starts a fresh page unless the cursor is at the top of one already. */
  private ensureSpace(neededMm: number): void {
    if (this.y > this.top && this.y + neededMm > this.bottom) {
      this.addPage();
    }
  }

  /** Writes the page numbers once all content is laid out. */
  finish(): void {
    const { pdf, geometry } = this;
    const total = pdf.getNumberOfPages();
    const bandMm = Math.max(geometry.footerBandMm ?? 0, 6);
    const baseline = geometry.heightMm - geometry.marginBottomMm + bandMm / 2 + 1.2;

    for (let page = 1; page <= total; page += 1) {
      pdf.setPage(page);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(0, 0, 0);
      pdf.text(`${page} / ${total}`, geometry.widthMm / 2, baseline, {
        align: 'center',
      });
    }
  }

  /* ------------------------- block dispatch ------------------------ */

  renderBlock(element: HTMLElement): void {
    const tag = element.tagName.toLowerCase();

    if (/^h[1-6]$/.test(tag)) {
      this.heading(element, Number(tag.slice(1)));
      return;
    }
    if (tag === 'ul' || tag === 'ol') {
      this.list(element, tag === 'ol', 0);
      return;
    }
    if (tag === 'blockquote') {
      this.quote(element);
      return;
    }
    if (tag === 'pre') {
      this.code(element);
      return;
    }
    if (tag === 'hr') {
      this.rule();
      return;
    }
    if (tag === 'table') {
      this.table(element);
      return;
    }

    // A block wrapping a table (or nothing but images) is not plain text.
    const nestedTable = tag !== 'table' ? element.querySelector('table') : null;
    const images = Array.from(element.querySelectorAll('img'));
    const hasText = (element.textContent ?? '').trim().length > 0;

    if (nestedTable) {
      if (hasText) {
        this.paragraph(flattenInline(element), {
          sizePt: BODY_SIZE_PT,
          lineFactor: BODY_LINE_FACTOR,
          afterMm: BODY_AFTER_MM,
        });
      }
      element.querySelectorAll('table').forEach((table) => {
        if (table instanceof HTMLElement) this.table(table);
      });
      images.forEach((img) => this.imageFromElement(img));
      return;
    }

    if (images.length > 0 && !hasText) {
      images.forEach((img) => this.imageFromElement(img));
      return;
    }

    const segments = flattenInline(element);
    this.paragraph(segments, {
      sizePt: BODY_SIZE_PT,
      lineFactor: BODY_LINE_FACTOR,
      afterMm: BODY_AFTER_MM,
      align: readTextAlign(element) ?? 'left',
    });
    images.forEach((img) => this.imageFromElement(img));
  }

  private heading(element: HTMLElement, level: number): void {
    const sizePt = (this.headingSizes[level] ?? DEFAULT_HEADING_SIZES[level] ?? 24) / 2;
    if (this.y > this.top) this.y += HEADING_BEFORE_MM;
    this.ensureSpace(sizePt * PT_TO_MM * 1.2);
    this.paragraph(flattenInline(element), {
      sizePt,
      bold: true,
      lineFactor: 1.2,
      afterMm: HEADING_AFTER_MM,
      align: readTextAlign(element) ?? 'left',
    });
  }

  private quote(element: HTMLElement): void {
    this.paragraph(flattenInline(element), {
      sizePt: BODY_SIZE_PT,
      italics: true,
      lineFactor: BODY_LINE_FACTOR,
      afterMm: BODY_AFTER_MM,
      indentMm: (720 / 1440) * 25.4,
      align: readTextAlign(element) ?? 'left',
    });
  }

  private code(element: HTMLElement): void {
    const text = element.textContent ?? '';
    const sizePt = 10;
    const lineH = sizePt * PT_TO_MM * 1.2;
    if (this.y > this.top) this.y += 2;
    text.split('\n').forEach((line) => {
      this.ensureSpace(lineH);
      this.pdf.setFillColor(244, 244, 245);
      this.pdf.rect(this.x0, this.y, this.contentWidth, lineH, 'F');
      this.applyFont({ font: 'Courier New', size: sizePt });
      this.pdf.setTextColor(0, 0, 0);
      this.pdf.text(line || ' ', this.x0 + 2, this.y + sizePt * PT_TO_MM * 0.8);
      this.y += lineH;
    });
    this.y += 2;
  }

  private rule(): void {
    this.ensureSpace(6);
    this.y += 2;
    this.pdf.setDrawColor(0, 0, 0);
    this.pdf.setLineWidth(0.3);
    this.pdf.line(this.x0, this.y, this.x1, this.y);
    this.y += 3;
  }

  private list(element: HTMLElement, ordered: boolean, depth: number): void {
    const items = Array.from(element.children).filter(
      (child) => child.tagName.toLowerCase() === 'li',
    );
    const indentMm = LIST_INDENT_MM[Math.min(depth, LIST_INDENT_MM.length - 1)];
    const align = readTextAlign(element) ?? 'left';

    items.forEach((item, index) => {
      const marker = ordered ? `${index + 1}.` : '•';
      const nested = Array.from(item.children).find(
        (child) =>
          child instanceof HTMLElement &&
          (child.tagName.toLowerCase() === 'ul' || child.tagName.toLowerCase() === 'ol'),
      ) as HTMLElement | undefined;

      const clone = item.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('ul, ol').forEach((list) => list.remove());
      this.paragraph(flattenInline(clone), {
        sizePt: BODY_SIZE_PT,
        lineFactor: BODY_LINE_FACTOR,
        afterMm: ITEM_AFTER_MM,
        indentMm,
        align,
        marker,
        markerIndentMm: indentMm - 2,
      });

      if (nested) {
        this.list(nested, nested.tagName.toLowerCase() === 'ol', depth + 1);
      }
    });

    if (depth === 0) this.y += 1;
  }

  /* ------------------------- text flow ----------------------------- */

  private applyFont(seg: {
    bold?: boolean;
    italics?: boolean;
    font?: string;
    size?: number;
  }): void {
    const name = seg.font === 'Courier New' ? 'courier' : 'helvetica';
    const style = seg.bold && seg.italics ? 'bolditalic' : seg.bold ? 'bold' : seg.italics ? 'italic' : 'normal';
    this.pdf.setFont(name, style);
    this.pdf.setFontSize(seg.size ?? BODY_SIZE_PT);
  }

  private applyColor(hex?: string): void {
    const [r, g, b] = parseHexColor(hex);
    this.pdf.setTextColor(r, g, b);
  }

  private applyDrawColor(hex?: string): void {
    const [r, g, b] = parseHexColor(hex);
    this.pdf.setDrawColor(r, g, b);
  }

  private paragraph(
    segments: TextSegment[],
    options: {
      sizePt: number;
      bold?: boolean;
      italics?: boolean;
      lineFactor: number;
      afterMm: number;
      indentMm?: number;
      align?: TextAlign;
      marker?: string;
      markerIndentMm?: number;
    },
  ): void {
    const { sizePt, lineFactor, afterMm } = options;
    const indentMm = options.indentMm ?? 0;
    const align = options.align ?? 'left';
    const textX = this.x0 + indentMm;
    const avail = this.x1 - textX;

    // Block-level emphasis (headings, quotes) applies unless a run overrides it.
    const styled = segments.map((seg) => ({
      ...seg,
      bold: seg.bold ?? options.bold,
      italics: seg.italics ?? options.italics,
    }));
    const lines = this.wrapLines(styled, sizePt, avail);
    if (lines.length === 0) {
      this.y += afterMm;
      return;
    }

    if (options.marker) {
      const markerSizePt = sizePt;
      this.ensureSpace(markerSizePt * PT_TO_MM * lineFactor);
      this.applyFont({ bold: true, size: markerSizePt });
      this.pdf.setTextColor(0, 0, 0);
      const markerX = this.x0 + (options.markerIndentMm ?? Math.max(0, indentMm - 2));
      this.pdf.text(options.marker, markerX, this.y + markerSizePt * PT_TO_MM * lineFactor);
    }

    lines.forEach((line, lineIndex) => {
      const lineH = line.maxSizePt * PT_TO_MM * lineFactor;
      this.ensureSpace(lineH);
      const baseline = this.y + lineH;
      this.drawLine(line, { align: align === 'justify' && lineIndex === lines.length - 1 ? 'left' : align, x: textX, avail, y: baseline });
      this.y += lineH;
    });

    this.y += afterMm;
  }

  /** Greedy word wrap with the PDF's own font metrics. */
  private wrapLines(segments: TextSegment[], baseSizePt: number, availMm: number): PdfLine[] {
    const words: Word[] = [];

    const pushWord = (text: string, seg: TextSegment): void => {
      if (!text) return;
      const sizePt = this.wordSizePt(seg, baseSizePt);
      this.applyFont({ ...seg, size: sizePt });
      words.push({ text, seg, sizePt, width: this.pdf.getTextWidth(text) });
    };

    for (const seg of segments) {
      if (seg.lineBreak) {
        words.push({ text: '\n', seg, sizePt: baseSizePt, width: 0 });
        continue;
      }
      if (seg.image || seg.text === undefined) continue;
      // Split on whitespace but keep the break positions so forced breaks in
      // `<br>`-separated content survive.
      const parts = seg.text.split(/(\s+|\n)/g);
      for (const part of parts) {
        if (part === '\n') {
          words.push({ text: '\n', seg, sizePt: baseSizePt, width: 0 });
        } else if (part.trim().length > 0) {
          pushWord(part, seg);
        }
      }
    }

    const spaceWidth = (sizePt: number, seg: TextSegment): number => {
      this.applyFont({ ...seg, size: sizePt });
      return this.pdf.getTextWidth(' ');
    };

    const lines: PdfLine[] = [];
    let current: Word[] = [];
    let width = 0;
    let maxSize = baseSizePt;

    const flush = (): void => {
      if (current.length > 0) {
        lines.push({ words: current, width, maxSizePt: maxSize });
        current = [];
        width = 0;
        maxSize = baseSizePt;
      }
    };

    for (const word of words) {
      if (word.text === '\n') {
        flush();
        continue;
      }
      const gap = current.length === 0 ? 0 : spaceWidth(word.sizePt, word.seg);
      if (current.length > 0 && width + gap + word.width > availMm) {
        flush();
      }
      if (current.length > 0) width += spaceWidth(word.sizePt, word.seg);
      current.push(word);
      width += word.width;
      maxSize = Math.max(maxSize, word.sizePt);
    }
    flush();

    return lines;
  }

  private wordSizePt(seg: TextSegment, baseSizePt: number): number {
    let size = seg.size ?? baseSizePt;
    if (seg.subScript || seg.superScript) size *= 0.7;
    return size;
  }

  /** Draws one wrapped line word by word; underlines and links included. */
  private drawLine(
    line: PdfLine,
    layout: { align: TextAlign; x: number; avail: number; y: number },
  ): void {
    const { align, x, avail, y } = layout;
    const gaps = line.words.length - 1;

    let startX = x;
    let extraSpace = 0;
    if (align === 'center') {
      startX = x + (avail - line.width) / 2;
    } else if (align === 'right') {
      startX = x + (avail - line.width);
    } else if (align === 'justify' && gaps > 0) {
      extraSpace = Math.max(0, (avail - line.width) / gaps);
    }

    let cursor = startX;
    line.words.forEach((word, index) => {
      const { seg, sizePt } = word;
      const sizeMm = sizePt * PT_TO_MM;
      const dy = seg.superScript ? -sizeMm * 0.35 : seg.subScript ? sizeMm * 0.35 : 0;

      this.applyFont({ ...seg, size: sizePt });
      this.applyColor(seg.color);

      if (seg.highlight) {
        this.pdf.setFillColor(255, 255, 0);
        this.pdf.rect(cursor, y - sizeMm * 0.85, word.width, sizeMm * 1.05, 'F');
      }

      if (seg.link) {
        this.pdf.textWithLink(word.text, cursor, y + dy, { url: seg.link });
      } else {
        this.pdf.text(word.text, cursor, y + dy);
      }

      if (seg.underline || seg.link) {
        this.applyDrawColor(seg.color);
        this.pdf.setLineWidth(0.15);
        const uy = y + dy + sizeMm * 0.12;
        this.pdf.line(cursor, uy, cursor + word.width, uy);
      }
      if (seg.strike) {
        this.applyDrawColor(seg.color);
        this.pdf.setLineWidth(0.15);
        const sy = y + dy - sizeMm * 0.28;
        this.pdf.line(cursor, sy, cursor + word.width, sy);
      }

      cursor += word.width;
      if (index < line.words.length - 1) {
        this.applyFont({ ...word.seg, size: word.sizePt });
        cursor += this.pdf.getTextWidth(' ') + extraSpace;
      }
    });
  }

  /* ------------------------- tables -------------------------------- */

  private table(element: HTMLElement): void {
    const rows = Array.from(element.querySelectorAll('tr'));
    if (rows.length === 0) return;

    const cellsPerRow = rows.map((row) =>
      Array.from(row.children).filter((cell) => {
        const tag = cell.tagName.toLowerCase();
        return tag === 'td' || tag === 'th';
      }),
    );
    const spanOf = (cell: Element): number => {
      const span = Number(cell.getAttribute('colspan') ?? '1') || 1;
      return Math.max(1, Math.floor(span));
    };
    // `rowspan` is rare in lab reports; like the first revision of the Word
    // path, each cell occupies its own row.
    const colCount = Math.max(
      ...cellsPerRow.map((cells) => cells.reduce((sum, cell) => sum + spanOf(cell), 0)),
    );
    if (!Number.isFinite(colCount) || colCount <= 0) return;

    const colW = this.contentWidth / colCount;
    const sizePt = BODY_SIZE_PT;
    const lineH = sizePt * PT_TO_MM * BODY_LINE_FACTOR;
    const headerRowFlags = rows.map((row) => row.querySelector('th') !== null);

    if (this.y > this.top) this.y += 2;

    let headerLayouts: { lines: PdfLine[]; align: TextAlign; header: boolean }[] | null = null;

    rows.forEach((row, rowIndex) => {
      const cells = cellsPerRow[rowIndex];
      const spans = cells.map((cell) => spanOf(cell));
      const layouts = cells.map((cell, cellIndex) =>
        this.layoutCell(cell, spans[cellIndex] * colW),
      );
      if (rowIndex === 0 && headerRowFlags[0]) headerLayouts = layouts;

      const rowH =
        Math.max(1, ...layouts.map((layout) => layout.lines.length)) * lineH +
        2 * CELL_PAD_MM;

      if (this.y > this.top && this.y + rowH > this.bottom) {
        this.addPage();
        // Header rows repeat on every page, exactly like the Word tables.
        if (headerLayouts && rowIndex > 0) {
          const headerH =
            Math.max(1, ...headerLayouts.map((layout) => layout.lines.length)) * lineH +
            2 * CELL_PAD_MM;
          this.drawTableRow(
            cellsPerRow[0].map((cell) => spanOf(cell)),
            headerLayouts,
            headerH,
            colW,
            true,
          );
        }
      }

      this.drawTableRow(spans, layouts, rowH, colW, headerRowFlags[rowIndex]);
    });

    this.y += 2;
  }

  private layoutCell(
    cell: Element,
    widthMm: number,
  ): { lines: PdfLine[]; align: TextAlign; header: boolean } {
    const header = cell.tagName.toLowerCase() === 'th';
    // Images inside table cells are dropped from the PDF (the Word file keeps
    // them); tables in lab reports hold measured values, not figures.
    const segments = flattenInline(cell).map((seg) => ({
      ...seg,
      bold: seg.bold ?? (header ? true : undefined),
    }));
    const avail = Math.max(widthMm - 2 * CELL_PAD_MM, 10);
    return {
      lines: this.wrapLines(segments, BODY_SIZE_PT, avail),
      align: readTextAlign(cell) ?? 'left',
      header,
    };
  }

  private drawTableRow(
    spans: number[],
    layouts: { lines: PdfLine[]; align: TextAlign; header: boolean }[],
    rowH: number,
    colW: number,
    headerRow: boolean,
  ): void {
    let col = 0;

    spans.forEach((span, index) => {
      const width = span * colW;
      const x = this.x0 + col * colW;
      const layout = layouts[index];
      const header = headerRow || layout.header;

      if (header) {
        this.pdf.setFillColor(238, 238, 238);
        this.pdf.rect(x, this.y, width, rowH, 'F');
      }
      this.pdf.setDrawColor(0, 0, 0);
      this.pdf.setLineWidth(0.15);
      this.pdf.rect(x, this.y, width, rowH);

      let lineY = this.y + CELL_PAD_MM + BODY_SIZE_PT * PT_TO_MM * 0.72;
      const avail = Math.max(width - 2 * CELL_PAD_MM, 10);
      layout.lines.forEach((line) => {
        this.drawLine(line, { align: layout.align, x: x + CELL_PAD_MM, avail, y: lineY });
        lineY += line.maxSizePt * PT_TO_MM * BODY_LINE_FACTOR;
      });

      col += span;
    });

    this.y += rowH;
  }

  /* ------------------------- images -------------------------------- */

  private imageFromElement(img: HTMLImageElement): void {
    const src = img.getAttribute('src') ?? '';
    if (!src) return;
    const size = this.measureImage(img, src);
    if (!size) return;

    let { wMm, hMm } = size;
    const avail = this.contentWidth;
    if (wMm > avail) {
      const scale = avail / wMm;
      wMm = avail;
      hMm *= scale;
    }
    const pageH = this.bottom - this.top;
    if (hMm > pageH && hMm > 0) {
      const scale = pageH / hMm;
      hMm = pageH;
      wMm *= scale;
    }

    // Images stay whole: they move to the next page rather than splitting.
    this.ensureSpace(hMm);

    try {
      this.pdf.addImage(src, imageFormat(src), this.x0 + (avail - wMm) / 2, this.y, wMm, hMm);
    } catch {
      return;
    }
    this.y += hMm + 2;
  }

  /**
   * Image size in millimetres at 96 CSS dpi.
   *
   * Explicit `width`/`height` attributes (charts) win; otherwise the image is
   * decoded so math rasters captured at 3× scale lay out at their CSS size.
   * Remote URLs cannot be embedded and are skipped, like in the Word export.
   */
  private measureImage(img: HTMLImageElement, src: string): { wMm: number; hMm: number } | null {
    if (!src.startsWith('data:')) return null;

    const attrW = Number(img.getAttribute('width') ?? '0');
    const attrH = Number(img.getAttribute('height') ?? '0');
    if (attrW > 0 && attrH > 0) {
      return { wMm: (attrW * 25.4) / 96, hMm: (attrH * 25.4) / 96 };
    }

    try {
      const props = this.pdf.getImageProperties(src) as unknown as {
        width: number;
        height: number;
      };
      if (!props || !(props.width > 0) || !(props.height > 0)) return null;
      const scale = Number(img.getAttribute('data-pdf-scale') ?? '1') || 1;
      return {
        wMm: ((props.width / scale) * 25.4) / 96,
        hMm: ((props.height / scale) * 25.4) / 96,
      };
    } catch {
      return null;
    }
  }
}

/** jsPDF image format from a data-URL mime type. */
function imageFormat(src: string): 'PNG' | 'JPEG' {
  const match = src.match(/^data:image\/([a-zA-Z0-9+.-]+);/);
  const mime = (match?.[1] ?? '').toLowerCase();
  if (mime === 'jpeg' || mime === 'jpg') return 'JPEG';
  return 'PNG';
}

function parseHexColor(hex?: string): [number, number, number] {
  const clean = (hex ?? '').replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((char) => char + char)
          .join('')
      : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((part) => !Number.isFinite(part))) return [0, 0, 0];
  return [r, g, b];
}
