import { Node, mergeAttributes, nodeInputRule } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import ChartNodeView from './ChartNodeView';
import type { ChartModel } from './chartFitting';

export type Dataset = {
  id: string;
  xData: number[];
  yData: number[];
  model: ChartModel;
  label?: string;
};

type InsertChartOptions = {
  datasets?: Dataset[];
  xLabel?: string;
  yLabel?: string;
};

const defaultChartAttrs = {
  datasets: '[]',
  xLabel: 'X',
  yLabel: 'Y',
  width: '100%',
  height: '70vh',
  alignment: 'center',
} as const;

// Helper: Convert old format to new dataset format
const parseOldFormat = (element: HTMLElement): Dataset[] => {
  const xDataStr = element.getAttribute('data-xdata') ?? element.getAttribute('data-xData');
  const yDataStr = element.getAttribute('data-ydata') ?? element.getAttribute('data-yData');
  const model = (element.getAttribute('data-model') ?? 'linear') as ChartModel;

  if (!xDataStr || !yDataStr) return [];

  try {
    const xData = JSON.parse(xDataStr) as number[];
    const yData = JSON.parse(yDataStr) as number[];
    if (!Array.isArray(xData) || !Array.isArray(yData)) return [];
    return [
      {
        id: `legacy-${Date.now()}`,
        xData,
        yData,
        model,
      },
    ];
  } catch {
    return [];
  }
};

export const ChartExtension = Node.create({
  name: 'chart',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      datasets: {
        default: defaultChartAttrs.datasets,
        parseHTML: (element: HTMLElement) => {
          // Try new format first
          const newFormat = element.getAttribute('data-datasets');
          if (newFormat) return newFormat;
          // Fall back to old format conversion
          const oldDatasets = parseOldFormat(element);
          return JSON.stringify(oldDatasets);
        },
        renderHTML: (attributes: { datasets?: string }) => ({ 'data-datasets': attributes.datasets ?? defaultChartAttrs.datasets }),
      },
      xLabel: {
        default: defaultChartAttrs.xLabel,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-x-label') ?? defaultChartAttrs.xLabel,
        renderHTML: (attributes: { xLabel?: string }) => ({ 'data-x-label': attributes.xLabel ?? defaultChartAttrs.xLabel }),
      },
      yLabel: {
        default: defaultChartAttrs.yLabel,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-y-label') ?? defaultChartAttrs.yLabel,
        renderHTML: (attributes: { yLabel?: string }) => ({ 'data-y-label': attributes.yLabel ?? defaultChartAttrs.yLabel }),
      },
      width: {
        default: defaultChartAttrs.width,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-width') ?? defaultChartAttrs.width,
        renderHTML: (attributes: { width?: string }) => ({ 'data-width': attributes.width ?? defaultChartAttrs.width }),
      },
      height: {
        default: defaultChartAttrs.height,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-height') ?? defaultChartAttrs.height,
        renderHTML: (attributes: { height?: string }) => ({ 'data-height': attributes.height ?? defaultChartAttrs.height }),
      },
      alignment: {
        default: defaultChartAttrs.alignment,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-alignment') ?? defaultChartAttrs.alignment,
        renderHTML: (attributes: { alignment?: string }) => ({ 'data-alignment': attributes.alignment ?? defaultChartAttrs.alignment }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'chart' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['chart', mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ChartNodeView);
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: /<Chart(?:\s+[^>]*)?\s*\/>$/,
        type: this.type,
        getAttributes: () => defaultChartAttrs,
      }),
    ];
  },

  addCommands() {
    return {
      insertChart:
        (options: InsertChartOptions = {}) =>
        ({ chain }) => {
          const datasets = options.datasets ?? [];
          return chain()
            .insertContent({
              type: this.name,
              attrs: {
                ...defaultChartAttrs,
                datasets: JSON.stringify(datasets),
                xLabel: options.xLabel ?? defaultChartAttrs.xLabel,
                yLabel: options.yLabel ?? defaultChartAttrs.yLabel,
              },
            })
            .focus()
            .run();
        },
    };
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    chart: {
      insertChart: (options?: InsertChartOptions) => ReturnType;
    };
  }
}
