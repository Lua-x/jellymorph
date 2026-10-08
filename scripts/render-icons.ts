/**
 * Renders the PNG app icons (web manifest, iOS home screen) from public/favicon.svg with the
 * Chromium that Playwright already installs, so no image tool is needed.
 *
 *   node scripts/render-icons.ts
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

interface Variant {
  file: string;
  size: number;
  /** Share of the edge length the logo takes. */
  scale: number;
  /** Full-bleed background; null keeps the corners transparent. */
  background: string | null;
}

const BACKGROUND = '#0d0f13';
const VARIANTS: Variant[] = [
  { file: 'icon-192.png', size: 192, scale: 1, background: null },
  { file: 'icon-512.png', size: 512, scale: 1, background: null },
  // Maskable icons get cropped to a circle of 80 % diameter; the logo stays inside it.
  { file: 'icon-maskable-512.png', size: 512, scale: 0.56, background: BACKGROUND },
  // iOS fills transparent areas with black and rounds the corners itself.
  { file: 'apple-touch-icon.png', size: 180, scale: 0.68, background: BACKGROUND },
];

const root = join(import.meta.dirname, '..');
const logo = readFileSync(join(root, 'public', 'favicon.svg'), 'utf8');
const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const variant of VARIANTS) {
    const logoSize = Math.round(variant.size * variant.scale);
    await page.setViewportSize({ width: variant.size, height: variant.size });
    await page.setContent(
      `<body style="margin:0;display:grid;place-items:center;width:${String(variant.size)}px;` +
        `height:${String(variant.size)}px;background:${variant.background ?? 'transparent'}">` +
        logo.replace('<svg ', `<svg width="${String(logoSize)}" height="${String(logoSize)}" `) +
        '</body>',
    );
    await page.screenshot({
      path: join(outDir, variant.file),
      omitBackground: variant.background === null,
    });
    console.log(`${variant.file}: ${String(variant.size)} px`);
  }
} finally {
  await browser.close();
}
