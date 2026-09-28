import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Image, ImageBackground, PanResponder, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { checkNotificationPermission, clearSessionUnlock, consumePendingLockPackage, dismissLockOverlay, getAppIcon, getAppLockPermissionStatus, getAppUsage, getNativeProtectedApps, hideLockOverlay, openOverlaySettings, openProtectedApp, openUsageAccessSettings, requestNotificationPermission, setNativeProtectedApps, startAppLockProtection, stopAppLockProtection, type AppUsageStat } from '../../services/native/appLock';
import { getInstalledApps, launchInstalledApp } from '../../services/native/installedApps';
import { deleteLockCredential, getLockSettings } from '../../services/api';
import { createLocalLockCredential, deleteLocalLockCredential, getLocalLockMethod, hasLocalLockCredential, verifyLocalLockCredential } from '../../services/lockCredentials';
import { deleteStoredWallpaper, pickAndStoreWallpaper } from '../../services/wallpapers';
import type { LockMethod } from '../../types';
import { screenGuardColors } from '../../theme';

type Tab = 'Home' | 'Statistics' | 'Settings';
type SetupStep = 'choose' | 'validate';
type AppItem = { name: string; packageName: string; icon: string; color: string; mark: string; locked: boolean };

const lockMethods: LockMethod[] = ['Fingerprint', 'Pattern', 'PIN'];
const appColors = ['#25d366', '#d6249f', '#4267e8', '#159b9b', '#f5c342', '#2aabee'];
const CREDENTIAL_METHOD_KEY = '@screen-guard/method';
const LEGACY_CREDENTIAL_VALUE_KEY = '@screen-guard/credential';
const DEVICE_ID_KEY = '@screen-guard/device-id';
const SETUP_COMPLETE_KEY = '@screen-guard/setup-complete';
const APP_WALLPAPERS_KEY = '@screen-guard/app-wallpapers';
const COMMON_WALLPAPER_KEY = '@screen-guard/common-wallpaper';
const PROTECTED_APPS_KEY = '@screen-guard/protected-apps';

type ThemePalette = { readonly bg: string; readonly panel: string; readonly border: string; readonly text: string; readonly muted: string; readonly teal: string; readonly danger: string };
type WallpaperPalette = { readonly bg: string; readonly accent: string; readonly glow: string };

const themePalettes = {
  Dark: { bg: '#020b1b', panel: '#081525', border: '#203149', text: '#f5f7fb', muted: '#aeb7c9', teal: '#26e4d5', danger: '#ff5261' },
  Light: { bg: '#ffffff', panel: '#f8fbff', border: '#d7e5f8', text: '#12233a', muted: '#5f728d', teal: '#0a918f', danger: '#d93666' },
  System: { bg: '#0f172a', panel: '#182538', border: '#2b3d57', text: '#edf7ff', muted: '#b5c3d7', teal: '#5fe5d1', danger: '#ff6b81' },
} as const satisfies Record<string, ThemePalette>;

const wallpaperPalettes = {
  'Night Glow': { bg: '#020b1b', accent: '#26e4d5', glow: 'rgba(38, 228, 213, 0.12)' },
  Ocean: { bg: '#071b2a', accent: '#5cc8ff', glow: 'rgba(92, 200, 255, 0.12)' },
  Minimal: { bg: '#111827', accent: '#c4b5fd', glow: 'rgba(196, 181, 253, 0.12)' },
} as const satisfies Record<string, WallpaperPalette>;

const PATTERN_SIZE = 270;
const PATTERN_DOT_SIZE = 58;
const PATTERN_DOT_INSET = 16;
const PATTERN_DOT_STEP = 90;
const PATTERN_POINT_RADIUS = 38;
const PATTERN_POINTS = Array.from({ length: 9 }, (_, index) => ({
  x: PATTERN_DOT_INSET + (index % 3) * PATTERN_DOT_STEP + PATTERN_DOT_SIZE / 2,
  y: PATTERN_DOT_INSET + Math.floor(index / 3) * PATTERN_DOT_STEP + PATTERN_DOT_SIZE / 2,
}));

const SELF_PACKAGE = 'com.screenguard';
const SELF_APP: AppItem = { name: 'Screen Guard', packageName: SELF_PACKAGE, icon: '', color: '#26e4d5', mark: 'S', locked: true };

function PermissionSetupModal({ overlayPermission, usageAccessGranted, notificationPermission, onOpenOverlay, onOpenUsage, onRequestNotification, onDismiss }: { overlayPermission: boolean; usageAccessGranted: boolean; notificationPermission: boolean; onOpenOverlay: () => void; onOpenUsage: () => void; onRequestNotification: () => void; onDismiss: () => void }) {
  return (
    <View style={styles.modalBackdrop}>
      <View style={styles.modalCard}>
        <Text style={styles.modalTitle}>Finish Screen Guard setup</Text>
        <Text style={styles.modalText}>These permissions let Screen Guard show your lock before a protected app opens. Android requires you to approve each one.</Text>

        <View style={styles.modalRow}>
          <View style={styles.modalRowCopy}><Text style={styles.modalRowTitle}>Display over other apps</Text><Text style={styles.modalRowText}>Shows the lock overlay above other apps.</Text></View>
          {overlayPermission ? <Text style={styles.modalGranted}>Granted</Text> : <Pressable onPress={onOpenOverlay} style={styles.modalButton}><Text style={styles.modalButtonText}>Allow</Text></Pressable>}
        </View>

        <View style={styles.modalRow}>
          <View style={styles.modalRowCopy}><Text style={styles.modalRowTitle}>Usage access</Text><Text style={styles.modalRowText}>Lets Screen Guard know which app is in front.</Text></View>
          {usageAccessGranted ? <Text style={styles.modalGranted}>Granted</Text> : <Pressable onPress={onOpenUsage} style={styles.modalButton}><Text style={styles.modalButtonText}>Allow</Text></Pressable>}
        </View>

        <View style={styles.modalRow}>
          <View style={styles.modalRowCopy}><Text style={styles.modalRowTitle}>Notifications</Text><Text style={styles.modalRowText}>Shows the active protection monitor notification.</Text></View>
          {notificationPermission ? <Text style={styles.modalGranted}>Granted</Text> : <Pressable onPress={onRequestNotification} style={styles.modalButton}><Text style={styles.modalButtonText}>Allow</Text></Pressable>}
        </View>

        <Pressable onPress={onDismiss} style={styles.modalDismiss}><Text style={styles.modalDismissText}>Not now</Text></Pressable>
      </View>
    </View>
  );
}

