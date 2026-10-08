/**
 * Generated artwork for the demo catalog: gradients and abstract shapes, plus the invented
 * title where a real poster or logo would show one. BlurHashes are computed from the same
 * colors, so placeholders match the images.
 */
import { encode } from 'blurhash';
import type { MockImageType, MockItem } from './catalog';

function escapeXml(text: string): string {
  return text.replace(/[<>&'"]/g, (char) => `&#${String(char.charCodeAt(0))};`);
}

function hsl(hue: number, saturation: number, lightness: number): [number, number, number] {
  const s = saturation / 100;
  const l = lightness / 100;
  const k = (n: number) => (n + hue / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

const LIGHT = 42;
const DARK = 16;

/** BlurHash of the diagonal gradient used as background of every image of the item. */
export function blurHashFor(item: MockItem, type: MockImageType): string {
  const size = 16;
  const pixels = new Uint8ClampedArray(size * size * 4);
  const from = hsl(item.hue, 55, type === 'Logo' ? 80 : LIGHT);
  const to = hsl(item.hue2, 60, type === 'Logo' ? 70 : DARK);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const t = (x + y) / (2 * (size - 1));
      const offset = (y * size + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        pixels[offset + channel] = (from[channel] ?? 0) * (1 - t) + (to[channel] ?? 0) * t;
      }
      pixels[offset + 3] = 255;
    }
  }
  return encode(pixels, size, size, 4, 3);
}

function gradient(item: MockItem): string {
  return `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="hsl(${String(item.hue)} 55% ${String(LIGHT)}%)"/>
<stop offset="1" stop-color="hsl(${String(item.hue2)} 60% ${String(DARK)}%)"/>
</linearGradient></defs>`;
}

function shapes(item: MockItem, width: number, height: number): string {
  const tint = `hsl(${String(item.hue)} 85% 82% / 0.14)`;
  const seed = item.hue * 7 + item.hue2;
  const x = (offset: number) => ((seed * offset) % 100) / 100;
  return `<g fill="${tint}">
<circle cx="${String(width * (0.55 + x(3) * 0.35))}" cy="${String(height * (0.2 + x(5) * 0.3))}" r="${String(Math.min(width, height) * (0.18 + x(7) * 0.2))}"/>
<rect x="${String(width * x(11) * 0.4)}" y="${String(height * (0.45 + x(13) * 0.2))}" width="${String(width * 0.35)}" height="${String(height * 0.5)}" rx="${String(width * 0.03)}" transform="rotate(${String(-12 + x(17) * 24)} ${String(width * 0.3)} ${String(height * 0.7)})"/>
<path d="M0 ${String(height * 0.8)} Q ${String(width * 0.5)} ${String(height * (0.55 + x(19) * 0.2))} ${String(width)} ${String(height * 0.85)} V ${String(height)} H 0 Z"/>
</g>`;
}

/** Splits a title into at most three lines for the poster. */
function lines(title: string, maxChars: number): string[] {
  const result: string[] = [];
  let current = '';
  for (const word of title.split(/\s+/)) {
    if (current && `${current} ${word}`.length > maxChars) {
      result.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) result.push(current);
  return result.slice(0, 3);
}

function titleBlock(
  item: MockItem,
  x: number,
  y: number,
  maxSize: number,
  maxChars: number,
  width: number,
): string {
  const rows = lines(item.name.toUpperCase(), maxChars);
  // Bold capitals are about 0.72 em wide: shrink long words so they fit the artwork.
  const longest = Math.max(...rows.map((row) => row.length));
  const size = Math.min(maxSize, Math.floor((width - 2 * x) / (longest * 0.72)));
  const text = rows
    .map(
      (row, index) =>
        `<tspan x="${String(x)}" dy="${index === 0 ? '0' : '1.08em'}">${escapeXml(row)}</tspan>`,
    )
    .join('');
  const top = y - (rows.length - 1) * size * 1.08;
  return `<text x="${String(x)}" y="${String(top)}" font-family="system-ui, sans-serif" font-size="${String(size)}" font-weight="800" letter-spacing="1" fill="#fff">${text}</text>`;
}

function personSvg(item: MockItem): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600">${gradient(item)}
<rect width="400" height="600" fill="url(#g)"/>
<circle cx="200" cy="230" r="92" fill="hsl(${String(item.hue)} 40% 88% / 0.85)"/>
<path d="M50 600c12-140 76-210 150-210s138 70 150 210z" fill="hsl(${String(item.hue)} 40% 88% / 0.85)"/>
</svg>`;
}

export function artworkSvg(item: MockItem, type: MockImageType): string {
  if (item.type === 'Person') return personSvg(item);
  const portrait = type === 'Primary' && item.type !== 'Episode';
  if (type === 'Logo') {
    const size = item.name.length > 18 ? 74 : 104;
    // Long titles are squeezed into the box instead of running out of it.
    const fit =
      item.name.length * size * 0.56 > 776
        ? ' textLength="776" lengthAdjust="spacingAndGlyphs"'
        : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 220">
<text x="12" y="150" text-anchor="start"${fit} font-family="Georgia, 'Times New Roman', serif" font-size="${String(size)}" font-weight="700" fill="#fff" stroke="hsl(${String(item.hue)} 60% 25%)" stroke-width="3" paint-order="stroke">${escapeXml(item.name)}</text>
</svg>`;
  }
  const [width, height] = portrait ? [400, 600] : [1280, 720];
  const withTitle = (portrait && item.type !== 'Season') || type === 'Thumb';
  const label =
    item.type === 'Season' && portrait
      ? `<text x="40" y="560" font-family="system-ui, sans-serif" font-size="44" font-weight="800" fill="#fff">${escapeXml(item.name.toUpperCase())}</text>`
      : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(width)} ${String(height)}">${gradient(item)}
<rect width="${String(width)}" height="${String(height)}" fill="url(#g)"/>
${shapes(item, width, height)}
${withTitle ? (portrait ? titleBlock(item, 36, 548, 46, 13, 400) : titleBlock(item, 64, 640, 84, 22, 1280)) : ''}
${label}
</svg>`;
}
