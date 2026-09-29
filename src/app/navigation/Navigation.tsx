import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkNotificationPermission, clearSessionUnlock, consumePendingLockPackage, dismissLockOverlay, getAppIcon, getAppLockPermissionStatus, getAppUsage, getNativeProtectedApps, hideLockOverlay, openOverlaySettings, openProtectedApp, openUsageAccessSettings, requestNotificationPermission, setNativeProtectedApps, startAppLockProtection, type AppUsageStat } from '../../services/native/appLock';
import { getInstalledApps } from '../../services/native/installedApps';
import { deleteLockCredential, getLockSettings } from '../../services/api';
import { createLocalLockCredential, deleteLocalLockCredential, getLocalLockMethod, hasLocalLockCredential } from '../../services/lockCredentials';
import { deleteStoredWallpaper, pickAndStoreWallpaper } from '../../services/wallpapers';
import type { LockMethod } from '../../types';
import type { AppItem, SetupStep, Tab } from './shared';
import {
  ACCENT_COLOR_KEY,
  APP_WALLPAPERS_KEY,
  CREDENTIAL_METHOD_KEY,
  COMMON_WALLPAPER_KEY,
  DEFAULT_ACCENT_COLOR,
  DEVICE_ID_KEY,
  LEGACY_CREDENTIAL_VALUE_KEY,
  PROTECTED_APPS_KEY,
  SELF_APP,
  SELF_PACKAGE,
  SETUP_COMPLETE_KEY,
  accentColor,
  accentNames,
  themePalettes,
  toAppItem,
  type AccentName,
} from './shared';
import { BottomNav } from './components/BottomNav';
import { PermissionSetupModal } from './components/PermissionSetupModal';
import { AppsScreen } from './screens/AppsScreen';
import { CredentialSetupScreen } from './screens/CredentialSetupScreen';
import { LockScreen } from './screens/LockScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SetupScreen } from './screens/SetupScreen';
import { StatisticsScreen } from './screens/StatisticsScreen';

