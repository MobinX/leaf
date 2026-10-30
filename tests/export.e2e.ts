/**
 * End-to-end export test.
 *
 * Drives the real application: it fills the editor with content that occupies
 * exactly two A4 pages, exports it to PDF, Word and Google Docs, and checks
 * that every exported file describes the same two A4 pages with the same
 * content.
 *
 *   bun run dev            # in one shell
 *   bun tests/export.e2e.ts
 *
 * The dev server has to be running; override the address with
 * `E2E_BASE_URL`.
 */

import { chromium, type Browser, type Page } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3111';
const ARTIFACT_DIR = join(process.cwd(), 'tests', '.artifacts');
const DOCUMENT_NAME = 'e2e-export-test';

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MM_PER_PT = 25.4 / 72;
/** The number of pages the document is expected to fill. */
const TARGET_PAGES = 2;

const FILLER_TEXT =
  'The measurement of the resonant frequency of the cantilever beam was repeated ' +
  'three times for every damping ratio, and the mean values were recorded ' +
  'alongside their standard deviations in the table below.';

const SPECIAL_HTML =
  '<h1>Resonance of a damped cantilever</h1>' +
  '<h2>Method</h2>' +
  '<p>The natural frequency follows ' +
  '<math data-latex="\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}"></math>' +
  ' and was measured with the apparatus below.</p>' +
  '<table><thead><tr><th><p>Run</p></th><th><p>Damping</p></th>' +
  '<th><p>Frequency (Hz)</p></th></tr></thead><tbody>' +
  '<tr><td><p>1</p></td><td><p>0.02</p></td><td><p>12.4</p></td></tr>' +
  '<tr><td><p>2</p></td><td><p>0.05</p></td><td><p>11.8</p></td></tr>' +
  '<tr><td><p>3</p></td><td><p>0.10</p></td><td><p>10.9</p></td></tr>' +
  '</tbody></table>';

function documentHtml(fillerParagraphs: number): string {
  const filler = Array.from(
    { length: fillerParagraphs },
    () => `<p>${FILLER_TEXT}</p>`,
  ).join('');
  return SPECIAL_HTML + filler;
}

async function main() {
  rmSync(ARTIFACT_DIR, { recursive: true, force: true });
  mkdirSync(ARTIFACT_DIR, { recursive: true });

  const browser = await launchBrowser();
  const page = await browser.newPage({ acceptDownloads: true });

  try {
    await page.goto(`${BASE_URL}/editor/${DOCUMENT_NAME}`, {
      waitUntil: 'domcontentloaded',
      timeout: 120_000,
    });

    await page.waitForSelector('.ProseMirror', { timeout: 120_000 });
    await page.waitForFunction(
      () => {
        const el = document.querySelector('.ProseMirror') as
          | (HTMLElement & { editor?: unknown })
          | null;
        return !!el?.editor;
      },
      { timeout: 120_000 },
    );

    // ---------------------------------------------------------- calibrate
    // The exporter itself is the only reliable way to know how a given
    // amount of content is laid out, so the number of filler paragraphs is
    // calibrated against the real pagination.
    const filler = await calibrate(page);
    console.log(`  calibrated to ${filler} filler paragraphs`);

    await setContent(page, filler);

    // ---------------------------------------------------------------- PDF
    const pdf = await exportFormat(page, 'PDF', 'report.pdf');
    assertPdf(pdf);

    // --------------------------------------------------------------- DOCX
    await exportFormat(page, 'Microsoft Word', 'report.docx');
    assertDocx();

    // ------------------------------------------------------- Google Docs
    const html = await exportFormat(page, 'Google Docs', 'report.html');
    assertGoogleDocs(html);

    // ------------------------------------------------- mobile pagination
    await assertMobileMatchesDesktop(page);

    // ------------------------------------------------- page size switching
    await switchToA3Landscape(page);
    await assertA3Landscape(page);

    console.log('\nAll export checks passed.');
  } finally {
    await browser.close();
  }
}

