import { readString, writeString } from '@/lib/storage';

const DEVICE_ID_KEY = 'jellymorph.deviceId';
const DEVICE_ID_PATTERN = /^[0-9a-f]{32}$/;

function randomHex(bytes: number): string {
  const buffer = new Uint8Array(bytes);
  // getRandomValues also works in insecure contexts (plain HTTP in a LAN), unlike randomUUID.
  crypto.getRandomValues(buffer);
  return Array.from(buffer, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Stable random id for this browser. Jellyfin binds access tokens to it. */
export function getDeviceId(): string {
  const stored = readString('local', DEVICE_ID_KEY);
  if (stored && DEVICE_ID_PATTERN.test(stored)) return stored;
  const id = randomHex(16);
  writeString('local', DEVICE_ID_KEY, id);
  return id;
}

const BROWSERS: [RegExp, string][] = [
  [/Edg\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/SamsungBrowser/, 'Samsung Internet'],
  [/Silk\//, 'Silk'],
  [/Firefox\/|FxiOS/, 'Firefox'],
  [/Chrome\/|CriOS/, 'Chrome'],
  [/Safari\//, 'Safari'],
];

const SYSTEMS: [RegExp, string][] = [
  [/Web0S|webOS/, 'webOS'],
  [/Tizen/, 'Tizen'],
  [/CrOS/, 'ChromeOS'],
  [/Android/, 'Android'],
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/Linux/, 'Linux'],
];

/** Human readable device name shown in the Jellyfin dashboard, e.g. "Chrome · Windows". */
export function describeDevice(userAgent: string): string {
  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? 'Browser';
  const system = SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1];
  return system ? `${browser} · ${system}` : browser;
}
