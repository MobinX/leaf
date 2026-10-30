/**
 * Page geometry model.
 *
 * Every page dimension is stored in **millimetres** so that the on-screen
 * preview, the printed sheet and every exported file (PDF / DOCX / Google
 * Docs) describe the exact same sheet. The pagination plugin
 * (`tiptap-pagination-plus`) works in CSS pixels at 96 dpi, so all the unit
 * conversion lives here instead of being scattered across the UI and the
 * exporters.
 *
 * The plugin's box model (see `node_modules/tiptap-pagination-plus`):
 *
 *   • `pageWidth` / `pageHeight`  – the sheet.
 *   • `marginLeft` / `marginRight` – horizontal page margins (applied as
 *     padding on the editor DOM).
 *   • `marginTop` / `marginBottom` – vertical space reserved above / below the
 *     content, inside the page.
 *   • `contentMarginTop` / `contentMarginBottom` – extra padding next to the
 *     header / footer blocks.
 *   • The header and footer blocks additionally reserve their own text height,
 *     which the exporters read back from the live editor so the exported page
 *     box matches the preview exactly.
 */

export const MM_PER_INCH = 25.4;
export const CSS_PX_PER_INCH = 96;

/** Millimetres → CSS pixels (96 dpi). */
export function mmToPx(mm: number): number {
  return (mm * CSS_PX_PER_INCH) / MM_PER_INCH;
}

/** CSS pixels (96 dpi) → millimetres. */
export function pxToMm(px: number): number {
  return (px * MM_PER_INCH) / CSS_PX_PER_INCH;
}

export type PageOrientation = 'portrait' | 'landscape';

export interface PagePreset {
  id: string;
  label: string;
  /** Sheet width in portrait orientation (mm). */
  widthMm: number;
  /** Sheet height in portrait orientation (mm). */
  heightMm: number;
}

/** The stock sheets a lab report is likely to be printed on. */
export const PAGE_PRESETS: readonly PagePreset[] = [
  { id: 'A4', label: 'A4', widthMm: 210, heightMm: 297 },
  { id: 'A3', label: 'A3', widthMm: 297, heightMm: 420 },
  { id: 'A5', label: 'A5', widthMm: 148, heightMm: 210 },
  { id: 'B4', label: 'B4 (ISO)', widthMm: 250, heightMm: 353 },
  { id: 'B5', label: 'B5 (ISO)', widthMm: 176, heightMm: 250 },
  { id: 'LETTER', label: 'Letter', widthMm: 215.9, heightMm: 279.4 },
  { id: 'LEGAL', label: 'Legal', widthMm: 215.9, heightMm: 355.6 },
  { id: 'TABLOID', label: 'Tabloid', widthMm: 279.4, heightMm: 431.8 },
  { id: 'CUSTOM', label: 'Custom', widthMm: 210, heightMm: 297 },
];

export const CUSTOM_PRESET_ID = 'CUSTOM';

export interface PageMargins {
  topMm: number;
  bottomMm: number;
  leftMm: number;
  rightMm: number;
}

export interface PageSettings {
  /** Id of the matching preset, or `CUSTOM`. */
  presetId: string;
  orientation: PageOrientation;
  /** Final sheet width in mm (orientation already applied). */
  widthMm: number;
  /** Final sheet height in mm (orientation already applied). */
  heightMm: number;
  margins: PageMargins;
}

export const DEFAULT_MARGINS: PageMargins = {
  topMm: 20,
  bottomMm: 20,
  leftMm: 20,
  rightMm: 20,
};

export const DEFAULT_PAGE_SETTINGS: PageSettings = {
  presetId: 'A4',
  orientation: 'portrait',
  widthMm: 210,
  heightMm: 297,
  margins: { ...DEFAULT_MARGINS },
};

/** Guards against a hand-edited / corrupted persisted value. */
const MIN_SHEET_MM = 50;
const MAX_SHEET_MM = 2000;
const MIN_MARGIN_MM = 0;
const MAX_MARGIN_MM = 200;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function roundMm(value: number): number {
  // Two decimals is well below any printer's precision and keeps the value
  // stable when it round-trips through JSON.
  return Math.round(value * 100) / 100;
}

