/**
 * Ambient types for `pagedjs`, which ships without its own declarations.
 *
 * Only the surface the exporter uses is described here.
 */
declare module 'pagedjs' {
  export interface PagedFlow {
    pages: unknown[];
    total: number;
    size: unknown;
  }

  export class Previewer {
    constructor(options?: Record<string, unknown>);
    preview(
      content: string,
      stylesheets: unknown[],
      renderTo: HTMLElement,
    ): Promise<PagedFlow>;
  }

  export class Chunker {
    constructor(content?: unknown, renderTo?: HTMLElement, options?: Record<string, unknown>);
    pages: unknown[];
    total: number;
  }

  export class Polisher {
    constructor(setup?: boolean);
    setup(): unknown;
    add(...stylesheets: unknown[]): Promise<string>;
    destroy(): void;
  }
}
