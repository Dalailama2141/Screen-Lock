import type { LockMethod } from '../../types';
import { screenGuardColors } from '../../theme';

export type Tab = 'Home' | 'Statistics' | 'Settings';
export type SetupStep = 'choose' | 'validate';
export type AppItem = { name: string; packageName: string; icon: string; color: string; mark: string; locked: boolean };
export type ThemePalette = { readonly bg: string; readonly panel: string; readonly border: string; readonly text: string; readonly muted: string; readonly teal: string; readonly danger: string };
export type AccentColor = { readonly bg: string; readonly veil: string; readonly on: string };

export const lockMethods: LockMethod[] = ['Fingerprint', 'Pattern', 'PIN'];
export const appColors = ['#25d366', '#d6249f', '#4267e8', '#159b9b', '#f5c342', '#2aabee'];

export const CREDENTIAL_METHOD_KEY = '@screen-guard/method';
export const LEGACY_CREDENTIAL_VALUE_KEY = '@screen-guard/credential';
export const DEVICE_ID_KEY = '@screen-guard/device-id';
export const SETUP_COMPLETE_KEY = '@screen-guard/setup-complete';
export const APP_WALLPAPERS_KEY = '@screen-guard/app-wallpapers';
export const COMMON_WALLPAPER_KEY = '@screen-guard/common-wallpaper';
export const PROTECTED_APPS_KEY = '@screen-guard/protected-apps';

export const themePalettes = {
  Dark: screenGuardColors,
  Light: { bg: '#ffffff', panel: '#f8fbff', border: '#d7e5f8', text: '#12233a', muted: '#5f728d', teal: '#0a918f', danger: '#d93666' },
  System: { bg: '#0f172a', panel: '#182538', border: '#2b3d57', text: '#edf7ff', muted: '#b5c3d7', teal: '#5fe5d1', danger: '#ff6b81' },
} as const satisfies Record<string, ThemePalette>;

export const ACCENT_COLOR_KEY = '@screen-guard/accent-color';
export const DEFAULT_ACCENT_COLOR = 'Midnight';

const DARK_ON = '#f5f7fb';
const LIGHT_ON = '#0b1020';
const DARK_VEIL = 'rgba(255, 255, 255, 0.05)';
const LIGHT_VEIL = 'rgba(0, 0, 0, 0.06)';

/**
 * Solid background colours offered in Settings. `on` is the readable foreground for the chosen
 * colour and `veil` is the translucent layer drawn over it so panels keep their contrast.
 */
export const accentColors = {
  Midnight: { bg: '#020617', on: DARK_ON, veil: DARK_VEIL },
  Ink: { bg: '#0F172A', on: DARK_ON, veil: DARK_VEIL },
  Slate: { bg: '#1E293B', on: DARK_ON, veil: DARK_VEIL },
  Graphite: { bg: '#27272A', on: DARK_ON, veil: DARK_VEIL },
  Navy: { bg: '#172554', on: DARK_ON, veil: DARK_VEIL },
  Indigo: { bg: '#312E81', on: DARK_ON, veil: DARK_VEIL },
  Wine: { bg: '#581C87', on: DARK_ON, veil: DARK_VEIL },
  Royal: { bg: '#1E40AF', on: DARK_ON, veil: DARK_VEIL },
  Azure: { bg: '#075985', on: DARK_ON, veil: DARK_VEIL },
  Teal: { bg: '#115E59', on: DARK_ON, veil: DARK_VEIL },
  Emerald: { bg: '#065F46', on: DARK_ON, veil: DARK_VEIL },
  Forest: { bg: '#14532D', on: DARK_ON, veil: DARK_VEIL },
  Olive: { bg: '#365314', on: DARK_ON, veil: DARK_VEIL },
  Amber: { bg: '#78350F', on: DARK_ON, veil: DARK_VEIL },
  Rust: { bg: '#7C2D12', on: DARK_ON, veil: DARK_VEIL },
  Crimson: { bg: '#7F1D1D', on: DARK_ON, veil: DARK_VEIL },
  Rose: { bg: '#881337', on: DARK_ON, veil: DARK_VEIL },
  Sky: { bg: '#38BDF8', on: LIGHT_ON, veil: LIGHT_VEIL },
  Mint: { bg: '#5EEAD4', on: LIGHT_ON, veil: LIGHT_VEIL },
  Marigold: { bg: '#FBBF24', on: LIGHT_ON, veil: LIGHT_VEIL },
} as const satisfies Record<string, AccentColor>;

export type AccentName = keyof typeof accentColors;

export const accentNames = Object.keys(accentColors) as AccentName[];

export function accentColor(name: string): AccentColor {
  return accentColors[(accentNames as string[]).includes(name) ? name as AccentName : DEFAULT_ACCENT_COLOR];
}

/** WCAG relative luminance, used to decide whether content over a colour needs dark text. */
export function isLightColor(hex: string): boolean {
  const value = hex.replace('#', '');
  if (value.length !== 6) return false;
  const channels = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16) / 255);
  const [red, green, blue] = channels.map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue > 0.35;
}

export const PATTERN_SIZE = 270;
export const PATTERN_DOT_SIZE = 58;
export const PATTERN_DOT_INSET = 16;
export const PATTERN_DOT_STEP = 90;
export const PATTERN_POINT_RADIUS = 38;
export const PATTERN_POINTS = Array.from({ length: 9 }, (_, index) => ({
  x: PATTERN_DOT_INSET + (index % 3) * PATTERN_DOT_STEP + PATTERN_DOT_SIZE / 2,
  y: PATTERN_DOT_INSET + Math.floor(index / 3) * PATTERN_DOT_STEP + PATTERN_DOT_SIZE / 2,
}));

export const SELF_PACKAGE = 'com.screenguard';
export const SELF_APP: AppItem = { name: 'Screen Guard', packageName: SELF_PACKAGE, icon: '', color: '#26e4d5', mark: 'S', locked: true };

export function toAppItem(app: { name: string; packageName: string; icon: string }, index: number): AppItem {
  return { ...app, color: appColors[index % appColors.length], mark: app.name.charAt(0).toUpperCase(), locked: false };
}

export function formatDuration(millis: number): string {
  const totalMinutes = Math.round(millis / 60000);
  if (totalMinutes < 1) return '<1m';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}