export function getPagePreset(presetId: string): PagePreset | undefined {
  return PAGE_PRESETS.find((preset) => preset.id === presetId);
}

export function isCustomPageSize(settings: PageSettings): boolean {
  return settings.presetId === CUSTOM_PRESET_ID;
}

/**
 * Applies an orientation to a portrait sheet, returning the final width and
 * height in mm.
 */
export function orientSheet(
  widthMm: number,
  heightMm: number,
  orientation: PageOrientation,
): { widthMm: number; heightMm: number } {
  return orientation === 'landscape'
    ? { widthMm: heightMm, heightMm: widthMm }
    : { widthMm, heightMm };
}

/** Switches to another preset, keeping the current orientation. */
export function withPreset(settings: PageSettings, presetId: string): PageSettings {
  const preset = getPagePreset(presetId);
  if (!preset) return settings;

  const { widthMm, heightMm } = orientSheet(
    preset.widthMm,
    preset.heightMm,
    settings.orientation,
  );

  return {
    ...settings,
    presetId: preset.id,
    widthMm: roundMm(widthMm),
    heightMm: roundMm(heightMm),
  };
}

/**
 * Flips the sheet between portrait and landscape. For a preset the stock
 * dimensions are re-derived; for a custom size the current dimensions are
 * simply swapped.
 */
export function withOrientation(
  settings: PageSettings,
  orientation: PageOrientation,
): PageSettings {
  const preset = getPagePreset(settings.presetId);
  const source =
    preset && preset.id !== CUSTOM_PRESET_ID
      ? { widthMm: preset.widthMm, heightMm: preset.heightMm }
      : { widthMm: settings.widthMm, heightMm: settings.heightMm };

  const { widthMm, heightMm } = orientSheet(
    source.widthMm,
    source.heightMm,
    orientation,
  );

  return {
    ...settings,
    orientation,
    widthMm: roundMm(widthMm),
    heightMm: roundMm(heightMm),
  };
}

/** Sets a custom sheet size, switching the preset to `CUSTOM`. */
export function withCustomSize(
  settings: PageSettings,
  widthMm: number,
  heightMm: number,
): PageSettings {
  const width = clamp(roundMm(widthMm), MIN_SHEET_MM, MAX_SHEET_MM);
  const height = clamp(roundMm(heightMm), MIN_SHEET_MM, MAX_SHEET_MM);

  return {
    ...settings,
    presetId: CUSTOM_PRESET_ID,
    orientation: width > height ? 'landscape' : 'portrait',
    widthMm: width,
    heightMm: height,
  };
}

export function withMargins(settings: PageSettings, margins: PageMargins): PageSettings {
  return {
    ...settings,
    margins: {
      topMm: clamp(roundMm(margins.topMm), MIN_MARGIN_MM, MAX_MARGIN_MM),
      bottomMm: clamp(roundMm(margins.bottomMm), MIN_MARGIN_MM, MAX_MARGIN_MM),
      leftMm: clamp(roundMm(margins.leftMm), MIN_MARGIN_MM, MAX_MARGIN_MM),
      rightMm: clamp(roundMm(margins.rightMm), MIN_MARGIN_MM, MAX_MARGIN_MM),
    },
  };
}

/**
 * Coerces anything (a persisted blob, a partial object, `undefined`) into a
 * valid {@link PageSettings}. Unknown presets fall back to A4.
 */
