/**
 * Export orchestrator.
 *
 * One pipeline feeds every format:
 *
 *   editor HTML
 *     → prepared DOM (equations and charts turned into placeholders/images)
 *     → content-aware pagination with Paged.js
 *     → PDF | DOCX | Google Docs
 *
 * The pagination result is shared: the PDF is built from the very pages that
 * were laid out, and the page breaks are written into the .docx, so the
 * exported files line up with the document.
 */

import type { Editor } from '@tiptap/react';

import { pxToMm, type PageSettings } from '@/lib/pageSize';

import { exportToDocx } from './docx';
import { copyForGoogleDocs, exportForGoogleDocs } from './googleDocs';
import { disposePaginatedDocument, paginateDocument } from './paginate';
import { computePageBreakBlocks, type PaginatedPage } from './pageMap';
import { exportToPDF } from './pdf';

import {
  prepareExport,
  renderMathPlaceholders,
  serializeBody,
  type ChartImage,
} from './prepare';
import type { ExportPageGeometry } from './styles';

export type ExportFormat = 'pdf' | 'docx' | 'google-docs' | 'copy-google-docs';

export { computePageBreakBlocks };
export type { PaginatedPage };

export interface ExportRequest {
  editor: Editor;
  pageSettings: PageSettings;
  format: ExportFormat;
  /** Base file name (without extension). */
  fileName: string;
  onProgress?: (message: string) => void;
}

export interface ExportResult {
  /** The file to save — `null` for the clipboard format. */
  blob: Blob | null;
  fileName: string;
  mimeType: string;
  /** The page breakdown the export was built from. */
  pages: PaginatedPage[];
  totalPages: number;
}

/**
 * Runs an export.
 */
export async function exportDocument(request: ExportRequest): Promise<ExportResult> {
  const { editor, pageSettings, format, fileName, onProgress } = request;

  onProgress?.('Preparing document…');

  const geometry = buildExportGeometry(editor, pageSettings);
  const charts = captureChartImages(editor);
  const prepared = prepareExport(editor.getHTML(), charts);

  // The PDF renders the equations with KaTeX, exactly like the editor does.
  renderMathPlaceholders(prepared.body);

  onProgress?.('Laying out pages…');

  const paginated = await paginateDocument({
    html: serializeBody(prepared.body),
    geometry,
    pageNumbers: true,
  });

  try {
    switch (format) {
      case 'pdf': {
        onProgress?.('Rendering PDF…');
        const blob = await exportToPDF({ paginated, geometry });
        return {
          blob,
          fileName: `${fileName}.pdf`,
          mimeType: 'application/pdf',
          pages: paginated.pages,
          totalPages: paginated.totalPages,
        };
      }

      case 'docx': {
        onProgress?.('Building Word document…');
        const blob = await exportToDocx({
          body: prepared.body,
          geometry,
          pageBreakBlocks: computePageBreakBlocks(paginated.pages),
          title: fileName,
        });
        return {
          blob,
          fileName: `${fileName}.docx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          pages: paginated.pages,
          totalPages: paginated.totalPages,
        };
      }

      case 'google-docs': {
        onProgress?.('Building Google Docs file…');
        const blob = await exportForGoogleDocs({ body: prepared.body, title: fileName });
        return {
          blob,
          fileName: `${fileName}.html`,
          mimeType: 'text/html;charset=utf-8',
          pages: paginated.pages,
          totalPages: paginated.totalPages,
        };
      }

      case 'copy-google-docs': {
        onProgress?.('Copying to clipboard…');
        await copyForGoogleDocs({ body: prepared.body, title: fileName });
        return {
          blob: null,
          fileName: fileName,
          mimeType: 'text/html',
          pages: paginated.pages,
          totalPages: paginated.totalPages,
        };
      }

      default: {
        throw new Error(`Unknown export format: ${format}`);
      }
    }
  } finally {
    disposePaginatedDocument(paginated);
  }
}

/**
 * The page box the export has to reproduce.
 *
 * The margins come from the page settings, plus the band the pagination
 * plugin reserves for its footer (the page number), so the exported sheet
 * matches the preview exactly.
 */
export function buildExportGeometry(
  editor: Editor,
  pageSettings: PageSettings,
): ExportPageGeometry {
  const widthMm = pageSettings.widthMm;
  const heightMm = pageSettings.heightMm;

  const footerBandMm = pxToMm(measureFooterBand(editor));

  return {
    widthMm,
    heightMm,
    marginTopMm: pageSettings.margins.topMm,
    marginBottomMm: pageSettings.margins.bottomMm + footerBandMm,
    marginLeftMm: pageSettings.margins.leftMm,
    marginRightMm: pageSettings.margins.rightMm,
    footerBandMm,
  };
}

/**
 * The height of the band the pagination plugin reserves for its footer.
 *
 * The plugin reports the measured footer height in its storage; the DOM is
 * used as a fallback.
 */
function measureFooterBand(editor: Editor): number {
  const storage = (editor.storage as unknown as {
    PaginationPlus?: { footerHeight?: Map<number, number> };
  }).PaginationPlus;

  const stored = storage?.footerHeight?.get(0);
  if (typeof stored === 'number' && stored > 0) return stored;

  const element = editor.view.dom.querySelector<HTMLElement>(
    '.rm-page-footer-0 .rm-page-footer-content',
  );
  return element?.clientHeight ?? 0;
}

/**
 * Captures the rendered charts so the export shows exactly what the user
 * sees, rather than re-plotting the data.
 */
export function captureChartImages(editor: Editor): ChartImage[] {
  const images: ChartImage[] = [];

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'chart') return;

    const dom = editor.view.nodeDOM(pos);
    if (!(dom instanceof HTMLElement)) return;

    const canvas = dom.querySelector('canvas');
    if (!(canvas instanceof HTMLCanvasElement)) return;

    try {
      const rect = canvas.getBoundingClientRect();
      images.push({
        src: canvas.toDataURL('image/png'),
        widthPx: Math.round(rect.width) || canvas.width,
        heightPx: Math.round(rect.height) || canvas.height,
        alignment: typeof node.attrs.alignment === 'string' ? node.attrs.alignment : 'center',
      });
    } catch {
      // A tainted canvas cannot be exported — skip it rather than fail.
    }
  });

  return images;
}

/** Triggers a browser download for a generated file. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
