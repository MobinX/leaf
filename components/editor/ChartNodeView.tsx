'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlignCenter, AlignLeft, AlignRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { chartModelOptions, fitLeastSquares, type ChartModel, type DataPoint } from './chartFitting';

type EditableRow = {
  id: string;
  x: string;
  y: string;
};

type ChartAlignment = 'left' | 'center' | 'right';
type ResizeMode = 'horizontal' | 'vertical' | 'both' | null;

const DEFAULT_MODEL: ChartModel = 'linear';
const DEFAULT_X_LABEL = 'X';
const DEFAULT_Y_LABEL = 'Y';
const DEFAULT_WIDTH = '100%';
const DEFAULT_HEIGHT = '70vh';

const makeRowId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const createEmptyRow = (): EditableRow => ({ id: makeRowId(), x: '', y: '' });

const toRows = (xData: number[], yData: number[]): EditableRow[] => [
  ...xData.map((x, idx) => ({ id: makeRowId(), x: String(x), y: String(yData[idx] ?? '') })),
  createEmptyRow(),
];

const parseNumberArray = (raw: unknown): number[] => {
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item));
    } catch {
      return [];
    }
  }

  if (Array.isArray(raw)) {
    return raw
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item));
  }

  return [];
};

const parseAlignment = (raw: unknown): ChartAlignment => {
  if (raw === 'left' || raw === 'center' || raw === 'right') return raw;
  return 'center';
};

const parseModel = (raw: unknown): ChartModel => {
  if (chartModelOptions.some((option) => option.value === raw)) {
    return raw as ChartModel;
  }
  return DEFAULT_MODEL;
};

const getDomain = (values: number[]) => {
  if (values.length === 0) return [-1, 1] as const;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [min - 1, max + 1] as const;
  const pad = (max - min) * 0.08;
  return [min - pad, max + pad] as const;
};