export function normalizePageSettings(input: unknown): PageSettings {
  if (!input || typeof input !== 'object') return { ...DEFAULT_PAGE_SETTINGS, margins: { ...DEFAULT_MARGINS } };

  const raw = input as Partial<PageSettings> & { margins?: Partial<PageMargins> };

  const orientation: PageOrientation = raw.orientation === 'landscape' ? 'landscape' : 'portrait';

  let presetId = typeof raw.presetId === 'string' ? raw.presetId : DEFAULT_PAGE_SETTINGS.presetId;
  if (!getPagePreset(presetId)) presetId = DEFAULT_PAGE_SETTINGS.presetId;

  const preset = getPagePreset(presetId)!;
  const hasCustomDims =
    typeof raw.widthMm === 'number' && typeof raw.heightMm === 'number';

  let widthMm: number;
  let heightMm: number;

  if (preset.id === CUSTOM_PRESET_ID || !hasCustomDims) {
    const source = hasCustomDims
      ? { widthMm: raw.widthMm as number, heightMm: raw.heightMm as number }
      : { widthMm: preset.widthMm, heightMm: preset.heightMm };
    const oriented = orientSheet(source.widthMm, source.heightMm, orientation);
    widthMm = oriented.widthMm;
    heightMm = oriented.heightMm;
  } else {
    const oriented = orientSheet(preset.widthMm, preset.heightMm, orientation);
    widthMm = oriented.widthMm;
    heightMm = oriented.heightMm;
  }

  const rawMargins: Partial<PageMargins> = raw.margins ?? {};
  const margins = withMargins(
    { ...DEFAULT_PAGE_SETTINGS, margins: { ...DEFAULT_MARGINS } },
    {
      topMm: typeof rawMargins.topMm === 'number' ? rawMargins.topMm : DEFAULT_MARGINS.topMm,
      bottomMm:
        typeof rawMargins.bottomMm === 'number' ? rawMargins.bottomMm : DEFAULT_MARGINS.bottomMm,
      leftMm: typeof rawMargins.leftMm === 'number' ? rawMargins.leftMm : DEFAULT_MARGINS.leftMm,
      rightMm:
        typeof rawMargins.rightMm === 'number' ? rawMargins.rightMm : DEFAULT_MARGINS.rightMm,
    },
  ).margins;

  return {
    presetId,
    orientation,
    widthMm: clamp(roundMm(widthMm), MIN_SHEET_MM, MAX_SHEET_MM),
    heightMm: clamp(roundMm(heightMm), MIN_SHEET_MM, MAX_SHEET_MM),
    margins,
  };
}

/**
 * The pagination plugin's configuration for a given sheet. `contentMarginTop`
 * and `contentMarginBottom` stay at zero so that the plugin's content box is
 * exactly `sheet − margins`, which is what the exporters reproduce.
 */
export interface PluginPageConfig {
  pageWidth: number;
  pageHeight: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  contentMarginTop: number;
  contentMarginBottom: number;
}

export function pageSettingsToPluginConfig(settings: PageSettings): PluginPageConfig {
  return {
    pageWidth: Math.round(mmToPx(settings.widthMm)),
    pageHeight: Math.round(mmToPx(settings.heightMm)),
    marginTop: Math.round(mmToPx(settings.margins.topMm)),
    marginBottom: Math.round(mmToPx(settings.margins.bottomMm)),
    marginLeft: Math.round(mmToPx(settings.margins.leftMm)),
    marginRight: Math.round(mmToPx(settings.margins.rightMm)),
    contentMarginTop: 0,
    contentMarginBottom: 0,
  };
}

/** The printable area of a sheet, in millimetres. */
export function pageContentBoxMm(settings: PageSettings): { widthMm: number; heightMm: number } {
  return {
    widthMm: Math.max(0, settings.widthMm - settings.margins.leftMm - settings.margins.rightMm),
    heightMm: Math.max(0, settings.heightMm - settings.margins.topMm - settings.margins.bottomMm),
  };
}

/** Human readable summary, e.g. `A4 · 210 × 297 mm`. */
export function describePageSize(settings: PageSettings): string {
  const preset = getPagePreset(settings.presetId);
  const label = preset && preset.id !== CUSTOM_PRESET_ID ? preset.label : 'Custom';
  return `${label} · ${Math.round(settings.widthMm)} × ${Math.round(settings.heightMm)} mm`;
}
