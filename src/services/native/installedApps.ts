import { NativeModules, Platform } from 'react-native';

export type InstalledApp = {
  name: string;
  packageName: string;
};

type InstalledAppsModule = {
  getInstalledApps: () => Promise<InstalledApp[]>;
};

const installedAppsModule = NativeModules.InstalledApps as InstalledAppsModule | undefined;

export async function getInstalledApps(): Promise<InstalledApp[]> {
  if (Platform.OS !== 'android' || !installedAppsModule?.getInstalledApps) {
    return [];
  }

  return installedAppsModule.getInstalledApps();
}
