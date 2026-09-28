import { NativeModules, Platform } from 'react-native';

type AppLockNativeModule = {
  isAppLockAccessibilityEnabled: () => Promise<boolean>;
  openAppLockAccessibilitySettings: () => Promise<void>;
  setProtectedApps: (packageNames: string[]) => Promise<void>;
  getProtectedApps: () => Promise<string[]>;
  consumePendingLockPackage: () => Promise<string | null>;
  allowAppTemporarily: (packageName: string, durationMs: number) => Promise<void>;
};

const appLockModule = NativeModules.InstalledApps as AppLockNativeModule | undefined;

function requireModule(): AppLockNativeModule {
  if (Platform.OS !== 'android' || !appLockModule) {
    throw new Error('App lock protection is only supported on Android.');
  }
  return appLockModule;
}

export function isAppLockAccessibilityEnabled(): Promise<boolean> {
  if (Platform.OS !== 'android' || !appLockModule?.isAppLockAccessibilityEnabled) {
    return Promise.resolve(false);
  }
  return appLockModule.isAppLockAccessibilityEnabled();
}

export function openAppLockAccessibilitySettings(): Promise<void> {
  return requireModule().openAppLockAccessibilitySettings();
}

export function setNativeProtectedApps(packageNames: string[]): Promise<void> {
  if (Platform.OS !== 'android' || !appLockModule?.setProtectedApps) {
    return Promise.resolve();
  }
  return appLockModule.setProtectedApps(packageNames);
}

export function getNativeProtectedApps(): Promise<string[]> {
  if (Platform.OS !== 'android' || !appLockModule?.getProtectedApps) {
    return Promise.resolve([]);
  }
  return appLockModule.getProtectedApps();
}

export function consumePendingLockPackage(): Promise<string | null> {
  if (Platform.OS !== 'android' || !appLockModule?.consumePendingLockPackage) {
    return Promise.resolve(null);
  }
  return appLockModule.consumePendingLockPackage();
}

export function allowAppTemporarily(packageName: string, durationMs = 15000): Promise<void> {
  if (Platform.OS !== 'android' || !appLockModule?.allowAppTemporarily) {
    return Promise.resolve();
  }
  return appLockModule.allowAppTemporarily(packageName, durationMs);
}
