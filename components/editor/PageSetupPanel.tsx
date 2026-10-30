'use client';

import React, { useMemo, useState } from 'react';
import {
  CUSTOM_PRESET_ID,
  PAGE_PRESETS,
  withCustomSize,
  withMargins,
  withOrientation,
  withPreset,
  type PageMargins,
  type PageSettings,
} from '@/lib/pageSize';
import { cn } from '@/lib/utils';

type Unit = 'mm' | 'in';

const MM_PER_INCH = 25.4;

export interface PageSetupPanelProps {
  settings: PageSettings;
  onChange: (settings: PageSettings) => void;
}

/**
 * Lets the user pick the sheet the document is laid out on: a stock size
 * (A4, A3, Letter, …), a custom size, the orientation and the margins.
 */
export function PageSetupPanel({ settings, onChange }: PageSetupPanelProps) {
  const [unit, setUnit] = useState<Unit>('mm');

  const presets = useMemo(
    () => PAGE_PRESETS.filter((preset) => preset.id !== CUSTOM_PRESET_ID),
    [],
  );

  const toUnit = (mm: number) => (unit === 'mm' ? mm : mm / MM_PER_INCH);
  const fromUnit = (value: number) => (unit === 'mm' ? value : value * MM_PER_INCH);

  const updateMargin = (key: keyof PageMargins, value: number) => {
    if (!Number.isFinite(value)) return;
    onChange(withMargins(settings, { ...settings.margins, [key]: fromUnit(value) }));
  };

  return (
    <div className="w-[min(22rem,calc(100vw-1.5rem))] space-y-4 p-3">
      {/* Sheet size ------------------------------------------------- */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-popover)] opacity-70">
            Page size
          </span>
          <div className="flex rounded-md border border-[var(--border-popover)] p-0.5">
            {(['mm', 'in'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setUnit(option)}
                className={cn(
                  'rounded px-2 py-0.5 text-[11px] font-semibold transition-colors',
                  unit === option
                    ? 'bg-[var(--bg-toolbar-active)] text-[var(--fg-toolbar-active)]'
                    : 'text-[var(--fg-popover)] hover:bg-[var(--bg-toolbar-hover)]',
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {presets.map((preset) => {
            const active = settings.presetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onChange(withPreset(settings, preset.id))}
                title={`${preset.label} · ${preset.widthMm} × ${preset.heightMm} mm`}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-lg border px-1 py-2 transition-colors',
                  active
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-[var(--border-popover)] bg-[var(--bg-toolbar-hover)] text-[var(--fg-popover)] hover:border-blue-300',
                )}
              >
                <PaperShape
                  widthMm={preset.widthMm}
                  heightMm={preset.heightMm}
                  active={active}
                />
                <span className="text-[10px] font-semibold leading-none">{preset.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Orientation ------------------------------------------------ */}
      <section>
        <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-popover)] opacity-70">
          Orientation
        </span>
        <div className="flex gap-1.5">
          {(['portrait', 'landscape'] as const).map((orientation) => (
            <button
              key={orientation}
              type="button"
              onClick={() => onChange(withOrientation(settings, orientation))}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold capitalize transition-colors',
                settings.orientation === orientation
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-[var(--border-popover)] bg-[var(--bg-toolbar-hover)] text-[var(--fg-popover)] hover:border-blue-300',
              )}
            >
              <PaperShape
                widthMm={orientation === 'portrait' ? 8 : 11}
                heightMm={orientation === 'portrait' ? 11 : 8}
                active={settings.orientation === orientation}
              />
              {orientation}
            </button>
          ))}
        </div>
      </section>

      {/* Custom size ------------------------------------------------ */}
      <section>
        <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-popover)] opacity-70">
          Size ({unit})
        </span>
        <div className="flex items-center gap-2">
          <NumberField
            label="Width"
            value={toUnit(settings.widthMm)}
            unit={unit}
            onCommit={(value) =>
              onChange(withCustomSize(settings, fromUnit(value), settings.heightMm))
            }
          />
          <span className="text-xs text-[var(--fg-popover)] opacity-60">×</span>
          <NumberField
            label="Height"
            value={toUnit(settings.heightMm)}
            unit={unit}
            onCommit={(value) =>
              onChange(withCustomSize(settings, settings.widthMm, fromUnit(value)))
            }
          />
        </div>
        {settings.presetId !== CUSTOM_PRESET_ID && (
          <p className="mt-1.5 text-[10px] leading-tight text-[var(--fg-popover)] opacity-60">
            Editing the width or height switches the sheet to a custom size.
          </p>
        )}
      </section>

      {/* Margins ---------------------------------------------------- */}
      <section>
        <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-popover)] opacity-70">
          Margins ({unit})
        </span>
        <div className="grid grid-cols-2 gap-2">
          {(['top', 'bottom', 'left', 'right'] as const).map((key) => (
            <NumberField
              key={key}
              label={key[0].toUpperCase() + key.slice(1)}
              value={toUnit(settings.margins[`${key}Mm` as keyof PageMargins])}
              unit={unit}
              onCommit={(value) => updateMargin(`${key}Mm` as keyof PageMargins, value)}
            />
          ))}
        </div>
      </section>

      <p className="rounded-lg bg-[var(--bg-toolbar-hover)] px-3 py-2 text-[10px] leading-tight text-[var(--fg-popover)] opacity-70">
        Exported files (PDF, Word, Google Docs) are laid out on this exact sheet,
        with the page breaks computed from the content.
      </p>
    </div>
  );
}

/** A tiny rectangle that shows the proportions of a sheet. */
function PaperShape({
  widthMm,
  heightMm,
  active,
}: {
  widthMm: number;
  heightMm: number;
  active: boolean;
}) {
  const max = 22;
  const scale = max / Math.max(widthMm, heightMm);
  return (
    <span
      aria-hidden="true"
      className={cn(
        'block border',
        active ? 'border-blue-600 bg-blue-200/60' : 'border-[var(--fg-popover)]/50 bg-transparent',
      )}
      style={{
        width: `${Math.max(4, widthMm * scale)}px`,
        height: `${Math.max(4, heightMm * scale)}px`,
      }}
    />
  );
}

function NumberField({
  label,
  value,
  unit,
  onCommit,
}: {
  label: string;
  value: number;
  unit: Unit;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const display =
    draft ?? (Number.isInteger(value) ? String(value) : value.toFixed(2));

  const commit = () => {
    const parsed = Number(draft);
    setDraft(null);
    if (draft !== null && Number.isFinite(parsed) && parsed > 0) {
      onCommit(parsed);
    }
  };

  return (
    <label className="flex items-center gap-1.5 rounded-lg border border-[var(--border-popover)] bg-[var(--bg-toolbar-hover)] px-2 py-1.5">
      <span className="text-[10px] font-semibold text-[var(--fg-popover)] opacity-70">
        {label}
      </span>
      <input
        type="number"
        inputMode="decimal"
        step={unit === 'mm' ? 1 : 0.1}
        min={0}
        value={display}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
        }}
        className="w-full min-w-0 bg-transparent text-right text-xs font-semibold text-[var(--fg-popover)] outline-none"
      />
      <span className="text-[10px] text-[var(--fg-popover)] opacity-60">{unit}</span>
    </label>
  );
}
