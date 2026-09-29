import React, { useState } from 'react';
import { ActivityIndicator, Image, ImageBackground, Pressable, SafeAreaView, ScrollView, StatusBar, Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import type { LockMethod } from '../../../types';
import { screenGuardColors } from '../../../theme';
import { getLocalLockMethod, verifyLocalLockCredential } from '../../../services/lockCredentials';
import type { AppItem, ThemePalette } from '../shared';
import { themePalettes, isLightColor } from '../shared';
import { PinDisplay } from '../components/PinDisplay';
import { PinPad } from '../components/PinPad';
import { PatternPad } from '../components/PatternPad';
import styles from './LockScreen.scss';

type LockScreenProps = {
  app: AppItem;
  method: LockMethod;
  themeColors: ThemePalette;
  backgroundColor: string;
  onColor: string;
  wallpaperUri?: string;
  onUnlock: () => void;
  onClose: () => void;
};

export function LockScreen({ app, method, themeColors, backgroundColor, onColor, wallpaperUri, onUnlock, onClose }: LockScreenProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [patternSpent, setPatternSpent] = useState(false);

  const finishAndLaunch = () => {
    setLaunching(true);
    setTimeout(() => onUnlock(), 450);
  };

  const verify = async (credential: string) => {
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

      const valid = await verifyLocalLockCredential(method, method === 'Fingerprint' ? 'enabled' : credential);
      if (valid) { finishAndLaunch(); return; }
      setValue('');
      setError(`Incorrect ${method.toLowerCase()}.`);
    } catch {
      setError('Unable to read secure lock data. Reset the password in Settings.');
    } finally {
      setBusy(false);
    }
  };

  // A finished entry submits on its own, so there is no unlock button to press.
  const handlePinChange = (next: string) => {
    setValue(next);
    if (next.length === 4) void verify(next);
  };

  // A pattern counts only the first drag. Once that gesture has been submitted the pad is spent,
  // so the same attempt cannot be redrawn and tried again.
  const handlePatternChange = (next: string) => {
    if (patternSpent) return;
    setValue(next);
  };

  const handlePatternComplete = (pattern: string) => {
    if (patternSpent) return;
    setPatternSpent(true);
    void verify(pattern);
  };

  const hasWallpaper = Boolean(wallpaperUri);
  const lightBackground = isLightColor(backgroundColor);
  // With a photo wallpaper the overlay always sits on a dark scrim, so its own colours win.
  const lockTextColor = hasWallpaper ? '#f5f7fb' : onColor;
  const lockPanelColor = hasWallpaper ? 'rgba(2, 11, 27, 0.72)' : (lightBackground ? 'rgba(255, 255, 255, 0.55)' : 'rgba(8, 21, 37, 0.55)');
  const lockBorderColor = hasWallpaper ? 'rgba(255, 255, 255, 0.22)' : (lightBackground ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.14)');
  const padTheme = hasWallpaper ? screenGuardColors : (lightBackground ? themePalettes.Light : themeColors);
  const errorColor = hasWallpaper || !lightBackground ? themeColors.danger : '#c0223f';

  const lockContent = (
    <ScrollView contentContainerStyle={[styles.lock, { backgroundColor: hasWallpaper ? 'transparent' : backgroundColor }]}>
      <Pressable style={styles.close} onPress={onClose}><Text style={[styles.closeText, { color: lockTextColor }]}>×</Text></Pressable>
      {app.icon ? <Image source={{ uri: app.icon }} style={[styles.lockAppIcon, { backgroundColor: themeColors.panel }]} /> : <View style={[styles.lockIcon, { backgroundColor: app.color }]}><Text style={styles.lockMark}>{app.mark}</Text></View>}
      <Text style={[styles.lockTitle, { color: lockTextColor }]}>{app.name} is locked</Text>
      {method === 'Fingerprint' ? (
        <Pressable style={[styles.fingerprint, { backgroundColor: lockPanelColor, borderColor: lockBorderColor }]} onPress={() => { void verify(''); }}>
          <Text style={[styles.fingerprintGlyph, { color: themeColors.teal }]}>◉</Text>
        </Pressable>
      ) : method === 'Pattern' ? (
        <PatternPad value={value} onChange={handlePatternChange} onComplete={handlePatternComplete} disabled={patternSpent} themeColors={padTheme} translucent={hasWallpaper} />
      ) : (
        <>
          <PinDisplay value={value} themeColors={padTheme} translucent={hasWallpaper} />
          <PinPad value={value} onChange={handlePinChange} themeColors={padTheme} translucent={hasWallpaper} />
        </>
      )}
      {patternSpent && !launching ? <Text style={[styles.error, { color: errorColor }]}>One pattern per attempt. Close and reopen the app to try again.</Text> : null}
      {error ? <Text style={[styles.error, { color: errorColor }]}>{error}</Text> : null}
    </ScrollView>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: hasWallpaper ? themeColors.bg : backgroundColor }]}>
      <StatusBar barStyle={lightBackground && !hasWallpaper ? 'dark-content' : 'light-content'} backgroundColor={hasWallpaper ? themeColors.bg : backgroundColor} />
      {wallpaperUri ? (
        <ImageBackground source={{ uri: wallpaperUri }} style={styles.fill} blurRadius={1}>
          <View style={styles.lockWallpaperOverlay}>{lockContent}</View>
        </ImageBackground>
      ) : lockContent}
      {launching ? (
        <View style={[styles.launchingOverlay, { backgroundColor: hasWallpaper ? 'rgba(2, 11, 27, 0.82)' : backgroundColor }]}>
          <ActivityIndicator size="large" color={themeColors.teal} />
          <Text style={[styles.launchingText, { color: lockTextColor }]}>Opening {app.name}…</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
