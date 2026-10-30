/**
 * Microsoft Word (.docx) export.
 *
 * The document is rebuilt with the `docx` package:
 *
 *   • the section carries the **exact** sheet size and margins, so Word
 *     paginates on the same geometry the preview uses;
 *   • tables become real Word tables (borders, header rows that repeat on
 *     every page, merged cells);
 *   • equations become **native OMML**, i.e. editable Word equation objects
 *     rather than pictures — Google Docs converts those into its own
 *     equation objects when the .docx is opened there;
 *   • the page breaks computed by the paginator are written into the file, so
 *     the content lands on the same pages as in the PDF.
 */

import type { FileChild, ParagraphChild } from 'docx';

import { latexToOMML } from './math';
import { MATH_ATTRIBUTE } from './prepare';
import type { ExportPageGeometry } from './styles';

export interface DocxExportOptions {
  /** The prepared body element. */
  body: HTMLElement;
  geometry: ExportPageGeometry;
  /** Indices of the blocks that start a new page. */
  pageBreakBlocks?: Set<number>;
  /** Heading sizes in half-points, measured from the live editor. */
  headingSizes?: Record<number, number>;
  /** Document title, used for the file name and the document properties. */
  title?: string;
}

/** Heading sizes in half-points, matching the editor's own CSS. */
export const DEFAULT_HEADING_SIZES: Record<number, number> = {
  1: 64, // 32pt
  2: 48, // 24pt
  3: 36, // 18pt
  4: 28, // 14pt
  5: 24, // 12pt
  6: 22, // 11pt
};

/** Inline formatting carried down the element tree. */
interface RunStyle {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  strike?: boolean;
  subScript?: boolean;
  superScript?: boolean;
  size?: number;
  color?: string;
  font?: string;
  highlight?: string;
}

type DocxModule = typeof import('docx');

/**
 * Builds the .docx file.
 */
