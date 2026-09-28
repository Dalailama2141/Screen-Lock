import { NativeModules, Platform } from 'react-native';

export type AppLockPermissionStatus = {
  overlay: boolean;
  usageAccess: boolean;
  protectionActive: boolean;
};

type AppLockNativeModule = {
  getAppLockPermissionStatus: () => Promise<AppLockPermissionStatus>;
  openOverlaySettings: () => Promise<void>;
  openUsageAccessSettings: () => Promise<void>;
  startAppLockProtection: () => Promise<void>;
  stopAppLockProtection: () => Promise<void>;
  hideLockOverlay: () => Promise<void>;
  dismissLockOverlay: () => Promise<void>;
  setProtectedApps: (packageNames: string[]) => Promise<void>;
  getProtectedApps: () => Promise<string[]>;
  consumePendingLockPackage: () => Promise<string | null>;
  openProtectedApp: (packageName: string, durationMs: number) => Promise<void>;
};

const appLockModule = NativeModules.InstalledApps as AppLockNativeModule | undefined;

const defaultStatus: AppLockPermissionStatus = {
  overlay: false,
  usageAccess: false,
  protectionActive: false,
};

function isAvailable(): boolean {
  return Platform.OS === 'android' && Boolean(appLockModule);
}

export function getAppLockPermissionStatus(): Promise<AppLockPermissionStatus> {
  if (!isAvailable() || !appLockModule?.getAppLockPermissionStatus) {
    return Promise.resolve(defaultStatus);
  }
  return appLockModule.getAppLockPermissionStatus();
}

export function openOverlaySettings(): Promise<void> {
  if (!isAvailable() || !appLockModule?.openOverlaySettings) return Promise.resolve();
  return appLockModule.openOverlaySettings();
}

export function openUsageAccessSettings(): Promise<void> {
  if (!isAvailable() || !appLockModule?.openUsageAccessSettings) return Promise.resolve();
  return appLockModule.openUsageAccessSettings();
}

export function startAppLockProtection(): Promise<void> {
  if (!isAvailable() || !appLockModule?.startAppLockProtection) return Promise.resolve();
  return appLockModule.startAppLockProtection();
}

export function stopAppLockProtection(): Promise<void> {
  if (!isAvailable() || !appLockModule?.stopAppLockProtection) return Promise.resolve();
  return appLockModule.stopAppLockProtection();
}

export function hideLockOverlay(): Promise<void> {
  if (!isAvailable() || !appLockModule?.hideLockOverlay) return Promise.resolve();
  return appLockModule.hideLockOverlay();
}

export function dismissLockOverlay(): Promise<void> {
  if (!isAvailable() || !appLockModule?.dismissLockOverlay) return Promise.resolve();
  return appLockModule.dismissLockOverlay();
}

export function openProtectedApp(packageName: string, durationMs = 15000): Promise<void> {
  if (!isAvailable() || !appLockModule?.openProtectedApp) return Promise.resolve();
  return appLockModule.openProtectedApp(packageName, durationMs);
}

export function setNativeProtectedApps(packageNames: string[]): Promise<void> {
  if (!isAvailable() || !appLockModule?.setProtectedApps) return Promise.resolve();
  return appLockModule.setProtectedApps(packageNames);
}

export function getNativeProtectedApps(): Promise<string[]> {
  if (!isAvailable() || !appLockModule?.getProtectedApps) return Promise.resolve([]);
  return appLockModule.getProtectedApps();
}

export function consumePendingLockPackage(): Promise<string | null> {
  if (!isAvailable() || !appLockModule?.consumePendingLockPackage) return Promise.resolve(null);
  return appLockModule.consumePendingLockPackage();
}