/**
 * Switches the sheet to A3 landscape through the page setup panel and checks
 * that the running editor follows along.
 */
async function switchToA3Landscape(page: Page): Promise<void> {
  await page.click('[title="Page size, orientation and margins"]');

  const panel = page.locator('div').filter({ hasText: /^Page size/ }).last();
  await panel.waitFor({ state: 'visible', timeout: 30_000 });

  await page.locator('button', { hasText: /^A3$/ }).first().click();
  await page.locator('button', { hasText: /^landscape$/ }).first().click();
  await page.waitForTimeout(500);

  // The pagination plugin publishes the sheet it is using.
  const width = await page.evaluate(() => {
    const dom = document.querySelector('.ProseMirror') as HTMLElement;
    return parseFloat(getComputedStyle(dom).getPropertyValue('--rm-page-width'));
  });
  assert(
    Math.abs(width - 1587) < 4,
    `The editor should use an A3 landscape width (1587px), found ${width}px.`,
  );
}

/** Exports again and checks that the files describe an A3 landscape sheet. */
async function assertA3Landscape(page: Page): Promise<void> {
  const pdf = await exportFormat(page, 'PDF', 'a3.pdf');
  const text = pdf.toString('latin1');

  const boxes = [
    ...text.matchAll(
      /\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g,
    ),
  ];
  assert(boxes.length > 0, 'PDF should declare a MediaBox.');

  for (const box of boxes) {
    const widthMm = (Number(box[3]) - Number(box[1])) * MM_PER_PT;
    const heightMm = (Number(box[4]) - Number(box[2])) * MM_PER_PT;
    assert(
      Math.abs(widthMm - 420) < 1.5,
      `PDF page width should be 420mm, found ${widthMm.toFixed(2)}mm.`,
    );
    assert(
      Math.abs(heightMm - 297) < 1.5,
      `PDF page height should be 297mm, found ${heightMm.toFixed(2)}mm.`,
    );
  }

  await exportFormat(page, 'Microsoft Word', 'a3.docx');
  const dir = join(ARTIFACT_DIR, 'a3-docx');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  execFileSync('unzip', ['-o', '-q', join(ARTIFACT_DIR, 'a3.docx'), '-d', dir]);
  const documentXml = readFileSync(join(dir, 'word', 'document.xml'), 'utf8');

  // OOXML stores the portrait dimensions and marks the rotation, so A3
  // landscape is 297 × 420 mm with `w:orient="landscape"`.
  assert(
    /<w:pgSz w:w="16838" w:h="23811" w:orient="landscape"/.test(documentXml),
    'DOCX should declare an A3 landscape page size.',
  );

  console.log('  A3  ✓ landscape sheet in the editor, the PDF and the DOCX');
}

/* ------------------------------------------------------------------ */
/*  Content                                                            */
/* ------------------------------------------------------------------ */

async function setContent(page: Page, fillerParagraphs: number): Promise<void> {
  await page.evaluate((html) => {
    const dom = document.querySelector('.ProseMirror') as HTMLElement & {
      editor?: { commands: { setContent: (value: string) => void } };
    };
    dom.editor!.commands.setContent(html);
  }, documentHtml(fillerParagraphs));

  // Let the editor re-paginate before the content is measured.
  await page.waitForTimeout(250);
}

/** Runs the exporter and returns the number of pages it produced. */
async function countPages(page: Page, format: 'docx' | 'pdf' = 'docx'): Promise<number> {
  return page.evaluate(async (exportFormat) => {
    const api = (
      window as unknown as {
        __leaf: {
          editor: unknown;
          pageSettings: unknown;
          exportDocument: (options: Record<string, unknown>) => Promise<{
            totalPages: number;
          }>;
        };
      }
    ).__leaf;

    const result = await api.exportDocument({
      editor: api.editor,
      pageSettings: api.pageSettings,
      format: exportFormat,
      fileName: 'calibration',
    });

    return result.totalPages;
  }, format);
}