export async function exportToDocx(options: DocxExportOptions): Promise<Blob> {
  const docx = (await import('docx')) as DocxModule;

  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    AlignmentType,
    PageBreak,
    Footer,
    PageNumber,
    LevelFormat,
  } = docx;

  const { body, geometry, pageBreakBlocks, title } = options;
  const headingSizes = { ...DEFAULT_HEADING_SIZES, ...(options.headingSizes ?? {}) };

  const contentWidthPx = mmToPx(
    geometry.widthMm - geometry.marginLeftMm - geometry.marginRightMm,
  );

  const children: FileChild[] = [];

  const blocks = Array.from(body.children) as HTMLElement[];

  for (const block of blocks) {
    const index = Number(block.getAttribute('data-export-block') ?? -1);
    const startsPage = index >= 0 && pageBreakBlocks?.has(index);

    const elements = await buildBlock(docx, block, headingSizes, contentWidthPx);

    if (startsPage) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    children.push(...elements);
  }

  const document = new Document({
    title: title ?? 'Document',
    creator: 'Leaf',
    description: 'Exported from Leaf',
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 24 },
          paragraph: { spacing: { after: 120, line: 300 } },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: 'leaf-bullet',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '•',
              alignment: AlignmentType.START,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
            {
              level: 1,
              format: LevelFormat.BULLET,
              text: '◦',
              alignment: AlignmentType.START,
              style: { paragraph: { indent: { left: 1440, hanging: 360 } } },
            },
          ],
        },
        {
          reference: 'leaf-number',
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.START,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
            {
              level: 1,
              format: LevelFormat.LOWER_LETTER,
              text: '%2.',
              alignment: AlignmentType.START,
              style: { paragraph: { indent: { left: 1440, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: toTwips(geometry.widthMm),
              height: toTwips(geometry.heightMm),
              orientation:
                geometry.widthMm > geometry.heightMm ? 'landscape' : 'portrait',
            },
            margin: {
              top: toTwips(geometry.marginTopMm),
              right: toTwips(geometry.marginRightMm),
              bottom: toTwips(geometry.marginBottomMm),
              left: toTwips(geometry.marginLeftMm),
              header: toTwips(10),
              footer: toTwips(10),
              gutter: 0,
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES],
                    size: 18,
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Packer.toBlob(document);
}

/* ------------------------------------------------------------------ */
/*  Block level                                                        */
/* ------------------------------------------------------------------ */

async function buildBlock(
  docx: DocxModule,
  element: HTMLElement,
  headingSizes: Record<number, number>,
  contentWidthPx: number,
): Promise<FileChild[]> {
  const { Paragraph, AlignmentType, HeadingLevel, ShadingType } = docx;
  const tag = element.tagName.toLowerCase();

  if (/^h[1-6]$/.test(tag)) {
    const level = Number(tag.slice(1));
    const heading = HeadingLevel[
      `HEADING_${Math.min(level, 6)}` as keyof typeof HeadingLevel
    ] as (typeof HeadingLevel)[keyof typeof HeadingLevel];

    const children = await buildInline(
      docx,
      element,
      { bold: true, size: headingSizes[level] },
      contentWidthPx,
    );

    return [
      new Paragraph({
        heading,
        children,
        spacing: { before: 240, after: 120 },
      }),
    ];
  }

  if (tag === 'ul' || tag === 'ol') {
    const reference = tag === 'ol' ? 'leaf-number' : 'leaf-bullet';
    const items = Array.from(element.children).filter(
      (child) => child.tagName.toLowerCase() === 'li',
    );

    const paragraphs: FileChild[] = [];

    for (const item of items) {
      const level = Math.min(getListDepth(item), 1);
      const children = await buildInline(docx, item, {}, contentWidthPx);

      paragraphs.push(
        new Paragraph({
          numbering: { reference, level },
          children,
          spacing: { after: 60 },
        }),
      );

      // A list item may hold a nested list — it follows as its own items.
      const nested = Array.from(item.children).find(
        (child) =>
          child.tagName.toLowerCase() === 'ul' || child.tagName.toLowerCase() === 'ol',
      );
      if (nested) {
        paragraphs.push(
          ...(await buildBlock(docx, nested as HTMLElement, headingSizes, contentWidthPx)),
        );
      }
    }

    return paragraphs;
  }

  if (tag === 'blockquote') {
    const children = await buildInline(docx, element, { italics: true }, contentWidthPx);
    return [new Paragraph({ indent: { left: 720 }, children })];
  }

  if (tag === 'pre') {
    return [
      new Paragraph({
        shading: { type: ShadingType.CLEAR, fill: 'F4F4F5' },
        children: [
          new (docx.TextRun)({
            text: element.textContent ?? '',
            font: 'Courier New',
            size: 20,
          }),
        ],
      }),
    ];
  }

  if (tag === 'hr') {
    return [new Paragraph({ children: [] })];
  }

  if (tag === 'table') {
    const table = await buildTable(docx, element, contentWidthPx);
    return table ? [table] : [];
  }

  // A block that is nothing but an image (a chart, for instance).
  const onlyImage = element.querySelector('img');
  if (onlyImage && !element.textContent?.trim()) {
    const image = buildImage(docx, onlyImage, contentWidthPx);
    return image
      ? [new Paragraph({ children: [image], alignment: AlignmentType.CENTER })]
      : [];
  }

  const children = await buildInline(docx, element, {}, contentWidthPx);
  return [new Paragraph({ children, alignment: readAlignment(element) })];
}

function getListDepth(item: Element): number {
  let depth = 0;
  let parent = item.parentElement;
  while (parent) {
    const tag = parent.tagName.toLowerCase();
    if (tag === 'ul' || tag === 'ol') depth += 1;
    parent = parent.parentElement;
  }
  return Math.max(0, depth - 1);
}

/* ------------------------------------------------------------------ */
/*  Tables                                                             */
/* ------------------------------------------------------------------ */

async function buildTable(
  docx: DocxModule,
  element: HTMLElement,
  contentWidthPx: number,
): Promise<FileChild | null> {
  const {
    Table,
    TableRow,
    TableCell,
    Paragraph,
    WidthType,
    BorderStyle,
    TableLayoutType,
    ShadingType,
  } = docx;

  const border = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
  const borders = {
    top: border,
    bottom: border,
    left: border,
    right: border,
    insideHorizontal: border,
    insideVertical: border,
  };

  const rows = Array.from(element.querySelectorAll('tr'));
  if (rows.length === 0) return null;

  const docxRows = [];

  for (const row of rows) {
    const isHeaderRow = row.querySelector('th') !== null;
    const cells = Array.from(row.children).filter((cell) =>
      ['td', 'th'].includes(cell.tagName.toLowerCase()),
    );

    const docxCells = [];

    for (const cell of cells) {
      const isHeaderCell = cell.tagName.toLowerCase() === 'th';
      const columnSpan = Number(cell.getAttribute('colspan') ?? '1') || 1;
      const rowSpan = Number(cell.getAttribute('rowspan') ?? '1') || 1;

      const children = await buildInline(docx, cell, {}, contentWidthPx);

      docxCells.push(
        new TableCell({
          children: [
            new Paragraph({ children, alignment: readAlignment(cell) }),
          ],
          columnSpan: columnSpan > 1 ? columnSpan : undefined,
          rowSpan: rowSpan > 1 ? rowSpan : undefined,
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
          shading: isHeaderCell
            ? { type: ShadingType.CLEAR, fill: 'EEEEEE', color: 'auto' }
            : undefined,
        }),
      );
    }

    docxRows.push(new TableRow({ children: docxCells, tableHeader: isHeaderRow }));
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.AUTOFIT,
    borders,
    rows: docxRows,
  });
}

/* ------------------------------------------------------------------ */
/*  Inline content                                                     */
/* ------------------------------------------------------------------ */

async function buildInline(
  docx: DocxModule,
  node: Node,
  style: RunStyle,
  contentWidthPx: number,
): Promise<ParagraphChild[]> {
  const { TextRun, ExternalHyperlink, UnderlineType } = docx;
  const out: ParagraphChild[] = [];

  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? '';
      if (text) out.push(new TextRun({ text, ...toRunOptions(style, UnderlineType.SINGLE) }));
      continue;
    }

    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const element = child as HTMLElement;
    const tag = element.tagName.toLowerCase();

    // Equations → native Word math.
    if (element.hasAttribute(MATH_ATTRIBUTE)) {
      const latex = element.getAttribute(MATH_ATTRIBUTE) ?? '';
      const omml = latexToOMML(latex);
      if (omml) {
        out.push(ommlComponent(docx, omml));
      } else {
        out.push(new TextRun({ text: latex, ...toRunOptions(style, UnderlineType.SINGLE) }));
      }
      continue;
    }

    if (tag === 'br') {
      out.push(new TextRun({ text: '', break: 1 }));
      continue;
    }

    if (tag === 'img') {
      const image = buildImage(docx, element, contentWidthPx);
      if (image) out.push(image);
      continue;
    }

    if (tag === 'a') {
      const href = element.getAttribute('href');
      const linkChildren = await buildInline(docx, element, style, contentWidthPx);
      if (href && linkChildren.length > 0) {
        out.push(
          new ExternalHyperlink({ children: linkChildren, link: href }),
        );
      } else {
        out.push(...linkChildren);
      }
      continue;
    }

    out.push(
      ...(await buildInline(
        docx,
        element,
        styleForTag(docx, tag, style, element),
        contentWidthPx,
      )),
    );
  }

  return out;
}

