/** Generated placeholder artwork. No real posters, logos or photos are ever used. */

export function avatarSvg(hue: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue} 70% 62%)"/>
      <stop offset="1" stop-color="hsl(${(hue + 50) % 360} 60% 32%)"/>
    </linearGradient>
  </defs>
  <rect width="256" height="256" fill="url(#g)"/>
  <circle cx="128" cy="104" r="46" fill="hsl(${hue} 40% 92% / 0.9)"/>
  <path d="M40 256c8-58 46-92 88-92s80 34 88 92z" fill="hsl(${hue} 40% 92% / 0.9)"/>
</svg>`;
}

/** Abstract artwork; the library name is shown by the UI, so the image carries no text. */
export function libraryArtSvg(hue: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue} 55% 34%)"/>
      <stop offset="1" stop-color="hsl(${(hue + 40) % 360} 60% 14%)"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#bg)"/>
  <g fill="hsl(${hue} 80% 80% / 0.12)">
    <rect x="380" y="-40" width="220" height="330" rx="18" transform="rotate(12 490 125)"/>
    <rect x="300" y="60" width="180" height="270" rx="16" transform="rotate(-8 390 195)"/>
    <rect x="70" y="150" width="150" height="225" rx="14" transform="rotate(-14 145 262)"/>
  </g>
</svg>`;
}

export function svgResponseInit(): ResponseInit {
  return { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' } };
}
