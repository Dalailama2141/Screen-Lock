import { NativeModules, Platform } from 'react-native';

export type InstalledApp = {
  name: string;
  packageName: string;
  icon: string;
};

type InstalledAppsModule = {
  getInstalledApps: () => Promise<InstalledApp[]>;
  launchApp: (packageName: string) => Promise<void>;
};

const installedAppsModule = NativeModules.InstalledApps as InstalledAppsModule | undefined;

export async function getInstalledApps(): Promise<InstalledApp[]> {
  if (Platform.OS !== 'android' || !installedAppsModule?.getInstalledApps) {
    return [];
  }

  return installedAppsModule.getInstalledApps();
}

export function launchInstalledApp(packageName: string): Promise<void> {
  if (Platform.OS !== 'android' || !installedAppsModule?.launchApp) {
    return Promise.reject(new Error('Launching installed apps is only supported on Android.'));
  }

  return installedAppsModule.launchApp(packageName);
}