export function Navigation() {
  const [tab, setTab] = useState<Tab>('Home');
  const [setupComplete, setSetupComplete] = useState(false);
  const [setupStep, setSetupStep] = useState<SetupStep>('choose');
  const [method, setMethod] = useState<LockMethod>('Fingerprint');
  const [deviceId, setDeviceId] = useState('');
  const [apps, setApps] = useState<AppItem[]>([]);
  const [search, setSearch] = useState('');
  const [lockedApp, setLockedApp] = useState<AppItem | null>(null);
  const lockedAppRef = useRef<AppItem | null>(null);
  lockedAppRef.current = lockedApp;
  const [loadingApps, setLoadingApps] = useState(true);
  const [theme, setTheme] = useState<'Dark' | 'Light' | 'System'>('Dark');
  const [accent, setAccent] = useState<string>(DEFAULT_ACCENT_COLOR);
  const [commonWallpaper, setCommonWallpaper] = useState<string | null>(null);
  const [pickingWallpaper, setPickingWallpaper] = useState(false);
  const [usageStats, setUsageStats] = useState<AppUsageStat[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);
  const [selfAppItem, setSelfAppItem] = useState<AppItem>(SELF_APP);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [remoteSyncAvailable, setRemoteSyncAvailable] = useState<boolean | null>(null);
  const [overlayPermission, setOverlayPermission] = useState(false);
  const [usageAccessGranted, setUsageAccessGranted] = useState(false);
  const [protectionActive, setProtectionActive] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(true);
  const [permissionModalDismissed, setPermissionModalDismissed] = useState(false);
  const [pendingLockedPackage, setPendingLockedPackage] = useState<string | null>(null);
  const [lockTriggeredBySystem, setLockTriggeredBySystem] = useState(false);
  const selfLockArmedRef = useRef(false);
  const selfLockSatisfiedRef = useRef(false);
  const appsRef = useRef<AppItem[]>([]);
  const themeColors = themePalettes[theme];
  const accentPalette = accentColor(accent);
  const appBackgroundColor = theme === 'Light' ? '#ffffff' : accentPalette.bg;
  const appContentColor = theme === 'Light' ? '#ffffff' : accentPalette.veil;
  const lockedCount = apps.filter((app) => app.locked).length;
  const visibleApps = useMemo(() => apps.filter((app) => app.name.toLowerCase().includes(search.toLowerCase())), [apps, search]);
  appsRef.current = apps;

  const persistProtectedApps = async (items: AppItem[]) => {
    const packageNames = items.filter((app) => app.locked).map((app) => app.packageName);
    await AsyncStorage.setItem(PROTECTED_APPS_KEY, JSON.stringify(packageNames));
    await setNativeProtectedApps(packageNames);
  };

  const toggleApp = (packageName: string) => setApps((current) => {
    const next = current.map((app) => app.packageName === packageName ? { ...app, locked: !app.locked } : app);
    void persistProtectedApps(next);
    return next;
  });

  const selectCommonWallpaper = async () => {
    if (pickingWallpaper) return;
    setPickingWallpaper(true);
    try {
      const uri = await pickAndStoreWallpaper('common');
      if (!uri) return;
      const previousUri = commonWallpaper;
      await AsyncStorage.setItem(COMMON_WALLPAPER_KEY, uri);
      await AsyncStorage.removeItem(APP_WALLPAPERS_KEY);
      setCommonWallpaper(uri);
      if (previousUri && previousUri !== uri) void deleteStoredWallpaper(previousUri);
    } catch (error) {
      Alert.alert('Unable to set wallpaper', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setPickingWallpaper(false);
    }
  };

  const removeCommonWallpaper = async () => {
    if (!commonWallpaper) return;
    await AsyncStorage.removeItem(COMMON_WALLPAPER_KEY);
    setCommonWallpaper(null);
    void deleteStoredWallpaper(commonWallpaper);
  };

  const selectAccent = (name: string) => {
    setAccent(name);
    void AsyncStorage.setItem(ACCENT_COLOR_KEY, name);
  };

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(ACCENT_COLOR_KEY)
      .then((stored) => {
        if (active && stored && accentNames.includes(stored as AccentName)) setAccent(stored);
      })
      .catch((error) => console.error('Unable to load accent colour', error));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([AsyncStorage.getItem(COMMON_WALLPAPER_KEY), AsyncStorage.getItem(APP_WALLPAPERS_KEY)])
      .then(([storedCommon, legacyWallpapers]) => {
        if (!active) return;
        if (storedCommon) {
          setCommonWallpaper(storedCommon);
          return;
        }
        if (!legacyWallpapers) return;
        const parsed = JSON.parse(legacyWallpapers) as Record<string, string>;
        const firstWallpaper = Object.values(parsed).find(Boolean);
        if (!firstWallpaper) return;
        setCommonWallpaper(firstWallpaper);
        void AsyncStorage.setItem(COMMON_WALLPAPER_KEY, firstWallpaper);
        void AsyncStorage.removeItem(APP_WALLPAPERS_KEY);
      })
      .catch((error) => console.error('Unable to load wallpaper settings', error));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    void getAppIcon(SELF_PACKAGE).then((icon) => {
      if (icon) setSelfAppItem({ ...SELF_APP, icon });
    });
  }, []);

  const refreshUsageStats = async () => {
    if (!usageAccessGranted) return;
    setUsageLoading(true);
    try {
      setUsageStats(await getAppUsage(7));
    } catch (error) {
      console.error('Unable to load app usage statistics', error);
      setUsageStats([]);
    } finally {
      setUsageLoading(false);
    }
  };

  useEffect(() => {
    void refreshUsageStats();
  }, [usageAccessGranted, lockedCount]);

  useEffect(() => {
    const syncNativeState = async () => {
      try {
        const status = await getAppLockPermissionStatus();
        const pendingPackage = await consumePendingLockPackage();
        if (pendingPackage) setPendingLockedPackage(pendingPackage);
        setOverlayPermission(status.overlay);
        setUsageAccessGranted(status.usageAccess);
        setProtectionActive(status.protectionActive);
        setNotificationPermission(await checkNotificationPermission());
      } catch (error) {
        console.error('Unable to read native app lock state', error);
      }
    };

    void syncNativeState();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (selfLockArmedRef.current && !selfLockSatisfiedRef.current && !lockedAppRef.current) {
          setLockTriggeredBySystem(false);
          setLockedApp(SELF_APP);
        }
        void syncNativeState();
      } else {
        selfLockSatisfiedRef.current = false;
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!pendingLockedPackage) return;
    const app = appsRef.current.find((item) => item.packageName === pendingLockedPackage);
    if (!app) return;
    setLockedApp({ ...app, locked: true });
    setLockTriggeredBySystem(true);
    setPendingLockedPackage(null);
  }, [pendingLockedPackage, apps.length]);

  // The monitor can request a lock while Screen Guard is already in the foreground, in which
  // case Android never fires an AppState change and the request would stay unconsumed.
  useEffect(() => {
    if (!setupComplete) return;
    let cancelled = false;
    const drainPendingLock = async () => {
      const packageName = await consumePendingLockPackage();
      if (!cancelled && packageName) setPendingLockedPackage(packageName);
    };
    void drainPendingLock();
    const timer = setInterval(() => { void drainPendingLock(); }, 700);
    return () => { cancelled = true; clearInterval(timer); };
  }, [setupComplete]);

  // Protection arms itself once both permissions exist, so locking keeps working without a
  // manual "start" control.
  useEffect(() => {
    if (!setupComplete || !overlayPermission || !usageAccessGranted || protectionActive) return;
    void startAppLockProtection()
      .then(() => setProtectionActive(true))
      .catch(() => setProtectionActive(false));
  }, [setupComplete, overlayPermission, usageAccessGranted, protectionActive]);

  useEffect(() => {
    if (lockedApp) void hideLockOverlay();
  }, [lockedApp]);

  useEffect(() => {
    if (!setupComplete) return;
    selfLockArmedRef.current = true;
    if (!selfLockSatisfiedRef.current) {
      setLockTriggeredBySystem(false);
      setLockedApp(SELF_APP);
    }
  }, [setupComplete]);

  useEffect(() => {
    const loadLockSettings = async () => {
      try {
        let storedDeviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
        if (!storedDeviceId) {
          storedDeviceId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
          await AsyncStorage.setItem(DEVICE_ID_KEY, storedDeviceId);
        }
        setDeviceId(storedDeviceId);

        const storedMethod = await AsyncStorage.getItem(CREDENTIAL_METHOD_KEY) as LockMethod | null;
        const legacyCredential = await AsyncStorage.getItem(LEGACY_CREDENTIAL_VALUE_KEY);
        let localMethod = await getLocalLockMethod();

        if (legacyCredential) {
          if (!localMethod && storedMethod) {
            await createLocalLockCredential(storedMethod, legacyCredential);
            localMethod = storedMethod;
          }
          await AsyncStorage.removeItem(LEGACY_CREDENTIAL_VALUE_KEY);
        }

        if (localMethod) {
          setMethod(localMethod);
          setSetupComplete(true);
        }

        void getLockSettings(storedDeviceId)
          .then((remoteSettings) => {
            setRemoteSyncAvailable(true);
            if (!localMethod && remoteSettings) setMethod(remoteSettings.method);
          })
          .catch(() => setRemoteSyncAvailable(false));
      } catch (error) {
        console.error('Unable to load local lock settings', error);
        setSetupComplete(await hasLocalLockCredential());
      }
    };
    void loadLockSettings();

    let active = true;
    getInstalledApps()
      .then(async (installedApps) => {
        if (!active) return;

        const [storedProtectedApps, nativeProtectedApps] = await Promise.all([
          AsyncStorage.getItem(PROTECTED_APPS_KEY),
          getNativeProtectedApps(),
        ]);

        const protectedPackages = new Set<string>(nativeProtectedApps);
        if (storedProtectedApps) {
          try {
            const parsed = JSON.parse(storedProtectedApps) as string[];
            if (Array.isArray(parsed)) parsed.forEach((packageName) => protectedPackages.add(packageName));
          } catch {
            await AsyncStorage.removeItem(PROTECTED_APPS_KEY);
          }
        }

        const hydratedApps = installedApps.map((app, index) => ({
          ...toAppItem(app, index),
          locked: protectedPackages.has(app.packageName),
        }));

        setApps(hydratedApps);
        void setNativeProtectedApps(Array.from(protectedPackages));
      })
      .catch((error) => console.error('Unable to load installed apps', error))
      .finally(() => {
        if (active) setLoadingApps(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const finishSetup = async (value: string) => {
    await createLocalLockCredential(method, value);
    await AsyncStorage.setItem(CREDENTIAL_METHOD_KEY, method);
    await AsyncStorage.setItem(SETUP_COMPLETE_KEY, 'true');
    await AsyncStorage.removeItem(LEGACY_CREDENTIAL_VALUE_KEY);
    await clearSessionUnlock();
    selfLockSatisfiedRef.current = true;
    setSetupComplete(true);
    setSetupStep('choose');
  };

  const resetPassword = async () => {
    if (resettingPassword) return;

    setResettingPassword(true);
    try {
      await deleteLocalLockCredential();
      await AsyncStorage.multiRemove([CREDENTIAL_METHOD_KEY, LEGACY_CREDENTIAL_VALUE_KEY, SETUP_COMPLETE_KEY]);
      await clearSessionUnlock();
      setMethod('Fingerprint');
      setSetupStep('choose');
      selfLockSatisfiedRef.current = false;
      setSetupComplete(false);
      setLockedApp(null);
      setTab('Home');
      setRemoteSyncAvailable(null);
      if (deviceId) {
        void deleteLockCredential(deviceId)
          .then(() => setRemoteSyncAvailable(true))
          .catch(() => setRemoteSyncAvailable(false));
      }
      Alert.alert('Password removed', 'Choose Fingerprint, Pattern, or PIN to set a new lock.');
    } catch (error) {
      Alert.alert('Unable to reset password', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setResettingPassword(false);
    }
  };

  const confirmPasswordReset = () => {
    Alert.alert(
      'Reset password?',
      'This removes the current lock from this device and returns to the lock-type selection screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: () => { void resetPassword(); } },
      ],
    );
  };

  const openOverlayPermissionSettings = async () => {
    try {
      await openOverlaySettings();
    } catch (error) {
      Alert.alert('Unable to open settings', error instanceof Error ? error.message : 'Enable Display over other apps manually.');
    }
  };

  const openUsagePermissionSettings = async () => {
    try {
      await openUsageAccessSettings();
    } catch (error) {
      Alert.alert('Unable to open settings', error instanceof Error ? error.message : 'Enable Usage access manually.');
    }
  };

  const askNotificationPermission = async () => {
    setNotificationPermission(await requestNotificationPermission());
  };

  const changeTab = (nextTab: Tab) => {
    if (lockedApp) setLockedApp(null);
    setTab(nextTab);
  };

  const renderSetupFlow = () => (
    setupStep === 'choose'
      ? <SetupScreen method={method} setMethod={setMethod} themeColors={themeColors} onContinue={() => setSetupStep('validate')} />
      : <CredentialSetupScreen method={method} themeColors={themeColors} onComplete={finishSetup} onBack={() => setSetupStep('choose')} />
  );

  const renderMainContent = () => {
    switch (tab) {
      case 'Statistics':
        return <StatisticsScreen apps={apps} usage={usageStats} loading={usageLoading} themeColors={themeColors} />;
      case 'Settings':
        return <SettingsScreen method={method} theme={theme} setTheme={setTheme} accent={accent} setAccent={selectAccent} themeColors={themeColors} backgroundColor={appBackgroundColor} lockedApps={apps.filter((app) => app.locked)} commonWallpaper={commonWallpaper} pickingWallpaper={pickingWallpaper} onSelectWallpaper={selectCommonWallpaper} onRemoveWallpaper={removeCommonWallpaper} remoteSyncAvailable={remoteSyncAvailable} overlayPermission={overlayPermission} usageAccessGranted={usageAccessGranted} onOpenOverlaySettings={openOverlayPermissionSettings} onOpenUsageSettings={openUsagePermissionSettings} resettingPassword={resettingPassword} onResetPassword={confirmPasswordReset} />;
      case 'Home':
      default:
        return <AppsScreen apps={visibleApps} totalCount={apps.length} lockedCount={lockedCount} loading={loadingApps} search={search} setSearch={setSearch} themeColors={themeColors} onToggle={toggleApp} onOpen={(app) => { setLockTriggeredBySystem(false); setLockedApp(app); }} />;
    }
  };

  if (lockedApp) return <LockScreen app={lockedApp.packageName === SELF_PACKAGE ? selfAppItem : lockedApp} method={method} themeColors={themeColors} backgroundColor={appBackgroundColor} onColor={accentPalette.on} wallpaperUri={commonWallpaper ?? undefined} onUnlock={async () => { if (lockedApp.packageName === SELF_PACKAGE) { selfLockSatisfiedRef.current = true; setLockedApp(null); return; } try { await openProtectedApp(lockedApp.packageName); } catch (error) { Alert.alert('Unable to open app', error instanceof Error ? error.message : 'The selected app could not be opened.'); } finally { setLockTriggeredBySystem(false); setLockedApp(null); } }} onClose={() => { void clearSessionUnlock(); if (lockTriggeredBySystem || lockedApp.packageName === SELF_PACKAGE) void dismissLockOverlay(); setLockTriggeredBySystem(false); setLockedApp(null); }} />;

  return <SafeAreaView style={[styles.safe, { backgroundColor: appBackgroundColor }]}><StatusBar barStyle={theme === 'Light' ? 'dark-content' : 'light-content'} backgroundColor={appBackgroundColor} />
    <View style={{ flex: 1, backgroundColor: appContentColor }}>
      {setupComplete ? <>
        {renderMainContent()}
        <BottomNav tab={tab} onChange={changeTab} themeColors={themeColors} />
      </> : <>
        {tab === 'Home' ? renderSetupFlow() : renderMainContent()}
        <BottomNav tab={tab} onChange={changeTab} themeColors={themeColors} />
      </>}
    </View>
    {setupComplete && !permissionModalDismissed && (!overlayPermission || !usageAccessGranted || !notificationPermission) ? (
      <PermissionSetupModal
        overlayPermission={overlayPermission}
        usageAccessGranted={usageAccessGranted}
        notificationPermission={notificationPermission}
        onOpenOverlay={openOverlayPermissionSettings}
        onOpenUsage={openUsagePermissionSettings}
        onRequestNotification={askNotificationPermission}
        onDismiss={() => setPermissionModalDismissed(true)}
      />
    ) : null}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
