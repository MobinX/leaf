/**
 * Printing with real page breaks.
 *
 * The browser's own print dialog produces a vector PDF (selectable text, crisp
 * type) but it can only break where the document says so. So before printing,
 * the document is laid out with Paged.js and the resulting pages are swapped
 * in for the live editor — the print output then has genuine, content-aware
 * page breaks instead of the virtual dividers the editor draws.
 */

import type { Editor } from '@tiptap/react';

import type { PageSettings } from '@/lib/pageSize';

import { buildExportGeometry, captureChartImages } from './index';
import { disposePaginatedDocument, paginateDocument } from './paginate';
import { prepareExport, renderMathPlaceholders, serializeBody } from './prepare';

export interface PaginatedPrintOptions {
  editor: Editor;
  pageSettings: PageSettings;
}

/**
 * Prints the document with content-aware page breaks.
 *
 * Falls back to a plain print if the pagination cannot be produced.
 */
export async function printWithPagination(options: PaginatedPrintOptions): Promise<void> {
  const { editor, pageSettings } = options;

  const printableArea = document.getElementById('printableArea');
  if (!printableArea) {
    window.print();
    return;
  }

  let paginated;
  try {
    const geometry = buildExportGeometry(editor, pageSettings);
    const charts = captureChartImages(editor);
    const prepared = prepareExport(editor.getHTML(), charts);
    renderMathPlaceholders(prepared.body);

    paginated = await paginateDocument({
      html: serializeBody(prepared.body),
      geometry,
      pageNumbers: true,
    });
  } catch {
    // If the layout engine fails there is still a usable document on screen.
    window.print();
    return;
  }

  const liveEditor = printableArea.querySelector<HTMLElement>('.tiptap');
  const previousDisplay = liveEditor?.style.display;
  if (liveEditor) liveEditor.style.display = 'none';

  paginated.container.style.cssText = [
    'position: static',
    'left: auto',
    'top: auto',
    'width: auto',
    'height: auto',
    'overflow: visible',
    'pointer-events: none',
  ].join('; ');

  printableArea.appendChild(paginated.container);

  // Let the browser lay the pages out before the print dialog opens.
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  try {
    window.print();
  } finally {
    paginated.container.remove();
    disposePaginatedDocument(paginated);
    if (liveEditor) liveEditor.style.display = previousDisplay ?? '';
  }
}
