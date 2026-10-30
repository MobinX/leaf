/**
 * PDF export.
 *
 * The document is first paginated by Paged.js (see `paginate.ts`), then every
 * page is rasterised at its exact size and placed on a PDF page of the same
 * physical dimensions. The result is a PDF whose pages line up one-to-one
 * with the paginated document — the page count, the breaks and the content on
 * each page all match.
 */

import type { PaginatedDocument } from './paginate';
import type { ExportPageGeometry } from './styles';

export interface PdfExportOptions {
  paginated: PaginatedDocument;
  geometry: ExportPageGeometry;
  /** Rasterisation scale. `2` renders at twice the CSS resolution. */
  scale?: number;
}

/**
 * Renders the paginated document into a PDF blob.
 */
export async function exportToPDF(options: PdfExportOptions): Promise<Blob> {
  const { paginated, geometry } = options;
  const scale = options.scale ?? 2;

  const [{ jsPDF }, { domToCanvas }] = await Promise.all([
    import('jspdf'),
    import('modern-screenshot'),
  ]);

  const { widthMm, heightMm } = geometry;
  const pdf = new jsPDF({
    unit: 'mm',
    format: [widthMm, heightMm],
    orientation: widthMm > heightMm ? 'landscape' : 'portrait',
    compress: true,
  });

  const sheets = paginated.pageElements
    .map((page) => page.querySelector<HTMLElement>('.pagedjs_sheet') ?? page)
    .filter((element): element is HTMLElement => !!element);

  if (sheets.length === 0) {
    return pdf.output('blob');
  }

  for (let index = 0; index < sheets.length; index += 1) {
    const canvas = await domToCanvas(sheets[index], {
      scale,
      backgroundColor: '#ffffff',
      // The page number lives in the bottom margin and must be part of the
      // capture, so nothing is trimmed away.
      width: sheets[index].offsetWidth || undefined,
      height: sheets[index].offsetHeight || undefined,
    });

    const image = canvas.toDataURL('image/png');

    if (index > 0) {
      pdf.addPage([widthMm, heightMm], orientation());
    }
    pdf.addImage(image, 'PNG', 0, 0, widthMm, heightMm, undefined, 'FAST');

    // The page number is drawn here rather than left to the paginator, so it
    // always lands in the same band as the editor's own footer.
    drawPageNumber(pdf, index + 1, sheets.length, geometry);
  }

  return pdf.output('blob');

  function orientation(): 'portrait' | 'landscape' {
    return widthMm > heightMm ? 'landscape' : 'portrait';
  }
}

/** Writes the page number into the bottom margin band. */
function drawPageNumber(
  pdf: import('jspdf').jsPDF,
  pageNumber: number,
  totalPages: number,
  geometry: ExportPageGeometry,
): void {
  const bandMm = Math.max(geometry.footerBandMm ?? 0, 6);
  const baseline = geometry.heightMm - geometry.marginBottomMm + bandMm / 2 + 1.2;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor('#000000');
  pdf.text(`${pageNumber} / ${totalPages}`, geometry.widthMm / 2, baseline, {
    align: 'center',
  });
}