/**
 * Finds the largest amount of content that still fits on two pages.
 *
 * The page count grows monotonically with the amount of content, so a binary
 * search finds the boundary.
 */
async function calibrate(page: Page): Promise<number> {
  let low = 1;
  let high = 80;
  let best = 0;
  let bestPages = 0;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    await setContent(page, middle);
    const pages = await countPages(page);

    if (pages <= TARGET_PAGES) {
      best = middle;
      bestPages = pages;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  if (best === 0) {
    throw new Error('Could not fit any content on two pages.');
  }

  // The content has to fill the second page, not just fit on the first.
  if (bestPages !== TARGET_PAGES) {
    throw new Error(
      `Expected ${TARGET_PAGES} pages, but the best fit produced ${bestPages}.`,
    );
  }

  return best;
}

/** Clicks an export target and returns the downloaded file. */
async function exportFormat(
  page: Page,
  label: string,
  fileName: string,
): Promise<Buffer> {
  await page.click('[title="Export to PDF, Word or Google Docs"]');
  const target = page.locator('button', { hasText: label }).first();
  await target.waitFor({ state: 'visible', timeout: 30_000 });

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 180_000 }),
    target.click(),
  ]);

  const path = join(ARTIFACT_DIR, fileName);
  await download.saveAs(path);

  // Wait for the menu to report the outcome so the next export starts clean.
  await page
    .locator('text=/Exported \\d+ page/')
    .first()
    .waitFor({ timeout: 180_000 })
    .catch(() => undefined);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  return readFileSync(path);
}

/* ------------------------------------------------------------------ */
/*  Mobile                                                             */
/* ------------------------------------------------------------------ */

/** Pages per the editor's own pagination plugin (its virtual dividers). */
async function editorPageCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const pagination = document.querySelector('[data-rm-pagination]');
    return pagination ? pagination.children.length : 1;
  });
}

/**
 * Mobile defaults to the fluid writing view (one page, no overflow); the
 * print-layout toggle has to paginate exactly like desktop, and exporting
 * from the writing view has to lay out the same pages.
 */
