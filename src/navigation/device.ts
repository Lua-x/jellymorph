import { useMediaQuery } from '@/lib/use-media-query';
import type { DeviceMode } from '@/settings/schema';
import { useDeviceSettings } from '@/settings/store';

export type DeviceKind = 'desktop' | 'tv' | 'touch';

/** Browsers of smart TVs and streaming sticks (webOS, Tizen, Fire TV, Android/Google TV …). */
const TV_PATTERN =
  /SMART-?TV|SmartTV|Tizen|Web0S|webOS|NetCast|HbbTV|BRAVIA|VIDAA|PhilipsTV|Viera|Roku|CrKey|GoogleTV|Android TV|\bAFT[A-Z]|; ?TV\b/i;

export function isTvBrowser(userAgent: string): boolean {
  return TV_PATTERN.test(userAgent);
}

/** The effective device kind for a setting and the environment. */
export function resolveDevice(
  mode: DeviceMode,
  userAgent: string,
  coarsePointer: boolean,
): DeviceKind {
  if (mode === 'tv') return 'tv';
  if (mode === 'auto' && isTvBrowser(userAgent)) return 'tv';
  return coarsePointer ? 'touch' : 'desktop';
}

/** desktop, tv or touch – from the setting (Auto/Desktop/TV) and the browser. */
export function useDeviceKind(): DeviceKind {
  const mode = useDeviceSettings((state) => state.deviceMode);
  const coarse = useMediaQuery('(pointer: coarse) and (hover: none)');
  return resolveDevice(mode, navigator.userAgent, coarse);
}
