/**
 * The mapping between the document's blocks and the pages they land on.
 *
 * The paginator reports, for every page, which of the source blocks it
 * contains. From that we can tell which blocks *start* a page, which is what
 * the Word export needs in order to break in the same places as the PDF.
 */

/** A single page of the laid-out document. */
export interface PaginatedPage {
  /** 1-based page number. */
  pageNumber: number;
  /** The HTML of the page's content box. */
  html: string;
  /** Indices of the source blocks that appear on this page. */
  blockIndices: number[];
}

/**
 * Works out which blocks start a new page.
 *
 * A block that appears on a page but not on any earlier page begins that
 * page — but only the *first* such block does. The ones after it simply
 * continue on the same page, so the .docx can be given the same breaks.
 */
export function computePageBreakBlocks(pages: PaginatedPage[]): Set<number> {
  const breaks = new Set<number>();
  const seen = new Set<number>();

  pages.forEach((page, pageIndex) => {
    if (pageIndex === 0) {
      page.blockIndices.forEach((index) => seen.add(index));
      return;
    }

    let pageStarted = false;

    page.blockIndices.forEach((index) => {
      if (seen.has(index)) return;
      seen.add(index);

      if (!pageStarted) {
        breaks.add(index);
        pageStarted = true;
      }
    });
  });

  return breaks;
}
