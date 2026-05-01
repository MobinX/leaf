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
import { AlignCenter, AlignLeft, AlignRight, Pencil, Plus, Trash2, X } from 'lucide-react';
import { chartModelOptions, fitLeastSquares, type ChartModel, type DataPoint } from './chartFitting';
import type { Dataset } from './ChartExtension';

type EditableRow = {
  id: string;
  x: string;
  y: string;
};

type ChartAlignment = 'left' | 'center' | 'right';
type ResizeMode = 'horizontal' | 'vertical' | 'both' | null;

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

const parseDatasets = (raw: unknown): Dataset[] => {
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((ds) => ds.id && Array.isArray(ds.xData) && Array.isArray(ds.yData) && ds.model);
    } catch {
      return [];
    }
  }
  if (Array.isArray(raw)) {
    return raw.filter((ds) => ds.id && Array.isArray(ds.xData) && Array.isArray(ds.yData) && ds.model);
  }
  return [];
};

const parseAlignment = (raw: unknown): ChartAlignment => {
  if (raw === 'left' || raw === 'center' || raw === 'right') return raw;
  return 'center';
};

const getDomain = (values: number[]) => {
  if (values.length === 0) return [-1, 1] as const;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [min - 1, max + 1] as const;
  const pad = (max - min) * 0.08;
  return [min - pad, max + pad] as const;
};

const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#ea580c', '#7c3aed', '#0891b2'];

