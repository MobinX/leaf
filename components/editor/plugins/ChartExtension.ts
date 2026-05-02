import { Node, mergeAttributes, nodeInputRule } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { EditorView, NodeView } from '@tiptap/pm/view';
import { Node as PMNode } from '@tiptap/pm/model';
import {
  Chart,
  ScatterController,
  LineController,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  type ChartConfiguration,
  type ChartDataset,
  type Point,
} from 'chart.js';
import { fitLeastSquares, type ChartModel, chartModelOptions } from './chartFitting';

// Register Chart.js components
Chart.register(ScatterController, LineController, LinearScale, PointElement, LineElement, Tooltip, Legend);

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

const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#ea580c', '#7c3aed', '#0891b2'];

const ICONS = {
  Pencil: `<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>`,
  AlignLeft: `<line x1="21" x2="3" y1="6" y2="6"/><line x1="15" x2="3" y1="12" y2="12"/><line x1="17" x2="3" y1="18" y2="18"/>`,
  AlignCenter: `<line x1="21" x2="3" y1="6" y2="6"/><line x1="19" x2="5" y1="12" y2="12"/><line x1="17" x2="7" y1="18" y2="18"/>`,
  AlignRight: `<line x1="21" x2="3" y1="6" y2="6"/><line x1="21" x2="9" y1="12" y2="12"/><line x1="21" x2="7" y1="18" y2="18"/>`,
  Trash2: `<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>`,
  Plus: `<path d="M5 12h14"/><path d="M12 5v14"/>`,
  X: `<path d="M18 6 6 18"/><path d="M6 6l12 12"/>`,
};

function getIconSVG(path: string, size = 14, className = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${className}">${path}</svg>`;
}

class ChartNodeView implements NodeView {
  dom: HTMLElement;
  container: HTMLElement;
  chartContainer: HTMLElement;
  canvas: HTMLCanvasElement;
  chart?: Chart;
  node: PMNode;
  view: EditorView;
  getPos: () => number;
  
  constructor(node: PMNode, view: EditorView, getPos: () => number) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    this.dom = document.createElement('div');
    this.dom.classList.add('chart-node-wrapper', 'block', 'my-4');
    
    const outerContainer = document.createElement('div');
    outerContainer.classList.add('w-full', 'flex');
    this.dom.appendChild(outerContainer);

    this.container = document.createElement('div');
    this.container.classList.add('relative', 'bg-white', 'border', 'rounded-lg', 'shadow-sm');
    outerContainer.appendChild(this.container);

    this.chartContainer = document.createElement('div');
    this.chartContainer.classList.add('w-full', 'px-2', 'pb-2');
    this.container.appendChild(this.chartContainer);

    this.canvas = document.createElement('canvas');
    this.chartContainer.appendChild(this.canvas);

    this.render();
    
