import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const BASE_URL = process.argv[2] ?? 'http://localhost:3001';
const executablePath = join(
  process.env.HOME ?? '',
  '.cache',
  'ms-playwright',
  'chromium_headless_shell-1248',
  'chrome-headless-shell-linux64',
  'chrome-headless-shell',
);
if (!existsSync(executablePath)) throw new Error('no chromium');

const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
const page = await browser.newPage();

page.on('console', (msg) => console.log(`[console:${msg.type()}]`, msg.text().slice(0, 500)));
page.on('pageerror', (err) => console.log('[pageerror]', err.message.slice(0, 600)));
page.on('requestfailed', (req) =>
  console.log('[requestfailed]', req.url().slice(0, 160), req.failure()?.errorText),
);

await page.goto(`${BASE_URL}/editor/dbg-vinext`, {
  waitUntil: 'domcontentloaded',
  timeout: 180_000,
});
await page.waitForTimeout(20_000);

console.log('--- dom state ---');
console.log(
  await page.evaluate(() => ({
    hasProseMirror: !!document.querySelector('.ProseMirror'),
    bodyText: (document.body.textContent ?? '').replace(/\s+/g, ' ').slice(0, 300),
    scripts: document.querySelectorAll('script').length,
  })),
);

await browser.close();