export default function ChartNodeView({ node, updateAttributes, selected, deleteNode }: NodeViewProps) {
  const datasets = useMemo(() => parseDatasets(node.attrs.datasets), [node.attrs.datasets]);
  const [isEditing, setIsEditing] = useState(datasets.length === 0);
  const [editingDatasets, setEditingDatasets] = useState<Array<{ dataset: Dataset; rows: EditableRow[] }>>(
    datasets.map((ds) => ({ dataset: ds, rows: toRows(ds.xData, ds.yData) }))
  );
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

  const alignment = parseAlignment(node.attrs.alignment);
  const xLabel = (node.attrs.xLabel as string) || DEFAULT_X_LABEL;
  const yLabel = (node.attrs.yLabel as string) || DEFAULT_Y_LABEL;
  const width = liveWidth ?? ((node.attrs.width as string) || DEFAULT_WIDTH);
  const chartHeight = liveHeight ?? ((node.attrs.height as string) || DEFAULT_HEIGHT);

  // Prepare chart data combining all datasets
  const allPoints: Array<{ x: number; y: number; datasetId: string }> = [];
  const fitResults: Record<string, ReturnType<typeof fitLeastSquares>> = {};

  datasets.forEach((ds) => {
    const points: DataPoint[] = ds.xData
      .map((x, i) => ({ x, y: ds.yData[i] ?? 0 }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    
    fitResults[ds.id] = fitLeastSquares(points, ds.model);
    points.forEach((p) => allPoints.push({ ...p, datasetId: ds.id }));
  });

  const xDomain = getDomain(allPoints.map((p) => p.x));
  const yValues = allPoints.map((p) => p.y).concat(
    Object.values(fitResults).flatMap((fr) => fr.curve.map((p) => p.y))
  );
  const yDomain = getDomain(yValues);
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
    setEditingDatasets(
      datasets.map((ds) => ({ dataset: ds, rows: toRows(ds.xData, ds.yData) }))
    );
    setDraftXLabel(xLabel);
    setDraftYLabel(yLabel);
    setError('');
    setIsEditing(true);
  };

  const updateDatasetRows = (dsIndex: number, rowIndex: number, key: keyof EditableRow, value: string) => {
    setEditingDatasets((prev) =>
      prev.map((item, idx) => {
        if (idx !== dsIndex) return item;
        const nextRows = item.rows.map((row, i) => (i === rowIndex ? { ...row, [key]: value } : row));
        const lastRow = nextRows[nextRows.length - 1];
        if (lastRow && (lastRow.x.trim() !== '' || lastRow.y.trim() !== '')) {
          nextRows.push(createEmptyRow());
        }
        return { ...item, rows: nextRows };
      })
    );
  };

  const addDatasetRow = (dsIndex: number) => {
    setEditingDatasets((prev) =>
      prev.map((item, idx) => (idx === dsIndex ? { ...item, rows: [...item.rows, createEmptyRow()] } : item))
    );
  };

  const removeDatasetRow = (dsIndex: number, rowIndex: number) => {
    setEditingDatasets((prev) =>
      prev.map((item, idx) => {
        if (idx !== dsIndex || item.rows.length <= 2) return item;
        return { ...item, rows: item.rows.filter((_, i) => i !== rowIndex) };
      })
    );
  };

  const addDataset = () => {
    setEditingDatasets((prev) => [
      ...prev,
      {
        dataset: { id: makeRowId(), xData: [], yData: [], model: 'linear', label: `Dataset ${prev.length + 1}` },
        rows: [createEmptyRow()],
      },
    ]);
  };

  const removeDataset = (dsIndex: number) => {
    setEditingDatasets((prev) => prev.filter((_, idx) => idx !== dsIndex));
  };

  const updateDatasetLabel = (dsIndex: number, label: string) => {
    setEditingDatasets((prev) =>
      prev.map((item, idx) => (idx === dsIndex ? { ...item, dataset: { ...item.dataset, label } } : item))
    );
  };

  const updateDatasetModel = (dsIndex: number, model: ChartModel) => {
    setEditingDatasets((prev) =>
      prev.map((item, idx) => (idx === dsIndex ? { ...item, dataset: { ...item.dataset, model } } : item))
    );
  };

  const saveChanges = () => {
    const newDatasets: Dataset[] = [];

    for (const item of editingDatasets) {
      const xValues: number[] = [];
      const yValues: number[] = [];

      for (const row of item.rows) {
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
        setError('Each dataset must have at least 2 valid data points.');
        return;
      }

      newDatasets.push({
        ...item.dataset,
        xData: xValues,
        yData: yValues,
      });
    }

    if (newDatasets.length === 0) {
      setError('Please add at least one dataset.');
      return;
    }

    updateAttributes({
      datasets: JSON.stringify(newDatasets),
      xLabel: draftXLabel.trim() || DEFAULT_X_LABEL,
      yLabel: draftYLabel.trim() || DEFAULT_Y_LABEL,
    });
    setError('');
    setIsEditing(false);
  };

  // Prepare chart data for Recharts: merge data points + fitted curves
  const chartDataMap = new Map<number, Record<string, number>>();
  
  // Add data points
  datasets.forEach((ds, idx) => {
    ds.xData.forEach((x, dataIdx) => {
      const y = ds.yData[dataIdx];
      if (!chartDataMap.has(x)) {
        chartDataMap.set(x, { x });
      }
      chartDataMap.get(x)![`y${idx}`] = y;
    });
  });

  // Add fitted curve points
  datasets.forEach((ds, idx) => {
    const fit = fitResults[ds.id];
    if (fit.ok) {
      fit.curve.forEach((point) => {
        if (!chartDataMap.has(point.x)) {
          chartDataMap.set(point.x, { x: point.x });
        }
        chartDataMap.get(point.x)![`fit${idx}`] = point.y;
      });
    }
  });

  // Convert map to sorted array
  const chartData = Array.from(chartDataMap.values()).sort((a, b) => a.x - b.x);

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
            {datasets.map((ds, idx) => {
              const fit = fitResults[ds.id];
              return (
                <div key={ds.id} className="border-l-2 pl-2" style={{ borderColor: COLORS[idx % COLORS.length] }}>
                  <div className="font-semibold text-[11px] tracking-wide uppercase text-gray-500">
                    {ds.label || `Dataset ${idx + 1}`} ({ds.model} fit)
                  </div>
                  <div className="font-mono text-[11px] break-all">{fit.equation}</div>
                  <div className="text-[11px]">{fit.ok ? `R² = ${fit.r2.toFixed(4)}` : fit.error}</div>
                </div>
              );
            })}
          </div>

          <div className="w-full px-2 pb-2" style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 52, bottom: 24 }}>
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
                {datasets.map((ds, idx) => (
                  <React.Fragment key={ds.id}>
                    <Scatter
                      dataKey={`y${idx}`}
                      fill={COLORS[idx % COLORS.length]}
                      stroke={COLORS[idx % COLORS.length]}
                      strokeWidth={1.25}
                      shape="circle"
                      isAnimationActive={false}
                    />
                    <Line
                      dataKey={`fit${idx}`}
                      stroke={COLORS[idx % COLORS.length]}
                      dot={false}
                      isAnimationActive={false}
                      strokeWidth={2.5}
                      type="monotone"
                      connectNulls={true}
                    />
                  </React.Fragment>
                ))}
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
              <h3 className="text-sm font-bold">Multi-dataset chart editor</h3>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-gray-700 space-y-1">
                <span>X label (for all datasets)</span>
                <input
                  value={draftXLabel}
                  onChange={(event) => setDraftXLabel(event.target.value)}
                  className="w-full h-9 px-2 border rounded-md text-xs"
                />
              </label>
              <label className="text-xs font-medium text-gray-700 space-y-1">
                <span>Y label (for all datasets)</span>
                <input
                  value={draftYLabel}
                  onChange={(event) => setDraftYLabel(event.target.value)}
                  className="w-full h-9 px-2 border rounded-md text-xs"
                />
              </label>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {editingDatasets.map((item, dsIndex) => (
                <div key={item.dataset.id} className="border rounded-lg p-3 bg-gray-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: COLORS[dsIndex % COLORS.length] }} />
                      <input
                        value={item.dataset.label || `Dataset ${dsIndex + 1}`}
                        onChange={(e) => updateDatasetLabel(dsIndex, e.target.value)}
                        className="text-xs font-medium px-2 py-1 border rounded flex-1"
                        placeholder={`Dataset ${dsIndex + 1}`}
                      />
                      <select
                        value={item.dataset.model}
                        onChange={(e) => updateDatasetModel(dsIndex, e.target.value as ChartModel)}
                        className="text-xs px-2 py-1 border rounded-md"
                      >
                        {chartModelOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {editingDatasets.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDataset(dsIndex)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Delete dataset"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <div className="border rounded overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-200">
                        <tr>
                          <th className="text-left p-2 border-b">X</th>
                          <th className="text-left p-2 border-b">Y</th>
                          <th className="text-left p-2 border-b w-[80px]">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.rows.map((row, rowIndex) => (
                          <tr key={row.id}>
                            <td className="p-2 border-b">
                              <input
                                value={row.x}
                                onChange={(e) => updateDatasetRows(dsIndex, rowIndex, 'x', e.target.value)}
                                className="w-full h-8 px-2 border rounded text-xs"
                                placeholder="x"
                              />
                            </td>
                            <td className="p-2 border-b">
                              <input
                                value={row.y}
                                onChange={(e) => updateDatasetRows(dsIndex, rowIndex, 'y', e.target.value)}
                                className="w-full h-8 px-2 border rounded text-xs"
                                placeholder="y"
                              />
                            </td>
                            <td className="p-2 border-b">
                              <button
                                type="button"
                                onClick={() => removeDatasetRow(dsIndex, rowIndex)}
                                className="text-[11px] px-2 py-1 rounded border hover:bg-gray-100"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button
                    type="button"
                    onClick={() => addDatasetRow(dsIndex)}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded border hover:bg-gray-50"
                  >
                    <Plus size={12} /> Add row
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={addDataset}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded border hover:bg-gray-50"
              >
                <Plus size={12} /> Add dataset
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
