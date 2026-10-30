/**
 * Content-aware pagination.
 *
 * The on-screen dividers produced by `tiptap-pagination-plus` are *virtual*:
 * the plugin derives its page count from `contentHeight / pageHeight`, so the
 * gaps sit at fixed intervals and no content boundary is ever respected.
 *
 * This module computes the **real** breaks with Paged.js, a CSS paged-media
 * implementation. It lays the document out into pages of the configured size,
 * splitting paragraphs, lists and table rows where they actually overflow, and
 * reports which source block ended up on which page.
 */

import { BLOCK_ATTRIBUTE } from './prepare';
import {
  EXPORT_BASE_STYLES,
  EXPORT_ROOT_CLASS,
  buildPageCSS,
  type ExportPageGeometry,
} from './styles';

export interface PaginatedPage {
  /** 1-based page number. */
  pageNumber: number;
  /** The HTML of the page's content box. */
  html: string;
  /** Indices of the source blocks that appear on this page. */
  blockIndices: number[];
}

export interface PaginatedDocument {
  pages: PaginatedPage[];
  totalPages: number;
  /** The `.pagedjs_page` elements, in page order. */
  pageElements: HTMLElement[];
  /** The live container — remove it once the export is done. */
  container: HTMLElement;
}

export interface PaginateOptions {
  /** The prepared body HTML (already containing `data-export-block` tags). */
  html: string;
  geometry: ExportPageGeometry;
  /** Render the page number in the bottom margin. Defaults to `true`. */
  pageNumbers?: boolean;
}

/**
 * Lays the document out into real pages.
 *
 * @returns the page breakdown plus the DOM needed to rasterise it.
 */
export async function paginateDocument(options: PaginateOptions): Promise<PaginatedDocument> {
  const { html, geometry, pageNumbers = true } = options;

  // Measuring text before the webfont has loaded would produce wrong breaks.
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await document.fonts.ready;
  }

  const container = createContainer();
  const baseStyle = injectStyle(EXPORT_BASE_STYLES, 'export-base-style');
  const pageStyle = injectStyle(
    buildPageCSS(geometry, { pageNumbers }),
    'export-page-style',
  );

  try {
    const { Previewer } = await loadPagedJs();
    const previewer = new Previewer();
    // Paged.js only processes the stylesheets it is handed, so the app's own
    // stylesheets are left untouched.
    await previewer.preview(
      `<div class="${EXPORT_ROOT_CLASS}">${html}</div>`,
      [{ [window.location.href]: buildPageCSS(geometry, { pageNumbers }) }],
      container,
    );

    const pageElements = Array.from(
      container.querySelectorAll<HTMLElement>('.pagedjs_page'),
    );

    const pages: PaginatedPage[] = pageElements.map((element, index) => {
      const content = element.querySelector<HTMLElement>('.pagedjs_page_content');
      const blockIndices = Array.from(
        element.querySelectorAll<HTMLElement>(`[${BLOCK_ATTRIBUTE}]`),
      )
        .map((node) => Number(node.getAttribute(BLOCK_ATTRIBUTE)))
        .filter((value) => Number.isFinite(value));

      return {
        pageNumber: index + 1,
        html: content ? content.innerHTML : '',
        blockIndices: Array.from(new Set(blockIndices)).sort((a, b) => a - b),
      };
    });

    return {
      pages,
      totalPages: pages.length,
      pageElements,
      container,
    };
  } catch (error) {
    container.remove();
    throw error;
  } finally {
    baseStyle.remove();
    pageStyle.remove();
  }
}

/** Removes the container the paginated document lives in. */
export function disposePaginatedDocument(paginated: PaginatedDocument): void {
  paginated.container.remove();
}

/**
 * Loads Paged.js.
 *
 * The build aliases `pagedjs` to the package's prebuilt browser bundle (see
 * `next.config.ts`), which exposes its API on `globalThis.Paged`. The named
 * exports are checked first so the module keeps working if it is ever
 * resolved to the ESM sources instead.
 */
async function loadPagedJs(): Promise<{ Previewer: PagedJsPreviewer }> {
  const mod = (await import('pagedjs')) as unknown as {
    Previewer?: PagedJsPreviewer;
    default?: { Previewer?: PagedJsPreviewer };
  };

  const globalPaged = (globalThis as { Paged?: { Previewer?: PagedJsPreviewer } })
    .Paged;

  const Previewer = mod.Previewer ?? mod.default?.Previewer ?? globalPaged?.Previewer;
  if (!Previewer) {
    throw new Error('Paged.js could not be loaded.');
  }
  return { Previewer };
}

/* The subset of the Paged.js API this module uses. */
interface PagedJsPreviewer {
  new (options?: Record<string, unknown>): {
    preview(
      content: string,
      stylesheets: unknown[],
      renderTo: HTMLElement,
    ): Promise<{ pages: unknown[] }>;
  };
}

function createContainer(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'export-pagination-container';
  container.setAttribute('aria-hidden', 'true');
  container.setAttribute('data-export-container', 'true');
  // The container has to stay in the layout (an off-screen position still
  // lays out and can be measured) but must never be visible.
  container.style.cssText = [
    'position: fixed',
    'left: -30000px',
    'top: 0',
    'width: 1200px',
    'height: 0',
    'overflow: hidden',
    'pointer-events: none',
    'z-index: -2147483647',
  ].join('; ');
  document.body.appendChild(container);
  return container;
}

function injectStyle(css: string, marker: string): HTMLStyleElement {
  const style = document.createElement('style');
  style.setAttribute('data-export-style', marker);
  style.textContent = css;
  document.head.appendChild(style);
  return style;
}