function BottomNav({ tab, onChange, themeColors }: { tab: Tab; onChange: (value: Tab) => void; themeColors: ThemePalette }) {
  return (
    <View style={[styles.bottom, { backgroundColor: themeColors.bg, borderTopColor: themeColors.border }]}>
      {(['Home', 'Statistics', 'Settings'] as Tab[]).map((item) => (
        <Pressable
          key={item}
          accessibilityRole="button"
          style={styles.nav}
          hitSlop={10}
          onPress={() => onChange(item)}
        >
          <Text style={[styles.navIcon, { color: themeColors.muted }, tab === item && { color: themeColors.teal }]}>{item === 'Home' ? '⌂' : item === 'Statistics' ? '▥' : '⚙'}</Text>
          <Text style={[styles.navLabel, { color: themeColors.muted }, tab === item && { color: themeColors.teal }]}>{item}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function toAppItem(app: { name: string; packageName: string; icon: string }, index: number): AppItem {
  return { ...app, color: appColors[index % appColors.length], mark: app.name.charAt(0).toUpperCase(), locked: false };
}

export function Navigation() {
  const [tab, setTab] = useState<Tab>('Home');
  const [setupComplete, setSetupComplete] = useState(false);
  const [setupStep, setSetupStep] = useState<SetupStep>('choose');
  const [method, setMethod] = useState<LockMethod>('Fingerprint');
  const [deviceId, setDeviceId] = useState('');
  const [apps, setApps] = useState<AppItem[]>([]);
  const [search, setSearch] = useState('');
  const [lockedApp, setLockedApp] = useState<AppItem | null>(null);
  const [loadingApps, setLoadingApps] = useState(true);
  const [theme, setTheme] = useState<'Dark' | 'Light' | 'System'>('Dark');
  const [wallpaper, setWallpaper] = useState<'Night Glow' | 'Ocean' | 'Minimal'>('Night Glow');
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
  const wallpaperColors = wallpaperPalettes[wallpaper];
  const appBackgroundColor = theme === 'Light' ? '#ffffff' : wallpaperColors.bg;
  const appContentColor = theme === 'Light' ? '#ffffff' : wallpaperColors.glow;
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
        if (selfLockArmedRef.current && !selfLockSatisfiedRef.current && !lockedApp) {
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

  useEffect(() => {
    if (lockedApp) void hideLockOverlay();
  }, [lockedApp]);

  useEffect(() => {
    if (setupComplete) selfLockArmedRef.current = true;
  }, [setupComplete]);

  useEffect(() => {
    if (setupComplete && selfLockArmedRef.current && !selfLockSatisfiedRef.current) {
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
      setMethod('Fingerprint');
      setSetupStep('choose');
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

  const toggleProtection = async () => {
    try {
      if (protectionActive) {
        await stopAppLockProtection();
        setProtectionActive(false);
      } else {
        await startAppLockProtection();
        setProtectionActive(true);
      }
    } catch (error) {
      Alert.alert('Unable to start protection', error instanceof Error ? error.message : 'Please grant both permissions first.');
      const status = await getAppLockPermissionStatus();
      setOverlayPermission(status.overlay);
      setUsageAccessGranted(status.usageAccess);
      setProtectionActive(status.protectionActive);
    }
  };

  const askNotificationPermission = async () => {
    setNotificationPermission(await requestNotificationPermission());
  };

  const testAppLockProtection = async () => {
    if (!protectionActive) {
      Alert.alert('Start protection first', 'Grant Display over other apps and Usage access, then turn protection on.');
      return;
    }
    const app = appsRef.current.find((item) => item.locked);
    if (!app) {
      Alert.alert('No protected app', 'Enable protection for at least one app before running the test.');
      return;
    }
    try {
      await launchInstalledApp(app.packageName);
    } catch (error) {
      Alert.alert('Test failed', error instanceof Error ? error.message : 'Unable to open the protected app.');
    }
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
        return <StatisticsScreen apps={apps} usage={usageStats} loading={usageLoading} themeColors={themeColors} onRefresh={refreshUsageStats} />;
      case 'Settings':
        return <SettingsScreen method={method} theme={theme} setTheme={setTheme} wallpaper={wallpaper} setWallpaper={setWallpaper} themeColors={themeColors} backgroundColor={appBackgroundColor} lockedApps={apps.filter((app) => app.locked)} commonWallpaper={commonWallpaper} pickingWallpaper={pickingWallpaper} onSelectWallpaper={selectCommonWallpaper} onRemoveWallpaper={removeCommonWallpaper} remoteSyncAvailable={remoteSyncAvailable} overlayPermission={overlayPermission} usageAccessGranted={usageAccessGranted} protectionActive={protectionActive} onOpenOverlaySettings={openOverlayPermissionSettings} onOpenUsageSettings={openUsagePermissionSettings} onToggleProtection={toggleProtection} onTestProtection={() => { void testAppLockProtection(); }} resettingPassword={resettingPassword} onResetPassword={confirmPasswordReset} onBack={() => setTab('Home')} />;
      case 'Home':
      default:
        return <AppsScreen apps={visibleApps} totalCount={apps.length} lockedCount={lockedCount} loading={loadingApps} search={search} setSearch={setSearch} themeColors={themeColors} overlayPermission={overlayPermission} usageAccessGranted={usageAccessGranted} protectionActive={protectionActive} onOpenOverlaySettings={openOverlayPermissionSettings} onOpenUsageSettings={openUsagePermissionSettings} onToggleProtection={toggleProtection} onTestProtection={() => { void testAppLockProtection(); }} onToggle={toggleApp} onOpen={(app) => { setLockTriggeredBySystem(false); setLockedApp(app); }} />;
    }
  };

  if (lockedApp) return <LockScreen app={lockedApp.packageName === SELF_PACKAGE ? selfAppItem : lockedApp} method={method} themeColors={themeColors} wallpaperUri={commonWallpaper ?? undefined} onUnlock={async () => { if (lockedApp.packageName === SELF_PACKAGE) { selfLockSatisfiedRef.current = true; setLockedApp(null); return; } try { await openProtectedApp(lockedApp.packageName); } catch (error) { Alert.alert('Unable to open app', error instanceof Error ? error.message : 'The selected app could not be opened.'); } finally { setLockTriggeredBySystem(false); setLockedApp(null); } }} onClose={() => { void clearSessionUnlock(); if (lockTriggeredBySystem || lockedApp.packageName === SELF_PACKAGE) void dismissLockOverlay(); setLockTriggeredBySystem(false); setLockedApp(null); }} />;

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

function SettingsScreen({ method, theme, setTheme, wallpaper, setWallpaper, themeColors, backgroundColor, lockedApps, commonWallpaper, pickingWallpaper, onSelectWallpaper, onRemoveWallpaper, remoteSyncAvailable, overlayPermission, usageAccessGranted, protectionActive, onOpenOverlaySettings, onOpenUsageSettings, onToggleProtection, onTestProtection, resettingPassword, onResetPassword, onBack }: { method: LockMethod; theme: 'Dark' | 'Light' | 'System'; setTheme: (value: 'Dark' | 'Light' | 'System') => void; wallpaper: 'Night Glow' | 'Ocean' | 'Minimal'; setWallpaper: (value: 'Night Glow' | 'Ocean' | 'Minimal') => void; themeColors: ThemePalette; backgroundColor: string; lockedApps: AppItem[]; commonWallpaper: string | null; pickingWallpaper: boolean; onSelectWallpaper: () => void; onRemoveWallpaper: () => void; remoteSyncAvailable: boolean | null; overlayPermission: boolean; usageAccessGranted: boolean; protectionActive: boolean; onOpenOverlaySettings: () => void; onOpenUsageSettings: () => void; onToggleProtection: () => void; onTestProtection: () => void; resettingPassword: boolean; onResetPassword: () => void; onBack: () => void }) {
  const themes: Array<'Dark' | 'Light' | 'System'> = ['Dark', 'Light', 'System'];
  const wallpapers: Array<'Night Glow' | 'Ocean' | 'Minimal'> = ['Night Glow', 'Ocean', 'Minimal'];

  return <SafeAreaView style={[styles.safe, { backgroundColor }]}><StatusBar barStyle={theme === 'Light' ? 'dark-content' : 'light-content'} backgroundColor={backgroundColor} />
    <ScrollView contentContainerStyle={[styles.settingsPage, { backgroundColor }]}>
      <View style={styles.settingsHeader}>
        <Pressable onPress={onBack}><Text style={[styles.link, { color: themeColors.teal }]}>← Back</Text></Pressable>
        <Text style={[styles.title, { color: themeColors.text }]}>Settings</Text>
      </View>

      <View style={[styles.settingsCard, { backgroundColor: themeColors.panel, borderColor: themeColors.border }]}> 
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Security</Text>
        <View style={[styles.settingsRow, { borderBottomColor: themeColors.border }]}>
          <Text style={[styles.appName, { color: themeColors.text }]}>Current lock</Text>
          <Text style={[styles.link, { color: themeColors.teal }]}>{method}</Text>
        </View>
        <View style={[styles.settingsRow, { borderBottomColor: themeColors.border }]}>
          <Text style={[styles.appName, { color: themeColors.text }]}>Local verification</Text>
          <Text style={[styles.link, { color: themeColors.teal }]}>On device</Text>
        </View>
        <View style={[styles.settingsRow, { borderBottomColor: themeColors.border }]}>
          <Text style={[styles.appName, { color: themeColors.text }]}>Backend connection</Text>
          <Text style={[styles.link, { color: remoteSyncAvailable === false ? themeColors.muted : themeColors.teal }]}>
            {remoteSyncAvailable === null ? 'Checking' : remoteSyncAvailable ? 'Connected' : 'Offline'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: resettingPassword }}
          disabled={resettingPassword}
          onPress={onResetPassword}
          style={[styles.resetButton, { borderColor: themeColors.danger, backgroundColor: themeColors.bg }]}
        >
          <Text style={[styles.resetButtonText, { color: themeColors.danger }]}>{resettingPassword ? 'Resetting...' : 'Reset password'}</Text>
        </Pressable>
        <Text style={[styles.infoText, { color: themeColors.muted }]}>PINs, patterns, and biometric verifiers stay in Android Keystore. The backend connection is optional and is never used to unlock an app.</Text>
      </View>

      <View style={[styles.settingsCard, { backgroundColor: themeColors.panel, borderColor: themeColors.border }]}> 
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>App lock protection</Text>
        <Pressable onPress={onOpenOverlaySettings} style={[styles.settingsRow, { borderBottomColor: themeColors.border }]}>
          <View>
            <Text style={[styles.appName, { color: themeColors.text }]}>Display over other apps</Text>
            <Text style={[styles.appState, { color: themeColors.muted }]}>Required for the lock overlay</Text>
          </View>
          <Text style={[styles.link, { color: overlayPermission ? themeColors.teal : themeColors.danger }]}>{overlayPermission ? 'Granted' : 'Grant'}</Text>
        </Pressable>
        <Pressable onPress={onOpenUsageSettings} style={[styles.settingsRow, { borderBottomColor: themeColors.border }]}>
          <View>
            <Text style={[styles.appName, { color: themeColors.text }]}>Usage access</Text>
            <Text style={[styles.appState, { color: themeColors.muted }]}>Used to know which app is in front</Text>
          </View>
          <Text style={[styles.link, { color: usageAccessGranted ? themeColors.teal : themeColors.danger }]}>{usageAccessGranted ? 'Granted' : 'Grant'}</Text>
        </Pressable>
        <View style={[styles.settingsRow, { borderBottomColor: themeColors.border }]}>
          <Text style={[styles.appName, { color: themeColors.text }]}>Protection monitor</Text>
          <Text style={[styles.link, { color: protectionActive ? themeColors.teal : themeColors.muted }]}>{protectionActive ? 'Active' : 'Stopped'}</Text>
        </View>
        <Text style={[styles.infoText, { color: themeColors.muted }]}>The monitor only reads the current foreground package name so it can show your lock screen. It does not read screen content.</Text>
        <View style={styles.protectionActions}>
          <Pressable onPress={!overlayPermission ? onOpenOverlaySettings : !usageAccessGranted ? onOpenUsageSettings : onToggleProtection} style={[styles.wallpaperAction, styles.protectionButton, { borderColor: themeColors.teal }]}>
            <Text style={[styles.wallpaperActionText, { color: themeColors.teal }]}>{!overlayPermission ? 'Grant overlay' : !usageAccessGranted ? 'Grant usage' : protectionActive ? 'Stop protection' : 'Start protection'}</Text>
          </Pressable>
          <Pressable onPress={onTestProtection} style={[styles.wallpaperAction, styles.protectionButton, { borderColor: themeColors.border }]}>
            <Text style={[styles.wallpaperActionText, { color: themeColors.muted }]}>Run test</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.settingsCard, { backgroundColor: themeColors.panel, borderColor: themeColors.border }]}> 
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Appearance</Text>
        {themes.map((option) => (
          <Pressable key={option} onPress={() => setTheme(option)} style={[styles.settingsRow, { borderBottomColor: themeColors.border }, theme === option && { backgroundColor: themeColors.bg, borderColor: themeColors.teal }]}>
            <Text style={[styles.appName, { color: themeColors.text }]}>{option} theme</Text>
            <Text style={[styles.link, { color: theme === option ? themeColors.teal : themeColors.muted }]}>{theme === option ? 'Active' : 'Use'}</Text>
          </Pressable>
        ))}
      </View>

      <View style={[styles.settingsCard, { backgroundColor: themeColors.panel, borderColor: themeColors.border }]}> 
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Wallpaper</Text>
        {wallpapers.map((option) => (
          <Pressable key={option} onPress={() => setWallpaper(option)} style={[styles.settingsRow, { borderBottomColor: themeColors.border }, wallpaper === option && { backgroundColor: themeColors.bg, borderColor: themeColors.teal }]}>
            <Text style={[styles.appName, { color: themeColors.text }]}>{option}</Text>
            <Text style={[styles.link, { color: wallpaper === option ? themeColors.teal : themeColors.muted }]}>{wallpaper === option ? 'Applied' : 'Apply'}</Text>
          </Pressable>
        ))}
      </View>

      <View style={[styles.settingsCard, { backgroundColor: themeColors.panel, borderColor: themeColors.border }]}> 
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Lock screen wallpaper</Text>
        <Text style={[styles.infoText, { color: themeColors.muted, marginBottom: 12 }]}>Choose one photo for every protected app. It appears on all Screen Guard lock screens.</Text>
        {commonWallpaper ? (
          <View style={[styles.wallpaperRow, { borderBottomColor: themeColors.border }]}>
            <Image source={{ uri: commonWallpaper }} style={styles.wallpaperThumbnail} />
            <View style={styles.wallpaperCopy}>
              <Text style={[styles.appName, { color: themeColors.text }]}>Shared wallpaper</Text>
              <Text style={[styles.appState, { color: themeColors.muted }]}>Applied to {lockedApps.length} protected {lockedApps.length === 1 ? 'app' : 'apps'}</Text>
              <View style={styles.wallpaperActions}>
                <Pressable disabled={pickingWallpaper} onPress={onSelectWallpaper} style={[styles.wallpaperAction, { borderColor: themeColors.teal }]}>
                  <Text style={[styles.wallpaperActionText, { color: themeColors.teal }]}>{pickingWallpaper ? 'Opening...' : 'Change'}</Text>
                </Pressable>
                <Pressable onPress={onRemoveWallpaper} style={[styles.wallpaperAction, { borderColor: themeColors.danger }]}>
                  <Text style={[styles.wallpaperActionText, { color: themeColors.danger }]}>Remove</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          <View style={[styles.wallpaperEmpty, { borderColor: themeColors.border, backgroundColor: themeColors.bg }]}>
            <Text style={[styles.appName, { color: themeColors.text }]}>No shared wallpaper</Text>
            <Text style={[styles.appState, { color: themeColors.muted }]}>Upload once and use it for every protected app.</Text>
            <Pressable disabled={pickingWallpaper} onPress={onSelectWallpaper} style={[styles.wallpaperAction, styles.protectionButton, { borderColor: themeColors.teal, marginTop: 12 }]}>
              <Text style={[styles.wallpaperActionText, { color: themeColors.teal }]}>{pickingWallpaper ? 'Opening...' : 'Choose photo'}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </ScrollView>
  </SafeAreaView>;
}

function SetupScreen({ method, setMethod, themeColors, onContinue }: { method: LockMethod; setMethod: (value: LockMethod) => void; themeColors: ThemePalette; onContinue: () => void }) {
  return (
    <View style={[styles.fill, { backgroundColor: themeColors.bg }]}>
      <ScrollView contentContainerStyle={[styles.setup, { backgroundColor: themeColors.bg }]}>
        <Text style={[styles.title, { color: themeColors.text }]}>Screen Lock</Text>
        <Text style={[styles.subtitle, { color: themeColors.muted }]}>Step 1 of 2  ·  Choose your lock</Text>
        <View style={[styles.progress, { backgroundColor: themeColors.border }]}><View style={[styles.progressFill, { backgroundColor: themeColors.teal }]} /></View>
        {lockMethods.map((option) => (
          <Pressable
            key={option}
            style={[
              styles.methodCard,
              { backgroundColor: themeColors.panel, borderColor: themeColors.border },
              method === option && { backgroundColor: themeColors.bg, borderColor: themeColors.teal },
            ]}
            onPress={() => setMethod(option)}
          >
            <Text style={[styles.bigIcon, { color: themeColors.text, backgroundColor: themeColors.border }]}>{option === 'Fingerprint' ? '◉' : option === 'Pattern' ? '⠿' : '••••'}</Text>
            <View style={styles.methodCopy}>
              <Text style={[styles.methodTitle, { color: themeColors.text }]}>{option}{option === 'Fingerprint' && <Text style={[styles.recommended, { color: themeColors.teal }]}>  Recommended</Text>}</Text>
              <Text style={[styles.methodDescription, { color: themeColors.muted }]}>{option === 'Fingerprint' ? 'Unlock instantly with your finger' : option === 'Pattern' ? 'Drag between at least four dots' : '4-digit numeric code'}</Text>
            </View>
            <View style={[styles.radio, { borderColor: themeColors.muted }, method === option && { borderColor: themeColors.teal, backgroundColor: themeColors.teal }]} />
          </Pressable>
        ))}
        <Text style={[styles.note, { color: themeColors.muted }]}>You can change this anytime</Text>
      </ScrollView>
      <Pressable style={[styles.continue, { borderColor: themeColors.teal }]} onPress={onContinue}><Text style={[styles.tealText, { color: themeColors.teal }]}>Continue</Text><Text style={[styles.arrow, { color: themeColors.teal }]}>→</Text></Pressable>
    </View>
  );
}

function HomeScreen({ lockedCount, onApps }: { lockedCount: number; onApps: () => void }) {
  return <ScrollView contentContainerStyle={styles.home}>
    <Text style={styles.eyebrow}>SCREEN GUARD</Text>
    <Text style={styles.title}>Screen Lock</Text>
    <Text style={styles.subtitle}>Keep private apps behind one simple lock.</Text>
    <View style={styles.homePanel}>
      <View>
        <Text style={styles.statValue}>{lockedCount}</Text>
        <Text style={styles.statLabel}>apps locked</Text>
      </View>
    </View>
    <View style={styles.infoCard}>
      <Text style={styles.infoTitle}>Why a screen lock matters</Text>
      <Text style={styles.infoText}>A screen lock adds a quick barrier against unwanted access, accidental taps, and prying eyes. It helps protect personal messages, photos, banking apps, and sensitive data when your device is left unattended.</Text>
    </View>
    <Pressable style={styles.primary} onPress={onApps}><Text style={styles.tealText}>Manage protected apps</Text><Text style={styles.arrow}>→</Text></Pressable>
  </ScrollView>;
}
function AppsScreen({ apps, totalCount, lockedCount, loading, search, setSearch, themeColors, overlayPermission, usageAccessGranted, protectionActive, onOpenOverlaySettings, onOpenUsageSettings, onToggleProtection, onTestProtection, onToggle, onOpen }: { apps: AppItem[]; totalCount: number; lockedCount: number; loading: boolean; search: string; setSearch: (value: string) => void; themeColors: ThemePalette; overlayPermission: boolean; usageAccessGranted: boolean; protectionActive: boolean; onOpenOverlaySettings: () => void; onOpenUsageSettings: () => void; onToggleProtection: () => void; onTestProtection: () => void; onToggle: (packageName: string) => void; onOpen: (app: AppItem) => void }) {
  return (
    <ScrollView contentContainerStyle={[styles.list, { backgroundColor: themeColors.bg }]} keyboardShouldPersistTaps="handled">
      <View style={[styles.appsHero, { backgroundColor: themeColors.panel, borderColor: themeColors.border }]}>
        <View style={styles.appsHeroCopy}>
          <Text style={[styles.appsHeroTitle, { color: themeColors.text }]}>Protected apps</Text>
          <Text style={[styles.appsHeroSubtitle, { color: themeColors.muted }]}>Choose which apps require your lock.</Text>
        </View>
        <View style={[styles.appsCountBadge, { backgroundColor: themeColors.bg, borderColor: themeColors.teal }]}>
          <Text style={[styles.appsCountValue, { color: themeColors.teal }]}>{lockedCount}</Text>
          <Text style={[styles.appsCountLabel, { color: themeColors.muted }]}>locked</Text>
        </View>
      </View>

      <View style={[styles.protectionBanner, { backgroundColor: themeColors.panel, borderColor: protectionActive ? themeColors.teal : themeColors.danger }]}>
        <View style={styles.protectionBannerCopy}>
          <Text style={[styles.protectionBannerTitle, { color: themeColors.text }]}>{protectionActive ? 'System protection is on' : 'Finish setup to protect apps'}</Text>
          <Text style={[styles.protectionBannerText, { color: themeColors.muted }]}>
            {!overlayPermission
              ? 'Allow Screen Guard to display over other apps.'
              : !usageAccessGranted
                ? 'Allow usage access so Screen Guard knows which app is in front.'
                : 'Start protection so protected apps require your lock before opening.'}
          </Text>
        </View>
        <View style={styles.protectionBannerActions}>
          {!overlayPermission ? (
            <Pressable onPress={onOpenOverlaySettings} style={[styles.wallpaperAction, { borderColor: themeColors.teal }]}>
              <Text style={[styles.wallpaperActionText, { color: themeColors.teal }]}>Allow overlay</Text>
            </Pressable>
          ) : !usageAccessGranted ? (
            <Pressable onPress={onOpenUsageSettings} style={[styles.wallpaperAction, { borderColor: themeColors.teal }]}>
              <Text style={[styles.wallpaperActionText, { color: themeColors.teal }]}>Allow usage</Text>
            </Pressable>
          ) : (
            <Pressable onPress={onToggleProtection} style={[styles.wallpaperAction, { borderColor: themeColors.teal }]}>
              <Text style={[styles.wallpaperActionText, { color: themeColors.teal }]}>{protectionActive ? 'Stop' : 'Start'}</Text>
            </Pressable>
          )}
          <Pressable onPress={onTestProtection} style={[styles.wallpaperAction, { borderColor: themeColors.border }]}>
            <Text style={[styles.wallpaperActionText, { color: themeColors.muted }]}>Test</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.searchWrap, { backgroundColor: themeColors.panel, borderColor: themeColors.border }]}>
        <Text style={[styles.searchGlyph, { color: themeColors.teal }]}>⌕</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search installed apps"
          placeholderTextColor={themeColors.muted}
          style={[styles.search, { color: themeColors.text }]}
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      <Text style={[styles.listLabel, { color: themeColors.muted }]}>{lockedCount} of {totalCount} apps protected</Text>

      {loading ? (
        <View style={[styles.emptyState, { backgroundColor: themeColors.panel, borderColor: themeColors.border }]}><Text style={[styles.package, { color: themeColors.muted }]}>Loading installed apps...</Text></View>
      ) : apps.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: themeColors.panel, borderColor: themeColors.border }]}><Text style={[styles.emptyTitle, { color: themeColors.text }]}>No apps found</Text><Text style={[styles.package, { color: themeColors.muted }]}>{search ? 'Try a different search term.' : 'No launchable apps are available on this device.'}</Text></View>
      ) : (
        <View style={[styles.appListCard, { backgroundColor: themeColors.panel, borderColor: themeColors.border }]}>
          {apps.map((app) => (
            <View key={app.packageName} style={[styles.appListRow, app.locked && { backgroundColor: themeColors.bg, borderColor: themeColors.teal }]}>
              <Pressable onPress={() => app.locked && onOpen(app)} style={styles.appContent} accessibilityRole={app.locked ? 'button' : undefined}>
                {app.icon ? (
                  <Image source={{ uri: app.icon }} style={[styles.appIcon, { backgroundColor: themeColors.border }]} />
                ) : (
                  <View style={[styles.appIcon, styles.activityIcon, { backgroundColor: themeColors.border }]}><Text style={[styles.appMark, { color: themeColors.text }]}>{app.mark}</Text></View>
                )}
                <View style={styles.appCopy}>
                  <Text style={[styles.appName, { color: themeColors.text }]} numberOfLines={1}>{app.name}</Text>
                  <Text style={[styles.appState, { color: themeColors.muted }]}>{app.locked ? 'Protection enabled' : 'Not protected'}</Text>
                </View>
              </Pressable>
              <Pressable
                accessibilityRole="switch"
                accessibilityLabel={`${app.locked ? 'Disable' : 'Enable'} lock for ${app.name}`}
                accessibilityState={{ checked: app.locked }}
                style={[styles.switch, { backgroundColor: themeColors.border }, app.locked && { backgroundColor: themeColors.teal }]}
                onPress={() => onToggle(app.packageName)}
              >
                <View style={[styles.thumb, { backgroundColor: themeColors.text }, app.locked && { backgroundColor: themeColors.bg }]} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function formatDuration(millis: number): string {
  const totalMinutes = Math.round(millis / 60000);
  if (totalMinutes < 1) return '<1m';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function StatisticsScreen({ apps, usage, loading, themeColors, onRefresh }: { apps: AppItem[]; usage: AppUsageStat[]; loading: boolean; themeColors: ThemePalette; onRefresh: () => void }) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const days = usage[0]?.daily ?? [];
  const totalsByDay = days.map((_, dayIndex) => usage.reduce((sum, stat) => sum + (stat.daily[dayIndex]?.millis ?? 0), 0));
  const totalMillis = usage.reduce((sum, stat) => sum + stat.totalMillis, 0);
  const maxDay = Math.max(...totalsByDay, 1);
  const visibleTotal = selectedDay === null ? totalMillis : (totalsByDay[selectedDay] ?? 0);
  const topStat = selectedDay === null
    ? usage[0]
    : usage.reduce<AppUsageStat | undefined>((best, stat) => {
      const bestValue = best?.daily[selectedDay]?.millis ?? -1;
      return (stat.daily[selectedDay]?.millis ?? 0) > bestValue ? stat : best;
    }, undefined);
  const topApp = apps.find((app) => app.packageName === topStat?.packageName);
  const averageMillis = days.length > 0 ? totalMillis / days.length : 0;

  return (
    <ScrollView contentContainerStyle={[styles.activity, { backgroundColor: themeColors.bg }]}>
      <View style={styles.header}>
        <View style={styles.statisticsHeaderRow}>
          <Text style={[styles.title, { color: themeColors.text }]}>Usage statistics</Text>
          <Pressable onPress={onRefresh} style={[styles.wallpaperAction, { borderColor: themeColors.border }]}>
            <Text style={[styles.wallpaperActionText, { color: themeColors.muted }]}>Refresh</Text>
          </Pressable>
        </View>
        <Text style={[styles.subtitle, { color: themeColors.muted }]}>Daily foreground time for all apps over the last 7 days.</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daySelector}>
        <Pressable onPress={() => setSelectedDay(null)} style={[styles.dayChip, { backgroundColor: themeColors.panel, borderColor: themeColors.border }, selectedDay === null && { backgroundColor: themeColors.bg, borderColor: themeColors.teal }]}>
          <Text style={[styles.dayChipText, { color: selectedDay === null ? themeColors.teal : themeColors.muted }]}>All 7 days</Text>
        </Pressable>
        {days.map((day, dayIndex) => (
          <Pressable key={day.date} onPress={() => setSelectedDay(dayIndex)} style={[styles.dayChip, { backgroundColor: themeColors.panel, borderColor: themeColors.border }, selectedDay === dayIndex && { backgroundColor: themeColors.bg, borderColor: themeColors.teal }]}>
            <Text style={[styles.dayChipText, { color: selectedDay === dayIndex ? themeColors.teal : themeColors.muted }]}>{day.date.slice(5).replace('-', '/')}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={[styles.reportCard, { backgroundColor: themeColors.panel, borderColor: themeColors.border }]}>
        <Text style={[styles.reportLabel, { color: themeColors.muted }]}>{selectedDay === null ? 'LAST 7 DAYS' : `DAY ${days[selectedDay]?.date ?? ''}`}</Text>
        <Text style={[styles.reportValue, { color: themeColors.text }]}>{formatDuration(visibleTotal)}</Text>
        <Text style={[styles.reportText, { color: themeColors.muted }]}>
          {topApp && topStat ? `${topApp.name} was used the most at ${formatDuration(selectedDay === null ? topStat.totalMillis : (topStat.daily[selectedDay]?.millis ?? 0))}. ${selectedDay === null ? `Daily average is ${formatDuration(averageMillis)}.` : ''}` : 'Usage totals appear here after apps are used.'}
        </Text>
      </View>

      <View style={[styles.chartPanel, { backgroundColor: themeColors.panel, borderColor: themeColors.border }]}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Daily total</Text>
        {days.length === 0 ? (
          <Text style={[styles.package, { color: themeColors.muted }]}>{loading ? 'Loading usage data...' : 'No usage data available yet.'}</Text>
        ) : (
          <View style={styles.chartRow}>
            {days.map((day, dayIndex) => {
              const value = totalsByDay[dayIndex];
              const height = Math.max(6, Math.round((value / maxDay) * 110));
              return (
                <View key={day.date} style={styles.chartColumn}>
                  <Text style={[styles.chartValue, { color: themeColors.muted }]}>{formatDuration(value)}</Text>
                  <View style={[styles.chartBarTrack, { backgroundColor: themeColors.bg }, selectedDay === dayIndex && { borderColor: themeColors.teal, borderWidth: 1 }]}>
                    <View style={[styles.chartBar, { height, backgroundColor: selectedDay === null || selectedDay === dayIndex ? themeColors.teal : themeColors.border }]} />
                  </View>
                  <Text style={[styles.chartLabel, { color: themeColors.muted }]}>{day.date.slice(5).replace('-', '/')}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      <Text style={[styles.sectionTitle, { color: themeColors.text, marginTop: 18 }]}>Per app</Text>
      {apps.length === 0 ? (
        <Text style={[styles.package, { color: themeColors.muted }]}>No installed apps found.</Text>
      ) : apps.map((app) => {
        const stat = usage.find((item) => item.packageName === app.packageName);
        const appMax = Math.max(...(stat?.daily.map((day) => day.millis) ?? [0]), 1);
        return (
          <View key={app.packageName} style={[styles.chartPanel, { backgroundColor: themeColors.panel, borderColor: themeColors.border }]}>
            <View style={styles.appContent}>
              {app.icon ? <Image source={{ uri: app.icon }} style={[styles.appIcon, { backgroundColor: themeColors.border }]} /> : <View style={[styles.appIcon, styles.activityIcon, { backgroundColor: themeColors.border }]}><Text style={[styles.appMark, { color: themeColors.text }]}>{app.mark}</Text></View>}
              <View style={styles.appCopy}>
                <Text style={[styles.appName, { color: themeColors.text }]}>{app.name}</Text>
                <Text style={[styles.appState, { color: themeColors.muted }]}>{selectedDay === null ? `Total ${formatDuration(stat?.totalMillis ?? 0)}` : `${stat?.daily[selectedDay]?.date.slice(5).replace('-', '/') ?? ''} · ${formatDuration(stat?.daily[selectedDay]?.millis ?? 0)}`}</Text>
              </View>
            </View>
            <View style={styles.chartRow}>
              {(stat?.daily ?? []).map((day, dayIndex) => {
                const height = Math.max(4, Math.round((day.millis / appMax) * 44));
                return (
                  <View key={day.date} style={styles.miniChartColumn}>
                    <View style={[styles.miniChartTrack, { backgroundColor: themeColors.bg }, selectedDay === dayIndex && { borderColor: themeColors.teal, borderWidth: 1 }]}>
                      <View style={[styles.miniChartBar, { height, backgroundColor: selectedDay === null || selectedDay === dayIndex ? themeColors.teal : themeColors.border }]} />
                    </View>
                    <Text style={[styles.miniChartLabel, { color: themeColors.muted }]}>{day.date.slice(5).replace('-', '/')}</Text>
                    <Text style={[styles.miniChartValue, { color: themeColors.muted }]}>{formatDuration(day.millis)}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

function CredentialSetupScreen({ method, themeColors, onComplete, onBack }: { method: LockMethod; themeColors: ThemePalette; onComplete: (value: string) => Promise<void>; onBack: () => void }) {
  const [value, setValue] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const complete = async (nextValue: string) => {
    setBusy(true);
    setError('');
    try { await onComplete(nextValue); } catch { setError('Unable to save your lock credential.'); } finally { setBusy(false); }
  };

  if (method === 'Fingerprint') {
    const authenticate = async () => {
      setBusy(true);
      setError('');

      try {
        const supported = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();

        if (!supported) {
          setError('This device does not have supported biometric hardware.');
          return;
        }
        if (!enrolled) {
          setError('No fingerprint or biometric is enrolled. Add one in Android Settings, then try again.');
          return;
        }

        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Confirm your fingerprint for Screen Guard',
          disableDeviceFallback: false,
        });

        if (result.success) {
          await onComplete('enabled');
        } else {
          setError('Fingerprint verification was cancelled or not completed.');
        }
      } catch {
        setError('Unable to check biometric security. Please try again.');
      } finally {
        setBusy(false);
      }
    };

    return (
      <ValidationPage
        title="Fingerprint setup"
        subtitle="Use your device's enrolled biometric to protect your selected apps."
        onBack={onBack}
        error=""
        themeColors={themeColors}
      >
        <View style={validationStyles.fingerprintHero}>
          <View style={[validationStyles.biometricOrb, { backgroundColor: themeColors.panel, borderColor: themeColors.border }, busy && validationStyles.biometricOrbActive]}>
            <View style={[validationStyles.biometricRingOuter, { borderColor: themeColors.border }]} />
            <View style={[validationStyles.biometricRingInner, { backgroundColor: themeColors.bg, borderColor: themeColors.teal }]} />
            <Text style={[validationStyles.biometricGlyph, { color: themeColors.teal }]}>◎</Text>
          </View>
          <Text style={[validationStyles.biometricLabel, { color: themeColors.teal }]}>BIOMETRIC PROTECTION</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scan fingerprint"
          disabled={busy}
          onPress={() => { void authenticate(); }}
          style={({ pressed }) => [
            validationStyles.biometricButton,
            busy && validationStyles.disabled,
            pressed && !busy && validationStyles.biometricButtonPressed,
          ]}
        >
          <Text style={[validationStyles.biometricButtonText, { color: themeColors.bg }]}>{busy ? 'Waiting for sensor...' : 'Scan fingerprint'}</Text>
        </Pressable>

        <View style={[validationStyles.biometricStatus, { backgroundColor: themeColors.panel, borderColor: themeColors.border }, error && validationStyles.biometricStatusError]}>
          <View style={[validationStyles.biometricStatusDot, { backgroundColor: themeColors.teal }, error && validationStyles.biometricStatusDotError]} />
          <View style={validationStyles.biometricStatusCopy}>
            <Text style={[validationStyles.biometricStatusTitle, { color: themeColors.text }]}>{error ? 'Action required' : 'Protected by your device'}</Text>
            <Text style={[validationStyles.biometricStatusText, { color: error ? themeColors.danger : themeColors.muted }]}>{error || 'Biometric data is verified locally and is never uploaded.'}</Text>
          </View>
        </View>
      </ValidationPage>
    );
  }

  const isPattern = method === 'Pattern';
  const validLength = isPattern ? value.length >= 4 : value.length === 4;
  const continueToConfirmation = () => {
    if (!validLength) return setError(isPattern ? 'Connect at least 4 dots.' : 'Enter exactly 4 digits.');
    setError('');
    setStep('confirm');
  };
  const save = () => {
    if (value !== confirmation) return setError(`Your ${method.toLowerCase()} entries do not match.`);
    complete(value);
  };
  return (
    <ValidationPage
      title={step === 'enter' ? `Create your ${method.toLowerCase()}` : `Confirm your ${method.toLowerCase()}`}
      subtitle={step === 'enter' ? (isPattern ? 'Drag between at least four dots.' : 'Choose a 4-digit number.') : `Enter your ${method.toLowerCase()} again to confirm.`}
      onBack={step === 'enter' ? onBack : () => { setError(''); setStep('enter'); }}
      error={error}
      themeColors={themeColors}
    >
      {step === 'enter'
        ? (isPattern ? <PatternPad value={value} onChange={setValue} themeColors={themeColors} /> : <PinPad value={value} onChange={setValue} themeColors={themeColors} />)
        : (isPattern ? <PatternPad value={confirmation} onChange={setConfirmation} themeColors={themeColors} /> : <PinPad value={confirmation} onChange={setConfirmation} themeColors={themeColors} />)}
      <Pressable
        style={[
          styles.continue,
          { borderColor: themeColors.teal },
          (step === 'enter' ? !validLength : !confirmation) || busy ? validationStyles.disabled : undefined,
        ]}
        disabled={step === 'enter' ? !validLength || busy : !confirmation || busy}
        onPress={step === 'enter' ? continueToConfirmation : save}
      >
        <Text style={[styles.tealText, { color: themeColors.teal }]}>{step === 'enter' ? 'Continue' : `Save ${method}`}</Text>
      </Pressable>
    </ValidationPage>
  );
}

function ValidationPage({ title, subtitle, onBack, error, themeColors, children }: { title: string; subtitle: string; onBack: () => void; error: string; themeColors: ThemePalette; children: React.ReactNode }) {
  return (
    <View style={[styles.fill, { backgroundColor: themeColors.bg }]}>
      <ScrollView contentContainerStyle={[validationStyles.validation, { backgroundColor: themeColors.bg }]}>
        <Pressable onPress={onBack}><Text style={[styles.link, { color: themeColors.teal }]}>← Change lock method</Text></Pressable>
        <Text style={[styles.title, { color: themeColors.text }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: themeColors.muted }]}>{subtitle}</Text>
        {error ? <Text style={[validationStyles.error, { color: themeColors.danger }]}>{error}</Text> : null}
        {children}
      </ScrollView>
    </View>
  );
}

type PatternPoint = { x: number; y: number };

type PatternLineProps = {
  start: PatternPoint;
  end: PatternPoint;
  color: string;
};

function PatternLine({ start, end, color }: PatternLineProps) {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const length = Math.hypot(deltaX, deltaY);
  const centerX = (start.x + end.x) / 2;
  const centerY = (start.y + end.y) / 2;
  const angle = Math.atan2(deltaY, deltaX);

  if (length < 1) return null;

  return (
    <View
      pointerEvents="none"
      style={[
        validationStyles.patternLine,
        {
          backgroundColor: color,
          width: length,
          left: centerX - length / 2,
          top: centerY - 2,
          transform: [{ rotateZ: `${angle}rad` }],
        },
      ]}
    />
  );
}

function PatternPad({ value, onChange, themeColors = screenGuardColors }: { value: string; onChange: (value: string) => void; themeColors?: ThemePalette }) {
  const [activePoint, setActivePoint] = useState<PatternPoint | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  onChangeRef.current = onChange;

  const updatePoint = (x: number, y: number) => {
    const boundedX = Math.max(0, Math.min(PATTERN_SIZE, x));
    const boundedY = Math.max(0, Math.min(PATTERN_SIZE, y));
    const point = { x: boundedX, y: boundedY };
    setActivePoint(point);

    let nearestIndex = -1;
    let nearestDistance = Number.POSITIVE_INFINITY;

    PATTERN_POINTS.forEach((candidate, index) => {
      const distance = Math.hypot(candidate.x - boundedX, candidate.y - boundedY);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    if (nearestDistance <= PATTERN_POINT_RADIUS && !valueRef.current.includes(String(nearestIndex))) {
      const nextValue = `${valueRef.current}${nearestIndex}`;
      valueRef.current = nextValue;
      onChangeRef.current(nextValue);
    }
  };

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: (event) => {
      const { locationX, locationY } = event.nativeEvent;
      updatePoint(locationX, locationY);
    },
    onPanResponderMove: (event) => {
      const { locationX, locationY } = event.nativeEvent;
      updatePoint(locationX, locationY);
    },
    onPanResponderRelease: () => setActivePoint(null),
    onPanResponderTerminate: () => setActivePoint(null),
  }), []);

  const selectedPoints = value
    .split('')
    .map((character) => PATTERN_POINTS[Number(character)])
    .filter(Boolean);
  const lastPoint = selectedPoints[selectedPoints.length - 1];

  return (
    <View
      accessibilityLabel="Pattern lock area. Drag between at least four dots."
      style={[validationStyles.patternPad, { backgroundColor: themeColors.bg, borderColor: themeColors.border }]}
      {...panResponder.panHandlers}
    >
      {selectedPoints.slice(1).map((point, index) => (
        <PatternLine key={`line-${index}`} start={selectedPoints[index]} end={point} color={themeColors.teal} />
      ))}
      {activePoint && lastPoint ? <PatternLine start={lastPoint} end={activePoint} color={themeColors.teal} /> : null}
      {PATTERN_POINTS.map((point, index) => {
        const selectedIndex = value.indexOf(String(index));
        const selected = selectedIndex >= 0;
        return (
          <View
            key={index}
            pointerEvents="none"
            style={[
              validationStyles.patternDot,
              {
                left: point.x - PATTERN_DOT_SIZE / 2,
                top: point.y - PATTERN_DOT_SIZE / 2,
                backgroundColor: selected ? themeColors.teal : themeColors.panel,
                borderColor: selected ? themeColors.teal : themeColors.border,
              },
            ]}
          >
            <Text style={[validationStyles.patternNumber, { color: selected ? themeColors.bg : themeColors.muted }]}>
              {selected ? selectedIndex + 1 : ''}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function PinPad({ value, onChange, themeColors = screenGuardColors }: { value: string; onChange: (value: string) => void; themeColors?: ThemePalette }) {
  return (
    <View style={validationStyles.pinPad}>
      {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'].map((key) => {
        const selected = key !== 'clear' && key !== 'back' && value.includes(key);
        return (
          <Pressable
            key={key}
            style={[validationStyles.key, { backgroundColor: themeColors.panel, borderColor: themeColors.border }, selected && { backgroundColor: themeColors.bg, borderColor: themeColors.teal }]}
            onPress={() => key === 'clear' ? onChange('') : key === 'back' ? onChange(value.slice(0, -1)) : value.length < 4 ? onChange(value + key) : undefined}
          >
            <Text style={[validationStyles.keyText, { color: selected ? themeColors.teal : themeColors.text }]}>{key === 'back' ? '←' : key === 'clear' ? 'C' : key}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function LockScreen({ app, method, themeColors, wallpaperUri, onUnlock, onClose }: { app: AppItem; method: LockMethod; themeColors: ThemePalette; wallpaperUri?: string; onUnlock: () => void; onClose: () => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const verify = async () => {
    if (busy) return;
    setBusy(true);
    setError('');

    try {
      const configuredMethod = await getLocalLockMethod();
      if (!configuredMethod) {
        setError('No local lock is configured. Reset the password in Settings.');
        return;
      }
      if (configuredMethod !== method) {
        setError(`Use your configured ${configuredMethod.toLowerCase()} lock.`);
        return;
      }

      if (method === 'Fingerprint') {
        const supported = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (!supported || !enrolled) {
          setError('No enrolled fingerprint or device biometric is available.');
          return;
        }
        const result = await LocalAuthentication.authenticateAsync({ promptMessage: `Unlock ${app.name}` });
        if (!result.success) {
          setError('Fingerprint verification was not completed.');
          return;
        }
      }

      const valid = await verifyLocalLockCredential(method, method === 'Fingerprint' ? 'enabled' : value);
      if (valid) onUnlock();
      else setError(`Incorrect ${method.toLowerCase()}.`);
    } catch {
      setError('Unable to read secure lock data. Reset the password in Settings.');
    } finally {
      setBusy(false);
    }
  };

  const hasWallpaper = Boolean(wallpaperUri);
  const lockTextColor = hasWallpaper ? '#f5f7fb' : themeColors.text;
  const lockPanelColor = hasWallpaper ? 'rgba(2, 11, 27, 0.72)' : themeColors.panel;
  const lockBorderColor = hasWallpaper ? 'rgba(255, 255, 255, 0.22)' : themeColors.border;

  const lockContent = (
    <ScrollView contentContainerStyle={[styles.lock, { backgroundColor: hasWallpaper ? 'transparent' : themeColors.bg }]}>
      <Pressable style={styles.close} onPress={onClose}><Text style={[styles.closeText, { color: lockTextColor }]}>×</Text></Pressable>
      {app.icon ? <Image source={{ uri: app.icon }} style={styles.lockAppIcon} /> : <View style={[styles.lockIcon, { backgroundColor: app.color }]}><Text style={styles.lockMark}>{app.mark}</Text></View>}
      <Text style={[styles.lockTitle, { color: lockTextColor }]}>{app.name} is locked</Text>
      {method === 'Fingerprint' ? (
        <Pressable style={[styles.fingerprint, { backgroundColor: lockPanelColor, borderColor: lockBorderColor }]} onPress={() => { void verify(); }}>
          <Text style={[styles.fingerprintGlyph, { color: themeColors.teal }]}>◉</Text>
        </Pressable>
      ) : method === 'Pattern' ? (
        <PatternPad value={value} onChange={setValue} themeColors={hasWallpaper ? screenGuardColors : themeColors} />
      ) : (
        <PinPad value={value} onChange={setValue} themeColors={hasWallpaper ? screenGuardColors : themeColors} />
      )}
      <Pressable style={[styles.verifyButton, { borderColor: themeColors.teal, backgroundColor: hasWallpaper ? 'rgba(2, 11, 27, 0.72)' : themeColors.bg }]} disabled={busy} onPress={() => { void verify(); }}>
        <Text style={[styles.tealText, { color: themeColors.teal }]}>{busy ? 'Verifying...' : 'Unlock'}</Text>
      </Pressable>
      {error ? <Text style={[validationStyles.error, { color: '#ff8a95' }]}>{error}</Text> : null}
    </ScrollView>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.bg }]}>
      <StatusBar barStyle={hasWallpaper || themeColors !== themePalettes.Light ? 'light-content' : 'dark-content'} backgroundColor={themeColors.bg} />
      {wallpaperUri ? (
        <ImageBackground source={{ uri: wallpaperUri }} style={styles.fill} imageStyle={styles.lockWallpaperImage} blurRadius={1}>
          <View style={styles.lockWallpaperOverlay}>{lockContent}</View>
        </ImageBackground>
      ) : lockContent}
    </SafeAreaView>
  );
}

function LegacyLockScreen({ app, method, credential, deviceId, setMethod, onUnlock, onClose }: { app: AppItem; method: LockMethod; credential: string; deviceId: string; setMethod: (value: LockMethod) => void; onUnlock: () => void; onClose: () => void }) { const [value, setValue] = useState(''); const [error, setError] = useState(''); const verify = async () => { if (method === 'Fingerprint') { const result = await LocalAuthentication.authenticateAsync({ promptMessage: `Unlock ${app.name}` }); if (result.success) onUnlock(); else setError('Fingerprint verification failed.'); return; } try { const valid = await verifyLocalLockCredential(method, value); if (valid) onUnlock(); else setError(`Incorrect ${method.toLowerCase()}.`); } catch { if (value === credential) onUnlock(); else setError('Unable to verify with the backend.'); } }; return <SafeAreaView style={styles.safe}><StatusBar barStyle="light-content" backgroundColor={screenGuardColors.bg} /><ScrollView contentContainerStyle={styles.lock}><Pressable style={styles.close} onPress={onClose}><Text style={styles.closeText}>×</Text></Pressable><View style={[styles.lockIcon, { backgroundColor: app.color }]}><Text style={styles.lockMark}>{app.mark}</Text></View><Text style={styles.lockTitle}>{app.name} is locked</Text><View style={styles.selector}>{lockMethods.map((option) => <Pressable key={option} style={[styles.selectorItem, method === option && styles.selectorActive]} onPress={() => { setMethod(option); setValue(''); setError(''); }}><Text style={[styles.selectorText, method === option && styles.tealText]}>{option === 'Fingerprint' ? '◉' : option === 'Pattern' ? '⠿' : '••••'} {option}</Text></Pressable>)}</View>{method === 'Fingerprint' ? <Pressable style={styles.fingerprint} onPress={verify}><Text style={styles.fingerprintGlyph}>◉</Text></Pressable> : method === 'Pattern' ? <PatternPad value={value} onChange={setValue} /> : <PinPad value={value} onChange={setValue} />}<Pressable style={styles.verifyButton} onPress={verify}><Text style={styles.tealText}>Verify {method}</Text></Pressable>{error ? <Text style={validationStyles.error}>{error}</Text> : null}<Text style={styles.unlockHint}>{method === 'Fingerprint' ? 'Touch the sensor to unlock' : `Enter your ${method.toLowerCase()} to unlock`}</Text></ScrollView></SafeAreaView>; }

const validationStyles = StyleSheet.create({
  validation: { padding: 30, paddingTop: 38, paddingBottom: 40 },
  validationLabel: { color: screenGuardColors.muted, fontSize: 16, marginTop: 20, marginBottom: 10 },
  error: { color: screenGuardColors.danger, fontSize: 15, marginTop: 16, textAlign: 'center' },
  disabled: { opacity: 0.45 },
  fingerprintHero: { alignItems: 'center', marginTop: 18, marginBottom: 24 },
  biometricOrb: { width: 168, height: 168, borderRadius: 84, alignItems: 'center', justifyContent: 'center', backgroundColor: '#071d32', borderWidth: 1, borderColor: '#1d4960', elevation: 8, shadowColor: screenGuardColors.teal, shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  biometricOrbActive: { borderColor: screenGuardColors.teal, backgroundColor: '#08303b', transform: [{ scale: 1.04 }] },
  biometricRingOuter: { position: 'absolute', width: 132, height: 132, borderRadius: 66, borderWidth: 2, borderColor: '#1c5965' },
  biometricRingInner: { position: 'absolute', width: 92, height: 92, borderRadius: 46, borderWidth: 2, borderColor: screenGuardColors.teal, backgroundColor: '#0a2735' },
  biometricGlyph: { color: screenGuardColors.teal, fontSize: 48, lineHeight: 54 },
  biometricLabel: { color: screenGuardColors.teal, fontSize: 12, fontWeight: '800', letterSpacing: 2, marginTop: 18 },
  biometricButton: { height: 58, borderRadius: 16, backgroundColor: screenGuardColors.teal, alignItems: 'center', justifyContent: 'center', marginHorizontal: 4 },
  biometricButtonPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  biometricButtonText: { color: '#021c21', fontSize: 17, fontWeight: '800' },
  biometricStatus: { flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderColor: '#1b4d59', backgroundColor: '#082631', borderRadius: 16, padding: 15, marginTop: 18 },
  biometricStatusError: { borderColor: '#713440', backgroundColor: '#2b1722' },
  biometricStatusDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: screenGuardColors.teal, marginTop: 5, marginRight: 11 },
  biometricStatusDotError: { backgroundColor: screenGuardColors.danger },
  biometricStatusCopy: { flex: 1 },
  biometricStatusTitle: { color: screenGuardColors.text, fontSize: 14, fontWeight: '700', marginBottom: 3 },
  biometricStatusText: { color: screenGuardColors.muted, fontSize: 13, lineHeight: 19 },
  patternPad: { width: PATTERN_SIZE, height: PATTERN_SIZE, marginTop: 28, marginBottom: 8, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', borderRadius: 28, borderWidth: 1, borderColor: screenGuardColors.border },
  patternLine: { position: 'absolute', height: 4, borderRadius: 2 },
  patternDot: { position: 'absolute', width: PATTERN_DOT_SIZE, height: PATTERN_DOT_SIZE, borderRadius: 29, borderWidth: 2, alignItems: 'center', justifyContent: 'center', elevation: 2 },
  patternNumber: { fontSize: 17, fontWeight: '800' },
  pinPad: { width: 270, marginTop: 25, alignSelf: 'center', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  key: { width: 80, height: 58, marginBottom: 10, borderRadius: 12, backgroundColor: screenGuardColors.panel, borderWidth: 1, borderColor: screenGuardColors.border, alignItems: 'center', justifyContent: 'center' },
  keySelected: { backgroundColor: '#0c3a43', borderColor: screenGuardColors.teal },
  keyText: { color: screenGuardColors.text, fontSize: 22, fontWeight: '700' },
  keyTextSelected: { color: screenGuardColors.teal },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: screenGuardColors.bg },
  fill: { flex: 1 },
  setup: { padding: 30, paddingTop: 42, paddingBottom: 20 },
  home: { padding: 30, paddingTop: 65, flexGrow: 1 },
  homePanel: { backgroundColor: screenGuardColors.panel, borderRadius: 18, borderWidth: 1, borderColor: screenGuardColors.border, padding: 18, marginVertical: 12 },
  list: { padding: 20, paddingBottom: 110 },
  appsHero: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: screenGuardColors.panel, borderRadius: 20, borderWidth: 1, borderColor: screenGuardColors.border, padding: 18, marginBottom: 16 },
  appsHeroCopy: { flex: 1, paddingRight: 14 },
  appsHeroTitle: { color: screenGuardColors.text, fontSize: 23, fontWeight: '800' },
  appsHeroSubtitle: { color: screenGuardColors.muted, fontSize: 13, lineHeight: 19, marginTop: 5 },
  appsCountBadge: { minWidth: 62, height: 62, borderRadius: 18, backgroundColor: '#08303a', borderWidth: 1, borderColor: '#1b5963', alignItems: 'center', justifyContent: 'center' },
  appsCountValue: { color: screenGuardColors.teal, fontSize: 23, lineHeight: 26, fontWeight: '800' },
  appsCountLabel: { color: screenGuardColors.muted, fontSize: 10, fontWeight: '700', marginTop: 1 },
  searchWrap: { height: 52, borderRadius: 15, borderWidth: 1, borderColor: screenGuardColors.border, backgroundColor: screenGuardColors.panel, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  searchGlyph: { color: screenGuardColors.teal, fontSize: 25, marginRight: 8, marginTop: -3 },
  listLabel: { color: screenGuardColors.muted, fontSize: 13, fontWeight: '600', marginTop: 15, marginBottom: 10, paddingHorizontal: 3 },
  appListCard: { backgroundColor: screenGuardColors.panel, borderRadius: 20, borderWidth: 1, borderColor: screenGuardColors.border, padding: 7 },
  appListRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 15, borderWidth: 1, borderColor: 'transparent', paddingHorizontal: 10, paddingVertical: 8, marginVertical: 3 },
  appListRowLocked: { backgroundColor: '#082a32', borderColor: '#15515a' },
  appState: { color: screenGuardColors.muted, fontSize: 12, marginTop: 3 },
  emptyState: { minHeight: 150, borderRadius: 20, borderWidth: 1, borderColor: screenGuardColors.border, backgroundColor: screenGuardColors.panel, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { color: screenGuardColors.text, fontSize: 18, fontWeight: '700', marginBottom: 4 },
  activity: { padding: 30, paddingBottom: 110 },
  lock: { padding: 30, paddingTop: 60, alignItems: 'center', minHeight: '100%' },
  lockWallpaperImage: { opacity: 1 },
  lockWallpaperOverlay: { flex: 1, backgroundColor: 'rgba(2, 11, 27, 0.56)' },
  hero: { color: screenGuardColors.teal, fontSize: 52, marginBottom: 12 },
  title: { color: screenGuardColors.text, fontSize: 31, fontWeight: '700' },
  subtitle: { color: screenGuardColors.muted, fontSize: 19, marginTop: 12 },
  progress: { height: 7, backgroundColor: '#26344b', borderRadius: 5, marginVertical: 25 },
  progressFill: { width: '50%', height: '100%', backgroundColor: screenGuardColors.teal, borderRadius: 5 },
  methodCard: { minHeight: 130, borderRadius: 20, borderWidth: 1, borderColor: screenGuardColors.border, backgroundColor: screenGuardColors.panel, marginBottom: 16, padding: 20, flexDirection: 'row', alignItems: 'center' },
  activeCard: { borderColor: screenGuardColors.teal, backgroundColor: '#07303b' },
  bigIcon: { width: 62, height: 62, borderRadius: 34, backgroundColor: '#243044', color: screenGuardColors.text, fontSize: 27, textAlign: 'center', textAlignVertical: 'center' },
  methodCopy: { flex: 1, paddingHorizontal: 18 },
  methodTitle: { color: screenGuardColors.text, fontSize: 21, fontWeight: '700' },
  methodDescription: { color: screenGuardColors.muted, fontSize: 16, marginTop: 7 },
  recommended: { color: screenGuardColors.teal, fontSize: 13 },
  radio: { width: 27, height: 27, borderRadius: 20, borderWidth: 2, borderColor: screenGuardColors.muted },
  radioOn: { borderColor: screenGuardColors.teal, backgroundColor: screenGuardColors.teal },
  note: { color: screenGuardColors.muted, fontSize: 16, marginTop: 8 },
  continue: { height: 64, borderWidth: 1.5, borderColor: screenGuardColors.teal, borderRadius: 17, margin: 30, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  tealText: { color: screenGuardColors.teal, fontWeight: '700', fontSize: 18 },
  arrow: { position: 'absolute', right: 20, color: screenGuardColors.teal, fontSize: 30 },
  bottom: { height: 100, borderTopWidth: 1, borderTopColor: screenGuardColors.border, backgroundColor: screenGuardColors.bg, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingBottom: 25 },
  nav: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navIcon: { fontSize: 26, color: screenGuardColors.muted },
  navLabel: { marginTop: 2, color: screenGuardColors.muted, fontSize: 12 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 },
  pageTitle: { color: screenGuardColors.text, fontSize: 25, fontWeight: '700' },
  settingsButton: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: screenGuardColors.border, backgroundColor: screenGuardColors.panel, alignItems: 'center', justifyContent: 'center' },
  settingsGlyph: { color: '#fff', fontSize: 22 },
  settingsPage: { padding: 20, paddingBottom: 40 },
  settingsHeader: { marginBottom: 18 },
  settingsCard: { backgroundColor: screenGuardColors.panel, borderRadius: 18, borderWidth: 1, borderColor: screenGuardColors.border, padding: 14, marginBottom: 18 },
  settingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: screenGuardColors.border },
  wallpaperRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: 1 },
  wallpaperThumbnail: { width: 62, height: 62, borderRadius: 14, marginRight: 12, backgroundColor: screenGuardColors.border },
  wallpaperThumbnailEmpty: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed' },
  wallpaperPlaceholderGlyph: { fontSize: 24, fontWeight: '600' },
  wallpaperCopy: { flex: 1, minWidth: 0 },
  wallpaperActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 9 },
  wallpaperAction: { minHeight: 34, borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.7)', alignItems: 'center', justifyContent: 'center', padding: 22, zIndex: 50 },
  modalCard: { width: '100%', maxWidth: 420, borderRadius: 22, backgroundColor: screenGuardColors.panel, borderWidth: 1, borderColor: screenGuardColors.border, padding: 20 },
  modalTitle: { color: screenGuardColors.text, fontSize: 21, fontWeight: '800' },
  modalText: { color: screenGuardColors.muted, fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: 6 },
  modalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: screenGuardColors.border },
  modalRowCopy: { flex: 1, paddingRight: 10 },
  modalRowTitle: { color: screenGuardColors.text, fontSize: 15, fontWeight: '700' },
  modalRowText: { color: screenGuardColors.muted, fontSize: 12, marginTop: 2 },
  modalButton: { minHeight: 34, borderRadius: 10, borderWidth: 1, borderColor: screenGuardColors.teal, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  modalButtonText: { color: screenGuardColors.teal, fontSize: 12, fontWeight: '800' },
  modalGranted: { color: screenGuardColors.teal, fontSize: 12, fontWeight: '800' },
  modalDismiss: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  modalDismissText: { color: screenGuardColors.muted, fontSize: 14, fontWeight: '700' },
  protectionBanner: { borderWidth: 1, borderRadius: 18, padding: 15, marginBottom: 14 },
  protectionBannerCopy: { flex: 1 },
  protectionBannerTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  protectionBannerText: { fontSize: 12, lineHeight: 18 },
  protectionBannerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  protectionButton: { marginTop: 0, paddingHorizontal: 14 },
  protectionActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  wallpaperActionText: { fontSize: 12, fontWeight: '700' },
  wallpaperEmpty: { borderWidth: 1, borderRadius: 12, padding: 14 },
  resetButton: { minHeight: 48, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 14, paddingHorizontal: 16 },
  resetButtonText: { fontSize: 16, fontWeight: '700' },
  count: { marginTop: 16, marginBottom: 10 },
  countText: { color: screenGuardColors.muted, fontSize: 15 },
  search: { flex: 1, height: '100%', color: screenGuardColors.text, fontSize: 15, paddingHorizontal: 0, paddingVertical: 0 },
  package: { color: screenGuardColors.muted, fontSize: 16, marginTop: 12 },
  appRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: screenGuardColors.border },
  activityAppRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 72, paddingHorizontal: 8, paddingVertical: 8, borderBottomWidth: 1 },
  appContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  appIcon: { width: 48, height: 48, borderRadius: 14, marginRight: 12, backgroundColor: screenGuardColors.border },
  appCopy: { flex: 1, minWidth: 0 },
  appName: { color: screenGuardColors.text, fontSize: 16, fontWeight: '700' },
  statusBadge: { fontSize: 12, fontWeight: '700', borderRadius: 10, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5, marginLeft: 10 },
  statusBadgeLocked: { color: '#021c21', backgroundColor: screenGuardColors.teal },
  statusBadgeUnlocked: { color: screenGuardColors.muted, backgroundColor: screenGuardColors.border },
  switch: { width: 54, height: 32, borderRadius: 16, backgroundColor: '#243044', justifyContent: 'center', paddingHorizontal: 4 },
  switchOn: { backgroundColor: screenGuardColors.teal },
  thumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#eaf2ff', marginLeft: 2 },
  thumbOn: { marginLeft: 28 },
  header: { marginBottom: 18 },
  stats: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 18 },
  stat: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  statIcon: { fontSize: 26, marginRight: 12, color: screenGuardColors.teal },
  statValue: { color: screenGuardColors.text, fontSize: 28, fontWeight: '700' },
  statLabel: { color: screenGuardColors.muted, fontSize: 14 },
  chartPanel: { backgroundColor: screenGuardColors.panel, borderRadius: 18, borderWidth: 1, borderColor: screenGuardColors.border, padding: 18, marginTop: 14 },
  statisticsHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  daySelector: { gap: 8, paddingVertical: 12, paddingRight: 8 },
  dayChip: { minHeight: 34, borderWidth: 1, borderRadius: 17, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  dayChipText: { fontSize: 12, fontWeight: '700' },
  reportCard: { borderWidth: 1, borderRadius: 18, padding: 18, marginTop: 14 },
  reportLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  reportValue: { fontSize: 34, fontWeight: '800', marginTop: 4 },
  reportText: { fontSize: 13, lineHeight: 19, marginTop: 6 },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 14 },
  chartColumn: { flex: 1, alignItems: 'center' },
  chartValue: { fontSize: 9, marginBottom: 4 },
  chartBarTrack: { height: 110, width: 16, borderRadius: 8, justifyContent: 'flex-end', overflow: 'hidden' },
  chartBar: { width: '100%', borderRadius: 8 },
  chartLabel: { fontSize: 9, marginTop: 6 },
  miniChartColumn: { flex: 1, alignItems: 'center' },
  miniChartTrack: { height: 44, width: 10, borderRadius: 5, justifyContent: 'flex-end', overflow: 'hidden' },
  miniChartBar: { width: '100%', borderRadius: 5 },
  miniChartLabel: { fontSize: 8, marginTop: 4 },
  miniChartValue: { fontSize: 8, marginTop: 1 },
  sectionTitle: { color: screenGuardColors.text, fontSize: 18, fontWeight: '700', marginBottom: 12 },
  activityRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  activityIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  appMark: { color: screenGuardColors.text, fontSize: 18, fontWeight: '700' },
  link: { color: screenGuardColors.teal, fontSize: 15, fontWeight: '600' },
  close: { alignSelf: 'flex-end', marginBottom: 12 },
  closeText: { color: screenGuardColors.text, fontSize: 32 },
  lockIcon: { width: 72, height: 72, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  lockAppIcon: { width: 78, height: 78, borderRadius: 20, marginBottom: 16, backgroundColor: screenGuardColors.panel },
  lockMark: { color: '#fff', fontSize: 28, fontWeight: '700' },
  lockTitle: { color: screenGuardColors.text, fontSize: 24, fontWeight: '700', marginBottom: 20, textAlign: 'center' },
  selector: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20 },
  selectorItem: { borderWidth: 1, borderColor: screenGuardColors.border, backgroundColor: screenGuardColors.panel, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, margin: 4 },
  selectorActive: { borderColor: screenGuardColors.teal },
  selectorText: { color: screenGuardColors.text, fontSize: 15 },
  verifyButton: { width: '100%', borderWidth: 1.5, borderColor: screenGuardColors.teal, borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  fingerprint: { width: 90, height: 90, borderRadius: 45, backgroundColor: screenGuardColors.panel, borderWidth: 1, borderColor: screenGuardColors.border, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  fingerprintGlyph: { color: screenGuardColors.teal, fontSize: 42 },
  unlockHint: { color: screenGuardColors.muted, fontSize: 16, marginTop: 12, textAlign: 'center' },
  primary: { marginTop: 18, backgroundColor: screenGuardColors.panel, borderRadius: 16, borderWidth: 1, borderColor: screenGuardColors.border, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  infoCard: { marginTop: 18, backgroundColor: screenGuardColors.panel, borderRadius: 16, borderWidth: 1, borderColor: screenGuardColors.border, padding: 16 },
  infoTitle: { color: screenGuardColors.text, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  infoText: { color: screenGuardColors.muted, fontSize: 14, lineHeight: 20 },
  eyebrow: { color: screenGuardColors.teal, fontSize: 13, letterSpacing: 2, marginBottom: 8, fontWeight: '700' },
  headerText: { color: screenGuardColors.text, fontSize: 20, fontWeight: '700' },
});;