export default function ChartNodeView({ node, updateAttributes, selected, deleteNode }: NodeViewProps) {
  const xData = useMemo(() => parseNumberArray(node.attrs.xData), [node.attrs.xData]);
  const yData = useMemo(() => parseNumberArray(node.attrs.yData), [node.attrs.yData]);
  const points: DataPoint[] = useMemo(() => 
    xData.map((x, idx) => ({ x, y: yData[idx] ?? 0 })).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y)),
    [xData, yData]
  );
  const [isEditing, setIsEditing] = useState(points.length === 0);
  const [rows, setRows] = useState<EditableRow[]>(toRows(xData, yData));
  const [draftModel, setDraftModel] = useState<ChartModel>(parseModel(node.attrs.model));
  const [draftXLabel, setDraftXLabel] = useState<string>(node.attrs.xLabel ?? DEFAULT_X_LABEL);
  const [draftYLabel, setDraftYLabel] = useState<string>(node.attrs.yLabel ?? DEFAULT_Y_LABEL);
  const [error, setError] = useState<string>('');
  const [isResizing, setIsResizing] = useState(false);
  const [resizeMode, setResizeMode] = useState<ResizeMode>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartY, setResizeStartY] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const [resizeStartHeight, setResizeStartHeight] = useState(0);
  const [resizeParentWidth, setResizeParentWidth] = useState(1);
  const [resizeParentHeight, setResizeParentHeight] = useState(1);
  const [liveWidth, setLiveWidth] = useState<string | null>(null);
  const [liveHeight, setLiveHeight] = useState<string | null>(null);

  const model = parseModel(node.attrs.model);
  const alignment = parseAlignment(node.attrs.alignment);
  const xLabel = (node.attrs.xLabel as string) || DEFAULT_X_LABEL;
  const yLabel = (node.attrs.yLabel as string) || DEFAULT_Y_LABEL;
  const width = liveWidth ?? ((node.attrs.width as string) || DEFAULT_WIDTH);
  const chartHeight = liveHeight ?? ((node.attrs.height as string) || DEFAULT_HEIGHT);
  const fitResult = useMemo(() => fitLeastSquares(points, model), [points, model]);

  const curveData = fitResult.curve.map((point) => ({ x: point.x, fit: point.y }));
  const scatterData = points.map((point) => ({ x: point.x, y: point.y }));
  const combinedData = [...curveData, ...scatterData].sort((a, b) => a.x - b.x);
  const xDomain = getDomain(combinedData.map((point) => point.x));
  const yDomain = getDomain([
    ...scatterData.map((point) => point.y),
    ...curveData.map((point) => point.fit),
  ]);
  const justifyContent =
    alignment === 'left' ? 'flex-start' : alignment === 'right' ? 'flex-end' : 'center';

  useEffect(() => {
    if (!isResizing) return undefined;

    const onMouseMove = (event: MouseEvent) => {
      const deltaX = event.clientX - resizeStartX;
      const deltaY = event.clientY - resizeStartY;
      if (resizeMode === 'horizontal' || resizeMode === 'both') {
        const nextWidthPx = Math.min(resizeParentWidth, Math.max(240, resizeStartWidth + deltaX));
        const widthPercent = (nextWidthPx / resizeParentWidth) * 100;
        setLiveWidth(`${widthPercent.toFixed(1)}%`);
      }

      if (resizeMode === 'vertical' || resizeMode === 'both') {
        const nextHeightPx = Math.min(resizeParentHeight, Math.max(220, resizeStartHeight + deltaY));
        setLiveHeight(`${nextHeightPx.toFixed(0)}px`);
      }
    };

    const onMouseUp = () => {
      setIsResizing(false);
      const nextAttributes: { width?: string; height?: string } = {};
      if (liveWidth) nextAttributes.width = liveWidth;
      if (liveHeight) nextAttributes.height = liveHeight;
      if (Object.keys(nextAttributes).length > 0) {
        updateAttributes(nextAttributes);
      }
      setResizeMode(null);
      setLiveWidth(null);
      setLiveHeight(null);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [
    isResizing,
    resizeMode,
    liveHeight,
    liveWidth,
    resizeParentHeight,
    resizeParentWidth,
    resizeStartHeight,
    resizeStartWidth,
    resizeStartX,
    resizeStartY,
    updateAttributes,
  ]);

  const startResize = (mode: Exclude<ResizeMode, null>): React.MouseEventHandler<HTMLDivElement> => {
    return (event) => {
      const container = event.currentTarget.parentElement;
      const wrapper = container?.parentElement;
      if (!container || !wrapper) return;
      event.preventDefault();
      setResizeMode(mode);
      setIsResizing(true);
      setResizeStartX(event.clientX);
      setResizeStartY(event.clientY);
      setResizeStartWidth(container.getBoundingClientRect().width);
      setResizeStartHeight(container.getBoundingClientRect().height);
      setResizeParentWidth(Math.max(wrapper.getBoundingClientRect().width, 1));
      setResizeParentHeight(Math.max(window.innerHeight - 120, 240));
    };
  };

  const openEditModal = () => {
    setRows(toRows(xData, yData));
    setDraftModel(model);
    setDraftXLabel(xLabel);
    setDraftYLabel(yLabel);
    setError('');
    setIsEditing(true);
  };

  const updateRow = (rowIndex: number, key: keyof EditableRow, value: string) => {
    setRows((prevRows) => {
      const nextRows = prevRows.map((row, index) => (index === rowIndex ? { ...row, [key]: value } : row));
      const lastRow = nextRows[nextRows.length - 1];
      if (lastRow && (lastRow.x.trim() !== '' || lastRow.y.trim() !== '')) {
        nextRows.push(createEmptyRow());
      }
      return nextRows;
    });
  };

  const addRow = () => setRows((prevRows) => [...prevRows, createEmptyRow()]);

  const removeRow = (rowIndex: number) => {
    setRows((prevRows) => {
      if (prevRows.length <= 2) return prevRows;
      return prevRows.filter((_, index) => index !== rowIndex);
    });
  };

  const saveChanges = () => {
    const xValues: number[] = [];
    const yValues: number[] = [];
    
    for (const row of rows) {
      const xValue = row.x.trim();
      const yValue = row.y.trim();
      if (!xValue && !yValue) continue;
      if (!xValue || !yValue) {
        setError('Each filled row must have both X and Y values.');
        return;
      }
      const x = Number(xValue);
      const y = Number(yValue);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        setError('X and Y values must be valid numbers.');
        return;
      }
      xValues.push(x);
      yValues.push(y);
    }

    if (xValues.length < 2) {
      setError('Please add at least 2 valid data points.');
      return;
    }

    updateAttributes({
      xData: JSON.stringify(xValues),
      yData: JSON.stringify(yValues),
      model: draftModel,
      xLabel: draftXLabel.trim() || DEFAULT_X_LABEL,
      yLabel: draftYLabel.trim() || DEFAULT_Y_LABEL,
    });
    setError('');
    setIsEditing(false);
  };

  return (
    <NodeViewWrapper className="chart-node-wrapper block my-4">
      <div className="w-full flex" style={{ justifyContent }}>
        <div
          className={`relative bg-white border rounded-lg shadow-sm ${selected ? 'ring-2 ring-blue-300' : ''}`}
          style={{ width }}
        >
          {selected && (
            <div className="absolute -top-10 left-0 right-0 flex items-center justify-between z-20">
              <div className="flex items-center gap-1 bg-white border rounded-md shadow px-1 py-1">
                <button
                  type="button"
                  onClick={openEditModal}
                  className="p-1.5 hover:bg-gray-100 rounded"
                  title="Edit chart data"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => updateAttributes({ alignment: 'left' })}
                  className={`p-1.5 rounded ${alignment === 'left' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                  title="Align left"
                >
                  <AlignLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => updateAttributes({ alignment: 'center' })}
                  className={`p-1.5 rounded ${alignment === 'center' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                  title="Align center"
                >
                  <AlignCenter size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => updateAttributes({ alignment: 'right' })}
                  className={`p-1.5 rounded ${alignment === 'right' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                  title="Align right"
                >
                  <AlignRight size={14} />
                </button>
                <button
                  type="button"
                  onClick={deleteNode}
                  className="p-1.5 hover:bg-red-50 text-red-600 rounded"
                  title="Delete chart"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )}

          <div className="px-3 pt-3 pb-1 text-xs text-gray-700 space-y-1">
            <div className="font-semibold text-[11px] tracking-wide uppercase text-gray-500">{model} fit</div>
            <div className="font-mono text-[11px] break-all">{fitResult.equation}</div>
            <div className="text-[11px]">
              {fitResult.ok ? `R² = ${fitResult.r2.toFixed(4)}` : fitResult.error}
            </div>
          </div>

          <div className="w-full px-2 pb-2" style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={combinedData} margin={{ top: 10, right: 20, left: 52, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={xDomain}
                  tickFormatter={(value) => Number(value).toFixed(2)}
                  label={{ value: xLabel, position: 'insideBottom', offset: -6 }}
                />
                <YAxis
                  type="number"
                  domain={yDomain}
                  width={70}
                  tickMargin={8}
                  tickFormatter={(value) => Number(value).toFixed(2)}
                  label={{ value: yLabel, angle: -90, position: 'left', offset: 4 }}
                />
                <Tooltip
                  formatter={(value) => Number(value ?? 0).toFixed(2)}
                  labelFormatter={(label) => Number(label ?? 0).toFixed(2)}
                />
                <Scatter
                  dataKey="y"
                  fill="#2563eb"
                  stroke="#1d4ed8"
                  strokeWidth={1.25}
                  shape="circle"
                  isAnimationActive={false}
                />
                <Line dataKey="fit" stroke="#ef4444" dot={false} isAnimationActive={false} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {selected && (
            <>
              <div
                className="absolute top-1/2 -translate-y-1/2 -right-2 w-3 h-12 bg-blue-500 rounded cursor-ew-resize"
                onMouseDown={startResize('horizontal')}
                title="Horizontal resize"
              />
              <div
                className="absolute left-1/2 -translate-x-1/2 -bottom-2 h-3 w-12 bg-blue-500 rounded cursor-ns-resize"
                onMouseDown={startResize('vertical')}
                title="Vertical resize"
              />
              <div
                className="absolute right-0 bottom-0 w-4 h-4 bg-blue-600 rounded-tl cursor-se-resize"
                onMouseDown={startResize('both')}
                title="Full scale resize"
              />
            </>
          )}
        </div>
      </div>

      {isEditing && (
        <div className="fixed inset-0 z-[120] bg-black/35 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-white rounded-xl shadow-2xl border p-4 space-y-4 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Chart data editor</h3>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="text-xs font-medium text-gray-700 space-y-1">
                <span>Model</span>
                <select
                  value={draftModel}
                  onChange={(event) => setDraftModel(event.target.value as ChartModel)}
                  className="w-full h-9 px-2 border rounded-md text-xs"
                >
                  {chartModelOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-gray-700 space-y-1">
                <span>X label</span>
                <input
                  value={draftXLabel}
                  onChange={(event) => setDraftXLabel(event.target.value)}
                  className="w-full h-9 px-2 border rounded-md text-xs"
                />
              </label>
              <label className="text-xs font-medium text-gray-700 space-y-1">
                <span>Y label</span>
                <input
                  value={draftYLabel}
                  onChange={(event) => setDraftYLabel(event.target.value)}
                  className="w-full h-9 px-2 border rounded-md text-xs"
                />
              </label>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-2 border-b">X</th>
                    <th className="text-left p-2 border-b">Y</th>
                    <th className="text-left p-2 border-b w-[80px]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr key={row.id}>
                      <td className="p-2 border-b">
                        <input
                          value={row.x}
                          onChange={(event) => updateRow(rowIndex, 'x', event.target.value)}
                          className="w-full h-8 px-2 border rounded"
                          placeholder="x"
                        />
                      </td>
                      <td className="p-2 border-b">
                        <input
                          value={row.y}
                          onChange={(event) => updateRow(rowIndex, 'y', event.target.value)}
                          className="w-full h-8 px-2 border rounded"
                          placeholder="y"
                        />
                      </td>
                      <td className="p-2 border-b">
                        <button
                          type="button"
                          onClick={() => removeRow(rowIndex)}
                          className="text-[11px] px-2 py-1 rounded border hover:bg-gray-50"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded border hover:bg-gray-50"
              >
                <Plus size={12} /> Add row
              </button>
              {error ? <div className="text-xs text-red-600">{error}</div> : <div />}
              <button
                type="button"
                onClick={saveChanges}
                className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 font-semibold"
              >
                Save and fit
              </button>
            </div>
          </div>
        </div>
      )}
    </NodeViewWrapper>
  );
}
