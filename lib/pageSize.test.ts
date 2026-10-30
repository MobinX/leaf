import { describe, expect, test } from 'bun:test';
import {
  CUSTOM_PRESET_ID,
  DEFAULT_PAGE_SETTINGS,
  describePageSize,
  mmToPx,
  normalizePageSettings,
  orientSheet,
  pageContentBoxMm,
  pageSettingsToPluginConfig,
  pxToMm,
  withCustomSize,
  withMargins,
  withOrientation,
  withPreset,
} from './pageSize';

describe('unit conversion', () => {
  test('millimetres and CSS pixels round-trip', () => {
    expect(pxToMm(mmToPx(210))).toBeCloseTo(210, 6);
    expect(pxToMm(mmToPx(297))).toBeCloseTo(297, 6);
  });

  test('A4 at 96 dpi matches the pagination plugin default', () => {
    // tiptap-pagination-plus ships A4 as 794 x 1123 px.
    expect(Math.round(mmToPx(210))).toBe(794);
    expect(Math.round(mmToPx(297))).toBe(1123);
  });

  test('pixels convert back to the expected millimetres', () => {
    expect(pxToMm(794)).toBeCloseTo(210.1, 1);
    expect(pxToMm(1123)).toBeCloseTo(297.1, 1);
  });
});

describe('orientation', () => {
  test('portrait keeps the stock dimensions', () => {
    expect(orientSheet(210, 297, 'portrait')).toEqual({ widthMm: 210, heightMm: 297 });
  });

  test('landscape swaps them', () => {
    expect(orientSheet(210, 297, 'landscape')).toEqual({ widthMm: 297, heightMm: 210 });
  });

  test('switching orientation re-derives a preset sheet', () => {
    const landscape = withOrientation(DEFAULT_PAGE_SETTINGS, 'landscape');
    expect(landscape.widthMm).toBe(297);
    expect(landscape.heightMm).toBe(210);
    expect(landscape.presetId).toBe('A4');
  });

  test('switching orientation swaps a custom sheet', () => {
    const custom = withCustomSize(DEFAULT_PAGE_SETTINGS, 120, 200);
    expect(custom.presetId).toBe(CUSTOM_PRESET_ID);
    expect(custom.orientation).toBe('portrait');

    const flipped = withOrientation(custom, 'landscape');
    expect(flipped.widthMm).toBe(200);
    expect(flipped.heightMm).toBe(120);
  });
});

describe('presets', () => {
  test('A3 is twice the area of A4', () => {
    const a3 = withPreset(DEFAULT_PAGE_SETTINGS, 'A3');
    expect(a3.widthMm).toBe(297);
    expect(a3.heightMm).toBe(420);
    expect(a3.presetId).toBe('A3');
  });

  test('an unknown preset is ignored', () => {
    expect(withPreset(DEFAULT_PAGE_SETTINGS, 'NOPE').presetId).toBe('A4');
  });

  test('a preset keeps the current orientation', () => {
    const landscape = withOrientation(DEFAULT_PAGE_SETTINGS, 'landscape');
    const a3 = withPreset(landscape, 'A3');
    expect(a3.widthMm).toBe(420);
    expect(a3.heightMm).toBe(297);
  });
});

describe('custom sizes', () => {
  test('a custom size is clamped to a sane range', () => {
    const tiny = withCustomSize(DEFAULT_PAGE_SETTINGS, 1, 2);
    expect(tiny.widthMm).toBe(50);
    expect(tiny.heightMm).toBe(50);

    const huge = withCustomSize(DEFAULT_PAGE_SETTINGS, 99999, 99999);
    expect(huge.widthMm).toBe(2000);
    expect(huge.heightMm).toBe(2000);
  });

  test('a custom size is marked as custom', () => {
    const custom = withCustomSize(DEFAULT_PAGE_SETTINGS, 200, 250);
    expect(custom.presetId).toBe(CUSTOM_PRESET_ID);
    expect(custom.widthMm).toBe(200);
    expect(custom.heightMm).toBe(250);
  });
});

describe('margins', () => {
  test('margins are clamped', () => {
    const settings = withMargins(DEFAULT_PAGE_SETTINGS, {
      topMm: -5,
      bottomMm: 999,
      leftMm: 12.5,
      rightMm: 10,
    });
    expect(settings.margins.topMm).toBe(0);
    expect(settings.margins.bottomMm).toBe(200);
    expect(settings.margins.leftMm).toBe(12.5);
  });

  test('the printable box is the sheet minus the margins', () => {
    const box = pageContentBoxMm(DEFAULT_PAGE_SETTINGS);
    expect(box.widthMm).toBe(170);
    expect(box.heightMm).toBe(257);
  });
});

describe('normalization', () => {
  test('undefined falls back to the defaults', () => {
    expect(normalizePageSettings(undefined)).toEqual(DEFAULT_PAGE_SETTINGS);
  });

  test('a partial object is filled in', () => {
    const settings = normalizePageSettings({ presetId: 'A5' });
    expect(settings.presetId).toBe('A5');
    expect(settings.widthMm).toBe(148);
    expect(settings.heightMm).toBe(210);
    expect(settings.margins.topMm).toBe(20);
  });

  test('an unknown preset falls back to A4', () => {
    expect(normalizePageSettings({ presetId: 'FANFOLD' }).presetId).toBe('A4');
  });

  test('a non-finite dimension falls back to the preset size', () => {
    const settings = normalizePageSettings({ presetId: 'A4', widthMm: Number.NaN });
    expect(settings.widthMm).toBe(210);
  });

  test('normalization is idempotent', () => {
    const once = normalizePageSettings({ presetId: 'A3', orientation: 'landscape' });
    expect(normalizePageSettings(once)).toEqual(once);
  });
});

describe('pagination plugin mapping', () => {
  test('the plugin receives pixel dimensions and zero content margins', () => {
    const config = pageSettingsToPluginConfig(DEFAULT_PAGE_SETTINGS);
    expect(config.pageWidth).toBe(794);
    expect(config.pageHeight).toBe(1123);
    expect(config.marginLeft).toBe(76);
    expect(config.marginRight).toBe(76);
    expect(config.contentMarginTop).toBe(0);
    expect(config.contentMarginBottom).toBe(0);
  });

  test('a landscape sheet is wider than it is tall', () => {
    const config = pageSettingsToPluginConfig(
      withOrientation(DEFAULT_PAGE_SETTINGS, 'landscape'),
    );
    expect(config.pageWidth).toBeGreaterThan(config.pageHeight);
  });
});

describe('describePageSize', () => {
  test('describes a preset', () => {
    expect(describePageSize(DEFAULT_PAGE_SETTINGS)).toBe('A4 · 210 × 297 mm');
  });

  test('describes a custom sheet', () => {
    const custom = withCustomSize(DEFAULT_PAGE_SETTINGS, 200, 250);
    expect(describePageSize(custom)).toBe('Custom · 200 × 250 mm');
  });
});
