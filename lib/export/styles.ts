/**
 * The stylesheet used by every exporter.
 *
 * The export root carries the same classes as the live editor
 * (`ProseMirror tiptap`), so the app's own typography rules in
 * `app/globals.css` apply unchanged — headings, tables, lists, blockquotes
 * and text alignment look exactly like they do on screen.
 *
 * On top of that this file:
 *
 *   • forces a light, print-like palette (an exported document is black on
 *     white regardless of the app theme);
 *   • mirrors the `rm-with-pagination` overrides the editor gets from the
 *     pagination plugin, so tables keep the layout the user sees.
 */

export interface ExportPageGeometry {
  /** Sheet width in millimetres. */
  widthMm: number;
  /** Sheet height in millimetres. */
  heightMm: number;
  marginTopMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  marginRightMm: number;
  /**
   * Height of the band the pagination plugin reserves for its page-number
   * footer. It sits inside the bottom margin and is where the exported page
   * number is drawn.
   */
  footerBandMm?: number;
}

/** The classes the export root needs to pick up the editor's typography. */
export const EXPORT_ROOT_CLASS = 'ProseMirror tiptap export-root';

/**
 * Base rules for the export root. Injected as a plain stylesheet, so it has
 * to out-specify `app/globals.css` — hence the doubled class selectors.
 */
export const EXPORT_BASE_STYLES = `
.export-root.ProseMirror,
.export-root.tiptap {
  --fg-editor-page: #000000;
  --bg-editor-page: #ffffff;
  --border-table: #000000;
  --bg-table-header: #eeeeee;
  --fg-table: #000000;
  --fg-placeholder: transparent;

  background: #ffffff !important;
  color: #000000 !important;
  margin: 0 !important;
  padding: 0 !important;
  box-shadow: none !important;
  border: none !important;
}

/* Mirror the pagination plugin's table overrides so exported tables keep the
   layout the user sees in the editor. */
.export-root.ProseMirror table,
.export-root.tiptap table {
  display: table !important;
  width: auto !important;
  table-layout: fixed !important;
  border-collapse: collapse !important;
}

.export-root.ProseMirror table > tr,
.export-root.tiptap table > tr {
  display: table-row !important;
}

.export-root.ProseMirror table tbody,
.export-root.tiptap table tbody {
  display: table-row-group !important;
  max-height: none !important;
  overflow: visible !important;
}

.export-root.ProseMirror table tbody > tr,
.export-root.tiptap table tbody > tr {
  display: table-row !important;
}

.export-root.ProseMirror table tr td,
.export-root.ProseMirror table tr th,
.export-root.tiptap table tr td,
.export-root.tiptap table tr th {
  word-break: break-all;
}

/* Equations and charts are replaced by their export representation. */
.export-root .export-math {
  display: inline-block;
  vertical-align: middle;
  line-height: normal;
}

.export-root img {
  max-width: 100%;
  height: auto;
}

/* Keep a table from being torn in half by a page break when the browser
   supports it; Paged.js handles the same case for the paginated output. */
.export-root.ProseMirror table,
.export-root.tiptap table {
  break-inside: auto;
}

.export-root.ProseMirror tr,
.export-root.tiptap tr {
  break-inside: avoid;
}
`;

/**
 * The `@page` rules handed to Paged.js. The margins define the printable box
 * and therefore where the real page breaks fall.
 */
export function buildPageCSS(
  geometry: ExportPageGeometry,
  options: { pageNumbers?: boolean } = {},
): string {
  const pageNumbers = options.pageNumbers !== false;

  return `
@page {
  size: ${round(geometry.widthMm)}mm ${round(geometry.heightMm)}mm;
  margin: ${round(geometry.marginTopMm)}mm ${round(geometry.marginRightMm)}mm ${round(
    geometry.marginBottomMm,
  )}mm ${round(geometry.marginLeftMm)}mm;
${
  pageNumbers
    ? `
  @bottom-center {
    content: counter(page);
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 9pt;
    color: #000000;
  }
`
    : ''
}
}
`;
}

/**
 * The print stylesheet used by the browser's own "Save as PDF" path. It
 * mirrors the geometry so the printed sheet matches the exported file.
 */
export function buildPrintCSS(geometry: ExportPageGeometry): string {
  return `
@page {
  size: ${round(geometry.widthMm)}mm ${round(geometry.heightMm)}mm;
  margin: ${round(geometry.marginTopMm)}mm ${round(geometry.marginRightMm)}mm ${round(
    geometry.marginBottomMm,
  )}mm ${round(geometry.marginLeftMm)}mm;
}
`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
