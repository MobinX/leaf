/**
 * Google Docs export.
 *
 * Google Docs has no document format of its own, so there are two ways in:
 *
 *   1. **File → Import → HTML** — the exporter writes a standalone HTML file
 *      with the document's typography baked in. Tables, alignment, fonts and
 *      images survive the import.
 *   2. **Copy & paste** — the same markup is placed on the clipboard as
 *      `text/html`, so pasting into a Google Doc keeps the formatting.
 *
 * Equations are rasterised to PNG for this path: Google Docs' HTML importer
 * does not read MathML, but it does import images perfectly. (Exporting the
 * .docx instead gives you *native* Google Docs equations.)
 */

import { renderMathHTML } from './math';
import { MATH_ATTRIBUTE } from './prepare';
import { buildStandaloneHTML } from './prepare';

export interface GoogleDocsExportOptions {
  /** The prepared body element. */
  body: HTMLElement;
  title: string;
}

/**
 * The stylesheet baked into the exported HTML. It mirrors the editor's own
 * rules so the imported document looks like the one on screen.
 */
export const GOOGLE_DOCS_STYLES = `
body {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 12pt;
  line-height: 1.5;
  color: #000000;
  background: #ffffff;
  margin: 0;
  padding: 0;
}

h1 { font-size: 32pt; font-weight: 800; margin: 20pt 0 10pt; }
h2 { font-size: 24pt; font-weight: 700; margin: 18pt 0 8pt; }
h3 { font-size: 18pt; font-weight: 700; margin: 16pt 0 8pt; }
h4 { font-size: 14pt; font-weight: 700; margin: 14pt 0 6pt; }
h5 { font-size: 12pt; font-weight: 700; margin: 12pt 0 6pt; }
h6 { font-size: 11pt; font-weight: 700; margin: 12pt 0 6pt; }

p { margin: 0 0 10pt; }

table {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
  table-layout: fixed;
}

th, td {
  border: 1px solid #000000;
  padding: 6pt;
  vertical-align: top;
}

th { background-color: #eeeeee; font-weight: bold; }

ul { list-style-type: disc; margin: 10pt 0; padding-left: 30pt; }
ol { list-style-type: decimal; margin: 10pt 0; padding-left: 30pt; }
li { margin: 0 0 4pt; }

blockquote {
  border-left: 5px solid #000000;
  padding-left: 15pt;
  margin: 15pt 0;
  font-style: italic;
  color: #444444;
}

pre {
  background: #f4f4f5;
  padding: 8pt;
  white-space: pre-wrap;
  font-family: Consolas, "Courier New", monospace;
  font-size: 10pt;
}

img { max-width: 100%; height: auto; }

.export-math img {
  vertical-align: middle;
}
`;

/**
 * Builds the standalone HTML document used for the Google Docs import.
 */
export async function buildGoogleDocsHTML(options: GoogleDocsExportOptions): Promise<string> {
  const { body, title } = options;

  const root = body.cloneNode(true) as HTMLElement;
  await rasterizeMath(root);

  return buildStandaloneHTML({
    title,
    bodyHTML: root.innerHTML,
    style: GOOGLE_DOCS_STYLES,
  });
}

/** Downloads the document as an HTML file Google Docs can import. */
export async function exportForGoogleDocs(options: GoogleDocsExportOptions): Promise<Blob> {
  const html = await buildGoogleDocsHTML(options);
  return new Blob([html], { type: 'text/html;charset=utf-8' });
}

/**
 * Copies the document to the clipboard as rich HTML, ready to be pasted
 * straight into a Google Doc.
 */
export async function copyForGoogleDocs(options: GoogleDocsExportOptions): Promise<void> {
  const { body, title } = options;

  const root = body.cloneNode(true) as HTMLElement;
  await rasterizeMath(root);

  const html = buildStandaloneHTML({
    title,
    bodyHTML: root.innerHTML,
    style: GOOGLE_DOCS_STYLES,
  });

  const plain = root.textContent ?? '';

  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
    throw new Error('This browser cannot copy rich text to the clipboard.');
  }

  await navigator.clipboard.write([
    new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([plain], { type: 'text/plain' }),
    }),
  ]);
}

/**
 * Renders every equation placeholder as a PNG.
 *
 * The node has to be in the document while it is captured, so it is attached
 * to a hidden container for the duration of the capture.
 */
async function rasterizeMath(root: HTMLElement): Promise<void> {
  const holders = Array.from(root.querySelectorAll<HTMLElement>('[data-export-math]'));
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

  // The equations have to be laid out in the document to be captured, so the
  // prepared body is attached for the duration of the capture.
  container.appendChild(root);
  document.body.appendChild(container);

  try {
    for (const holder of holders) {
      const latex = holder.getAttribute(MATH_ATTRIBUTE) ?? '';

      holder.innerHTML = renderMathHTML(latex);
      holder.style.display = 'inline-block';

      // The canvas is serialised here rather than through `domToPng`,
      // whose DPI handling rewrites the PNG header.
      const canvas = await domToCanvas(holder, {
        scale: 3,
        backgroundColor: '#ffffff',
      });
      const image = canvas.toDataURL('image/png');

      const img = document.createElement('img');
      img.setAttribute('src', image);
      img.setAttribute('alt', latex);
      img.style.verticalAlign = 'middle';
      holder.replaceWith(img);
    }
  } finally {
    container.remove();
  }
}