function styleForTag(
  docx: DocxModule,
  tag: string,
  style: RunStyle,
  element: HTMLElement,
): RunStyle {
  const next: RunStyle = { ...style };

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
      next.highlight = 'yellow';
      break;
    case 'span':
      applyInlineStyle(next, element.getAttribute('style') ?? '');
      break;
    default:
      break;
  }

  void docx;
  return next;
}

/** Reads the inline styles Tiptap emits on `<span>` elements. */
function applyInlineStyle(style: RunStyle, css: string): void {
  const size = css.match(/font-size\s*:\s*([\d.]+)\s*pt/i);
  if (size) style.size = Math.round(Number(size[1]) * 2);

  const color = css.match(/color\s*:\s*(?:rgb\([^)]*\)|#[0-9a-f]{3,8}|[a-z]+)/i);
  if (color) {
    const hex = toHexColor(color[1]);
    if (hex) style.color = hex;
  }

  const font = css.match(/font-family\s*:\s*([^;]+)/i);
  if (font) style.font = font[1].trim().replace(/["']/g, '').split(',')[0].trim();

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

function toRunOptions(
  style: RunStyle,
  underlineType: string,
): Record<string, unknown> {
  const options: Record<string, unknown> = {};
  if (style.bold) options.bold = true;
  if (style.italics) options.italics = true;
  if (style.underline) options.underline = underlineType;
  if (style.strike) options.strike = true;
  if (style.subScript) options.subScript = true;
  if (style.superScript) options.superScript = true;
  if (style.size) options.size = style.size;
  if (style.color) options.color = style.color;
  if (style.font) options.font = style.font;
  if (style.highlight) options.highlight = style.highlight;
  return options;
}

function readAlignment(
  element: Element,
): 'left' | 'center' | 'right' | 'both' | undefined {
  const style = (element.getAttribute('style') ?? '').toLowerCase();
  const match = style.match(/text-align\s*:\s*(left|center|right|justify)/);
  const value = match?.[1];
  if (value === 'justify') return 'both';
  if (value === 'left' || value === 'center' || value === 'right') return value;
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  OMML & images                                                      */
/* ------------------------------------------------------------------ */

/**
 * Turns an OMML string into a paragraph child.
 *
 * `ImportedXmlComponent.fromXmlString` parses the markup but loses the root
 * element name, so the parsed root is unwrapped and used directly.
 */
function ommlComponent(docx: DocxModule, omml: string): ParagraphChild {
  const { ImportedXmlComponent, XmlComponent } = docx;

  const parsed = ImportedXmlComponent.fromXmlString(omml);
  const root = (parsed as unknown as { root: unknown[] }).root?.[0];

  if (root instanceof XmlComponent) {
    return root as unknown as ParagraphChild;
  }
  return parsed as unknown as ParagraphChild;
}

/** Builds an image run from a data URL. */
function buildImage(
  docx: DocxModule,
  element: Element,
  contentWidthPx: number,
): ParagraphChild | null {
  const { ImageRun } = docx;
  const src = element.getAttribute('src') ?? '';
  if (!src) return null;

  const data = decodeDataUrl(src);
  if (!data) return null;

  const widthAttr = Number(element.getAttribute('width') ?? '0');
  const heightAttr = Number(element.getAttribute('height') ?? '0');

  let width = widthAttr || contentWidthPx;
  let height = heightAttr || Math.round(width * 0.6);

  if (width > contentWidthPx) {
    const ratio = height / width;
    width = contentWidthPx;
    height = Math.round(width * ratio);
  }

  try {
    return new ImageRun({
      type: 'png',
      data,
      transformation: {
        width: Math.max(1, Math.round(width)),
        height: Math.max(1, Math.round(height)),
      },
    }) as unknown as ParagraphChild;
  } catch {
    return null;
  }
}

function decodeDataUrl(src: string): Uint8Array | null {
  if (!src.startsWith('data:')) return null;
  const comma = src.indexOf(',');
  if (comma < 0) return null;

  const meta = src.slice(0, comma);
  const payload = src.slice(comma + 1);

  try {
    if (meta.includes(';base64')) {
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      return bytes;
    }
    return new TextEncoder().encode(decodeURIComponent(payload));
  } catch {
    return null;
  }
}

function mmToPx(mm: number): number {
  return (mm * 96) / 25.4;
}

/**
 * Millimetres → twips (1/1440 inch).
 *
 * Rounded rather than truncated, so A4 comes out as the 11906 × 16838 twips
 * Word itself uses.
 */
function toTwips(mm: number): number {
  return Math.round((mm * 1440) / 25.4);
}
