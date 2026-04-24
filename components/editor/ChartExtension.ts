import { Node, mergeAttributes, nodeInputRule } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import ChartNodeView from './ChartNodeView';
import type { ChartModel } from './chartFitting';

type InsertChartOptions = {
  xData?: number[];
  yData?: number[];
  model?: ChartModel;
  xLabel?: string;
  yLabel?: string;
};

const defaultChartAttrs = {
  xData: '[]',
  yData: '[]',
  model: 'linear',
  xLabel: 'X',
  yLabel: 'Y',
  width: '100%',
  height: '70vh',
  alignment: 'center',
} as const;

export const ChartExtension = Node.create({
  name: 'chart',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      xData: {
        default: defaultChartAttrs.xData,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-xData') ?? defaultChartAttrs.xData,
        renderHTML: (attributes: { xData?: string }) => ({ 'data-xData': attributes.xData ?? defaultChartAttrs.xData }),
      },
      yData: {
        default: defaultChartAttrs.yData,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-yData') ?? defaultChartAttrs.yData,
        renderHTML: (attributes: { yData?: string }) => ({ 'data-yData': attributes.yData ?? defaultChartAttrs.yData }),
      },
      model: {
        default: defaultChartAttrs.model,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-model') ?? defaultChartAttrs.model,
        renderHTML: (attributes: { model?: string }) => ({ 'data-model': attributes.model ?? defaultChartAttrs.model }),
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
          const xData = options.xData ?? [];
          const yData = options.yData ?? [];
          return chain()
            .insertContent({
              type: this.name,
              attrs: {
                ...defaultChartAttrs,
                xData: JSON.stringify(xData),
                yData: JSON.stringify(yData),
                model: options.model ?? defaultChartAttrs.model,
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