async function assertMobileMatchesDesktop(page: Page): Promise<void> {
  const desktop = await editorPageCount(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(800);

  // The default mobile view is the fluid writing page: no virtual dividers.
  const fluid = await page.evaluate(() => !document.querySelector('[data-rm-pagination]'));
  assert(fluid, 'Mobile should default to the fluid writing view (no page dividers).');

  // Exporting from the writing view still lays out the same pages.
  const fluidPdfPages = await countPages(page, 'pdf');
  assert(
    fluidPdfPages === TARGET_PAGES,
    `Fluid-view PDF should have ${TARGET_PAGES} pages, found ${fluidPdfPages}.`,
  );

  // Print layout paginates exactly like desktop.
  await page.click('[title="Show print layout"]');
  await page.waitForTimeout(800);
  const mobile = await editorPageCount(page);
  assert(
    mobile === desktop,
    `Mobile print layout should paginate like desktop (${desktop} pages), found ${mobile}.`,
  );

  // Toggling back returns to the single fluid page.
  await page.click('[title="Show print layout"]');
  await page.waitForTimeout(500);
  const backToFluid = await page.evaluate(
    () => !document.querySelector('[data-rm-pagination]'),
  );
  assert(backToFluid, 'Toggling print layout off should return to the fluid page.');

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(500);

  console.log(`  Mobile ✓ fluid writing view, ${mobile} print pages matching desktop`);
}

/* ------------------------------------------------------------------ */
/*  Assertions                                                         */
/* ------------------------------------------------------------------ */

function assertPdf(pdf: Buffer) {
  const text = pdf.toString('latin1');

  const pageMatches = text.match(/\/Type\s*\/Page[^s]/g) ?? [];
  const pageCount = pageMatches.length;
  assert(
    pageCount === TARGET_PAGES,
    `PDF should have ${TARGET_PAGES} pages, found ${pageCount}.`,
  );

  const boxes = [
    ...text.matchAll(
      /\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g,
    ),
  ];
  assert(boxes.length > 0, 'PDF should declare a MediaBox.');

  for (const box of boxes) {
    const widthMm = (Number(box[3]) - Number(box[1])) * MM_PER_PT;
    const heightMm = (Number(box[4]) - Number(box[2])) * MM_PER_PT;
    assert(
      Math.abs(widthMm - A4_WIDTH_MM) < 1,
      `PDF page width should be ${A4_WIDTH_MM}mm, found ${widthMm.toFixed(2)}mm.`,
    );
    assert(
      Math.abs(heightMm - A4_HEIGHT_MM) < 1,
      `PDF page height should be ${A4_HEIGHT_MM}mm, found ${heightMm.toFixed(2)}mm.`,
    );
  }

  // The PDF must be selectable text, not a page screenshot: the heading has
  // to be present as text operators and the file has to use a vector font.
  assert(
    text.includes('Resonance') && text.includes('cantilever'),
    'PDF should contain the heading as selectable text.',
  );
  assert(
    /\/BaseFont\s*\/Helvetica/.test(text),
    'PDF should use a vector font for its text.',
  );

  console.log(
    `  PDF  ✓ ${pageCount} pages, ${A4_WIDTH_MM}×${A4_HEIGHT_MM}mm, selectable text`,
  );
}

function assertDocx() {
  const dir = join(ARTIFACT_DIR, 'docx');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const path = join(ARTIFACT_DIR, 'report.docx');
  execFileSync('unzip', ['-o', '-q', path, '-d', dir]);

  const documentXml = readFileSync(join(dir, 'word', 'document.xml'), 'utf8');

  // A4 is 11906 × 16838 twips.
  assert(
    /<w:pgSz w:w="11906" w:h="16838"/.test(documentXml),
    'DOCX should declare an A4 page size.',
  );

  const pageBreaks = documentXml.match(/w:type="page"/g) ?? [];
  assert(
    pageBreaks.length === TARGET_PAGES - 1,
    `DOCX should contain ${TARGET_PAGES - 1} page break(s), found ${pageBreaks.length}.`,
  );

  assert(documentXml.includes('<m:oMath'), 'DOCX should contain a native Word equation.');
  assert(documentXml.includes('<w:tbl>'), 'DOCX should contain a real table.');
  assert(
    documentXml.includes('Resonance of a damped cantilever'),
    'DOCX should contain the document headings.',
  );

  console.log(
    `  DOCX ✓ A4 page size, ${pageBreaks.length + 1} pages, native OMML math`,
  );
}

function assertGoogleDocs(html: Buffer) {
  const text = html.toString('utf8');

  assert(text.includes('<table'), 'Google Docs export should contain the table.');
  assert(
    text.includes('Resonance of a damped cantilever'),
    'Google Docs export should contain the headings.',
  );
  assert(
    /<img[^>]*src="data:image\/png/.test(text),
    'Google Docs export should contain the equation as an image.',
  );

  console.log('  HTML ✓ tables, headings and rasterised equations');
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function launchBrowser(): Promise<Browser> {
  return chromium.launch({
    executablePath: findChromium(),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
}

function findChromium(): string {
  const cacheDir = join(process.env.HOME ?? '', '.cache', 'ms-playwright');
  const candidates = [
    join(
      cacheDir,
      'chromium_headless_shell-1248',
      'chrome-headless-shell-linux64',
      'chrome-headless-shell',
    ),
    join(cacheDir, 'chromium-1248', 'chrome-linux', 'chrome'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  throw new Error(`No Chromium build found. Looked in:\n${candidates.join('\n')}`);
}

main().catch((error) => {
  console.error('\nExport e2e failed:', error);
  process.exit(1);
});