    // Auto-open editor if no data
    const datasets = this.parseDatasets();
    if (datasets.length === 0 && this.view.editable) {
        setTimeout(() => this.openEditor(), 50);
    }
  }

  parseDatasets(): Dataset[] {
    try {
      const parsed = JSON.parse(this.node.attrs.datasets);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  render() {
    const { width, height, alignment } = this.node.attrs;
    
    // Update container styles
    this.container.style.width = width;
    this.chartContainer.style.height = height;
    
    const outer = this.container.parentElement!;
    outer.style.justifyContent = alignment === 'left' ? 'flex-start' : alignment === 'right' ? 'flex-end' : 'center';

    this.renderChart();
    this.renderToolbar();
    this.renderEquationInfo();
  }

  renderChart() {
    const datasets = this.parseDatasets();
    const chartDatasets: ChartDataset[] = [];
    
    datasets.forEach((ds, idx) => {
      const color = COLORS[idx % COLORS.length];
      
      // Points
      const points = ds.xData.map((x, i) => ({ x: Number(x), y: Number(ds.yData[i]) }));
      chartDatasets.push({
        type: 'scatter',
        label: (ds.label || `Dataset ${idx + 1}`) + ' (Points)',
        data: points,
        backgroundColor: color,
        borderColor: color,
        pointRadius: 4,
      } as ChartDataset);

      // Fit
      const fit = fitLeastSquares(points, ds.model);
      if (fit.ok) {
        chartDatasets.push({
          type: 'line',
          label: (ds.label || `Dataset ${idx + 1}`) + ' (Fit)',
          data: fit.curve as Point[],
          borderColor: color,
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0.1,
        } as ChartDataset);
      }
    });

    if (this.chart) {
      this.chart.destroy();
    }

    this.chart = new Chart(this.canvas, {
      type: 'scatter',
      data: {
        datasets: chartDatasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'linear',
            position: 'bottom',
            title: {
              display: true,
              text: this.node.attrs.xLabel,
            },
          },
          y: {
            type: 'linear',
            title: {
              display: true,
              text: this.node.attrs.yLabel,
            },
          },
        },
        plugins: {
          legend: {
            display: false,
          },
        },
      },
    } as ChartConfiguration);
  }

  renderToolbar() {
    // Remove existing toolbar
    const existingToolbar = this.container.querySelector('.chart-toolbar');
    if (existingToolbar) existingToolbar.remove();

    if (!this.view.editable) return;

    const toolbar = document.createElement('div');
    toolbar.classList.add('chart-toolbar', 'absolute', '-top-10', 'left-0', 'right-0', 'flex', 'items-center', 'justify-between', 'z-20', 'hidden');
    
    const group = document.createElement('div');
    group.classList.add('flex', 'items-center', 'gap-1', 'bg-white', 'border', 'rounded-md', 'shadow', 'px-1', 'py-1');
    toolbar.appendChild(group);

    const createBtn = (icon: string, title: string, onClick: () => void, active = false) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.innerHTML = getIconSVG(icon);
      btn.title = title;
      btn.classList.add('p-1.5', 'rounded', 'hover:bg-gray-100');
      if (active) btn.classList.add('bg-blue-100', 'text-blue-700');
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      };
      return btn;
    };

    group.appendChild(createBtn(ICONS.Pencil, 'Edit chart data', () => this.openEditor()));
    group.appendChild(createBtn(ICONS.AlignLeft, 'Align left', () => this.updateAttrs({ alignment: 'left' }), this.node.attrs.alignment === 'left'));
    group.appendChild(createBtn(ICONS.AlignCenter, 'Align center', () => this.updateAttrs({ alignment: 'center' }), this.node.attrs.alignment === 'center'));
    group.appendChild(createBtn(ICONS.AlignRight, 'Align right', () => this.updateAttrs({ alignment: 'right' }), this.node.attrs.alignment === 'right'));
    
    const delBtn = createBtn(ICONS.Trash2, 'Delete chart', () => {
        const pos = this.getPos();
        this.view.dispatch(this.view.state.tr.delete(pos, pos + this.node.nodeSize));
    });
    delBtn.classList.add('text-red-600', 'hover:bg-red-50');
    group.appendChild(delBtn);

    this.container.appendChild(toolbar);
    
    // Resizers
    this.renderResizers();
  }

  renderResizers() {
    const existingResizers = this.container.querySelectorAll('.chart-resizer');
    existingResizers.forEach(r => r.remove());

    if (!this.view.editable) return;

    const createResizer = (className: string, mode: 'h' | 'v' | 'b') => {
        const resizer = document.createElement('div');
        resizer.classList.add('chart-resizer', 'absolute', 'bg-blue-500', 'rounded', 'z-10', 'hidden');
        if (mode === 'h') {
            resizer.classList.add('top-1/2', '-translate-y-1/2', '-right-2', 'w-3', 'h-12', 'cursor-ew-resize');
        } else if (mode === 'v') {
            resizer.classList.add('left-1/2', '-translate-x-1/2', '-bottom-2', 'h-3', 'w-12', 'cursor-ns-resize');
        } else {
            resizer.classList.add('right-0', 'bottom-0', 'w-4', 'h-4', 'bg-blue-600', 'rounded-tl', 'cursor-se-resize');
        }

        resizer.onmousedown = (e) => {
            e.preventDefault();
            const startX = e.clientX;
            const startY = e.clientY;
            const startWidth = this.container.getBoundingClientRect().width;
            const startHeight = this.chartContainer.getBoundingClientRect().height;
            const parentWidth = this.dom.parentElement!.getBoundingClientRect().width;

            const onMouseMove = (moveEvent: MouseEvent) => {
                if (mode === 'h' || mode === 'b') {
                    const deltaX = moveEvent.clientX - startX;
                    const newWidth = Math.min(parentWidth, Math.max(240, startWidth + deltaX));
                    this.container.style.width = `${(newWidth / parentWidth * 100).toFixed(1)}%`;
                }
                if (mode === 'v' || mode === 'b') {
                    const deltaY = moveEvent.clientY - startY;
                    const newHeight = Math.max(200, startHeight + deltaY);
                    this.chartContainer.style.height = `${newHeight}px`;
                }
            };

            const onMouseUp = () => {
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
                this.updateAttrs({
                    width: this.container.style.width,
                    height: this.chartContainer.style.height
                });
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        };

        return resizer;
    };

    this.container.appendChild(createResizer('resizer-h', 'h'));
    this.container.appendChild(createResizer('resizer-v', 'v'));
    this.container.appendChild(createResizer('resizer-b', 'b'));
  }

  renderEquationInfo() {
    const existingInfo = this.container.querySelector('.chart-info');
    if (existingInfo) existingInfo.remove();

    const info = document.createElement('div');
    info.classList.add('chart-info', 'px-3', 'pt-3', 'pb-1', 'text-xs', 'text-gray-700', 'space-y-1');
    
    const datasets = this.parseDatasets();
    datasets.forEach((ds, idx) => {
        const points = ds.xData.map((x, i) => ({ x: Number(x), y: Number(ds.yData[i]) }));
        const fit = fitLeastSquares(points, ds.model);
        
        const item = document.createElement('div');
        item.classList.add('border-l-2', 'pl-2');
        item.style.borderColor = COLORS[idx % COLORS.length];
        
        const title = document.createElement('div');
        title.classList.add('font-semibold', 'text-[11px]', 'tracking-wide', 'uppercase', 'text-gray-500');
        title.textContent = `${ds.label || `Dataset ${idx + 1}`} (${ds.model} fit)`;
        item.appendChild(title);

        const eq = document.createElement('div');
        eq.classList.add('font-mono', 'text-[11px]', 'break-all');
        eq.textContent = fit.equation;
        item.appendChild(eq);

        const r2 = document.createElement('div');
        r2.classList.add('text-[11px]');
        r2.textContent = fit.ok ? `R² = ${fit.r2.toFixed(4)}` : (fit.error || '');
        item.appendChild(r2);

        info.appendChild(item);
    });

    this.container.insertBefore(info, this.chartContainer);
  }

  updateAttrs(attrs: Record<string, unknown>) {
    const pos = this.getPos();
    this.view.dispatch(this.view.state.tr.setNodeMarkup(pos, undefined, {
        ...this.node.attrs,
        ...attrs
    }));
  }

  openEditor() {
    const datasets = this.parseDatasets();
    
    const modal = document.createElement('div');
    modal.classList.add('fixed', 'inset-0', 'z-[120]', 'bg-black/35', 'flex', 'items-center', 'justify-center', 'p-4');
    
    const content = document.createElement('div');
    content.classList.add('w-full', 'max-w-4xl', 'bg-white', 'rounded-xl', 'shadow-2xl', 'border', 'p-4', 'space-y-4', 'max-h-[90vh]', 'overflow-auto');
    modal.appendChild(content);

    const header = document.createElement('div');
    header.classList.add('flex', 'items-center', 'justify-between');
    header.innerHTML = `<h3 class="text-sm font-bold">Multi-dataset chart editor</h3>`;
    const closeBtn = document.createElement('button');
    closeBtn.classList.add('text-xs', 'px-2', 'py-1', 'rounded', 'border', 'hover:bg-gray-50');
    closeBtn.textContent = 'Close';
    closeBtn.onclick = () => modal.remove();
    header.appendChild(closeBtn);
    content.appendChild(header);

    // Global Labels
    const labelsGrid = document.createElement('div');
    labelsGrid.classList.add('grid', 'grid-cols-2', 'gap-3');
    labelsGrid.innerHTML = `
        <label class="text-xs font-medium text-gray-700 space-y-1">
            <span>X label (for all datasets)</span>
            <input id="chart-edit-x-label" value="${this.node.attrs.xLabel}" class="w-full h-9 px-2 border rounded-md text-xs">
        </label>
        <label class="text-xs font-medium text-gray-700 space-y-1">
            <span>Y label (for all datasets)</span>
            <input id="chart-edit-y-label" value="${this.node.attrs.yLabel}" class="w-full h-9 px-2 border rounded-md text-xs">
        </label>
    `;
    content.appendChild(labelsGrid);

    const datasetsContainer = document.createElement('div');
    datasetsContainer.classList.add('space-y-4', 'max-h-[60vh]', 'overflow-y-auto');
    content.appendChild(datasetsContainer);

    const currentDatasets = JSON.parse(JSON.stringify(datasets)) as Dataset[];
    if (currentDatasets.length === 0) {
        currentDatasets.push({ id: Math.random().toString(36).substr(2, 9), xData: [], yData: [], model: 'linear', label: 'Dataset 1' });
    }

    const renderDatasets = () => {
        datasetsContainer.innerHTML = '';
        currentDatasets.forEach((ds: Dataset, dsIdx: number) => {
            const dsDiv = document.createElement('div');
            dsDiv.classList.add('border', 'rounded-lg', 'p-3', 'bg-gray-50', 'space-y-2');
            
            const dsHeader = document.createElement('div');
            dsHeader.classList.add('flex', 'items-center', 'justify-between');
            
            const dsInfo = document.createElement('div');
            dsInfo.classList.add('flex', 'items-center', 'gap-2', 'flex-1');
            dsInfo.innerHTML = `
                <div class="w-4 h-4 rounded" style="background-color: ${COLORS[dsIdx % COLORS.length]}"></div>
                <input class="ds-label text-xs font-medium px-2 py-1 border rounded flex-1" value="${ds.label || ''}" placeholder="Dataset ${dsIdx + 1}">
                <select class="ds-model text-xs px-2 py-1 border rounded-md">
                    ${chartModelOptions.map(opt => `<option value="${opt.value}" ${ds.model === opt.value ? 'selected' : ''}>${opt.label}</option>`).join('')}
                </select>
            `;
            
            const labelInput = dsInfo.querySelector('.ds-label') as HTMLInputElement;
            labelInput.oninput = () => ds.label = labelInput.value;
            
            const modelSelect = dsInfo.querySelector('.ds-model') as HTMLSelectElement;
            modelSelect.onchange = () => ds.model = modelSelect.value as ChartModel;

            dsHeader.appendChild(dsInfo);
            
            if (currentDatasets.length > 1) {
                const delDs = document.createElement('button');
                delDs.innerHTML = getIconSVG(ICONS.X, 14, 'text-red-600');
                delDs.onclick = () => {
                    currentDatasets.splice(dsIdx, 1);
                    renderDatasets();
                };
                dsHeader.appendChild(delDs);
            }
            
            dsDiv.appendChild(dsHeader);

            const table = document.createElement('table');
            table.classList.add('w-full', 'text-xs', 'border', 'rounded', 'overflow-hidden');
            table.innerHTML = `
                <thead class="bg-gray-200">
                    <tr><th class="text-left p-2 border-b">X</th><th class="text-left p-2 border-b">Y</th><th class="text-left p-2 border-b w-[40px]"></th></tr>
                </thead>
                <tbody></tbody>
            `;
            const tbody = table.querySelector('tbody')!;
            
            const renderRows = () => {
                tbody.innerHTML = '';
                const count = Math.max(ds.xData.length, ds.yData.length);
                for (let i = 0; i <= count; i++) {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="p-1"><input class="x-val w-full h-8 px-2 border rounded text-xs" value="${ds.xData[i] ?? ''}"></td>
                        <td class="p-1"><input class="y-val w-full h-8 px-2 border rounded text-xs" value="${ds.yData[i] ?? ''}"></td>
                        <td class="p-1"><button class="del-row text-red-500">${getIconSVG(ICONS.X, 12)}</button></td>
                    `;
                    const xIn = tr.querySelector('.x-val') as HTMLInputElement;
                    const yIn = tr.querySelector('.y-val') as HTMLInputElement;
                    
            const updateRow = () => {
                        const x = parseFloat(xIn.value);
                        const y = parseFloat(yIn.value);
                        if (!isNaN(x) && !isNaN(y)) {
                            ds.xData[i] = x;
                            ds.yData[i] = y;
                        }
                    };
                    xIn.addEventListener('change', updateRow);
                    yIn.addEventListener('change', updateRow);
                    
                    tr.querySelector('.del-row')!.addEventListener('click', () => {
                        ds.xData.splice(i, 1);
                        ds.yData.splice(i, 1);
                        renderRows();
                    });
                    tbody.appendChild(tr);
                }
            };
            renderRows();
            
            dsDiv.appendChild(table);
            
            const addRowBtn = document.createElement('button');
            addRowBtn.classList.add('mt-2', 'text-xs', 'px-2', 'py-1', 'rounded', 'border', 'hover:bg-gray-50');
            addRowBtn.innerHTML = `${getIconSVG(ICONS.Plus, 12)} Add row`;
            addRowBtn.addEventListener('click', () => {
                ds.xData.push(0);
                ds.yData.push(0);
                renderRows();
            });
            dsDiv.appendChild(addRowBtn);

            datasetsContainer.appendChild(dsDiv);
        });
    };
    renderDatasets();

    const footer = document.createElement('div');
    footer.classList.add('flex', 'items-center', 'justify-between');
    
    const addDsBtn = document.createElement('button');
    addDsBtn.classList.add('text-xs', 'px-2.5', 'py-1.5', 'rounded', 'border', 'hover:bg-gray-50');
    addDsBtn.innerHTML = `${getIconSVG(ICONS.Plus, 12)} Add dataset`;
    addDsBtn.addEventListener('click', () => {
        currentDatasets.push({ id: Math.random().toString(36).substr(2, 9), xData: [], yData: [], model: 'linear', label: `Dataset ${currentDatasets.length + 1}` });
        renderDatasets();
    });
    footer.appendChild(addDsBtn);

    const saveBtn = document.createElement('button');
    saveBtn.classList.add('text-xs', 'px-3', 'py-1.5', 'rounded', 'bg-blue-600', 'text-white', 'hover:bg-blue-700', 'font-semibold');
    saveBtn.textContent = 'Save and fit';
    saveBtn.addEventListener('click', () => {
        const xLabelInput = document.getElementById('chart-edit-x-label') as HTMLInputElement;
        const yLabelInput = document.getElementById('chart-edit-y-label') as HTMLInputElement;
        
        // Final validation: remove empty entries
        const finalDatasets = currentDatasets.map((ds) => {
            const xData: number[] = [];
            const yData: number[] = [];
            ds.xData.forEach((x, i) => {
                const y = ds.yData[i];
                const xVal = typeof x === 'string' ? parseFloat(x) : Number(x);
                const yVal = typeof y === 'string' ? parseFloat(y) : Number(y);
                if (!isNaN(xVal) && !isNaN(yVal)) {
                    xData.push(xVal);
                    yData.push(yVal);
                }
            });
            return { ...ds, xData, yData };
        }).filter((ds) => ds.xData.length >= 2);

        this.updateAttrs({
            datasets: JSON.stringify(finalDatasets),
            xLabel: xLabelInput.value || 'X',
            yLabel: yLabelInput.value || 'Y'
        });
        modal.remove();
    });
    footer.appendChild(saveBtn);
    content.appendChild(footer);

    document.body.appendChild(modal);
  }

  update(node: PMNode) {
    if (node.type !== this.node.type) return false;
    
    const oldAttrs = this.node.attrs;
    this.node = node;
    
    if (JSON.stringify(node.attrs) !== JSON.stringify(oldAttrs)) {
        this.render();
    }
    return true;
  }

  selectNode() {
    this.container.classList.add('ring-2', 'ring-blue-300');
    const toolbar = this.container.querySelector('.chart-toolbar');
    if (toolbar) toolbar.classList.remove('hidden');
    const resizers = this.container.querySelectorAll('.chart-resizer');
    resizers.forEach(r => r.classList.remove('hidden'));
  }

  deselectNode() {
    this.container.classList.remove('ring-2', 'ring-blue-300');
    const toolbar = this.container.querySelector('.chart-toolbar');
    if (toolbar) toolbar.classList.add('hidden');
    const resizers = this.container.querySelectorAll('.chart-resizer');
    resizers.forEach(r => r.classList.add('hidden'));
  }

  stopEvent(event: Event) {
    // Prevent editor from handling events inside our modal or toolbar
    const target = event.target as HTMLElement;
    return !!(target.closest('.chart-toolbar') || target.closest('.fixed'));
  }

  ignoreMutation() {
    return true;
  }

  destroy() {
    if (this.chart) {
      this.chart.destroy();
    }
  }
}

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
          const newFormat = element.getAttribute('data-datasets');
          if (newFormat) return newFormat;
          return defaultChartAttrs.datasets;
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

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('chart'),
        props: {
          nodeViews: {
            chart: (node, view, getPos) => new ChartNodeView(node, view, getPos as () => number),
          },
        },
      }),
    ];
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
