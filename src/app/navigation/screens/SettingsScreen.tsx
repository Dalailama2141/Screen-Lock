import React, { useState } from 'react';
import { Image, Modal, Pressable, SafeAreaView, ScrollView, StatusBar, Text, View } from 'react-native';
import type { LockMethod } from '../../../types';
import { aboutEntries, aboutEntriesById, type AboutTopic } from '../aboutContent';
import { accentColor, accentNames } from '../shared';
import type { AppItem, ThemePalette } from '../shared';
import styles from './SettingsScreen.scss';

type SettingsScreenProps = {
  method: LockMethod;
  theme: 'Dark' | 'Light' | 'System';
  setTheme: (value: 'Dark' | 'Light' | 'System') => void;
  accent: string;
  setAccent: (value: string) => void;
  themeColors: ThemePalette;
  backgroundColor: string;
  lockedApps: AppItem[];
  commonWallpaper: string | null;
  pickingWallpaper: boolean;
  onSelectWallpaper: () => void;
  onRemoveWallpaper: () => void;
  remoteSyncAvailable: boolean | null;
  overlayPermission: boolean;
  usageAccessGranted: boolean;
  onOpenOverlaySettings: () => void;
  onOpenUsageSettings: () => void;
  resettingPassword: boolean;
  onResetPassword: () => void;
};

const THEMES: Array<'Dark' | 'Light' | 'System'> = ['Dark', 'Light', 'System'];
const RATING_MAX = 5;

export function SettingsScreen({ method, theme, setTheme, accent, setAccent, themeColors, backgroundColor, lockedApps, commonWallpaper, pickingWallpaper, onSelectWallpaper, onRemoveWallpaper, remoteSyncAvailable, overlayPermission, usageAccessGranted, onOpenOverlaySettings, onOpenUsageSettings, resettingPassword, onResetPassword }: SettingsScreenProps) {
  const [aboutTopic, setAboutTopic] = useState<AboutTopic | null>(null);
  const [showThemes, setShowThemes] = useState(false);
  const [rating, setRating] = useState(0);
  const [submittedRating, setSubmittedRating] = useState(false);

  // A rating is kept on the device only. Nothing is uploaded and there is no store link to follow.
  const openRateUs = () => {
    setSubmittedRating(false);
    setRating(0);
  };

  const submitRating = () => {
    if (rating === 0) return;
    setSubmittedRating(true);
  };

  const aboutEntry = aboutTopic ? aboutEntriesById[aboutTopic] : null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor }]}>
      <StatusBar barStyle={theme === 'Light' ? 'dark-content' : 'light-content'} backgroundColor={backgroundColor} />
      <ScrollView contentContainerStyle={[styles.settingsPage, { backgroundColor }]}>
        <View style={styles.settingsHeader}>
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
        </View>

        <View style={[styles.settingsCard, { backgroundColor: themeColors.panel, borderColor: themeColors.border }]}> 
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Appearance</Text>
          {THEMES.map((option) => (
            <Pressable key={option} onPress={() => setTheme(option)} style={[styles.settingsRow, { borderBottomColor: themeColors.border }, theme === option && { backgroundColor: themeColors.bg, borderColor: themeColors.teal }]}>
              <Text style={[styles.appName, { color: themeColors.text }]}>{option} theme</Text>
              <Text style={[styles.link, { color: theme === option ? themeColors.teal : themeColors.muted }]}>{theme === option ? 'Active' : 'Use'}</Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.settingsCard, { backgroundColor: themeColors.panel, borderColor: themeColors.border }]}> 
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Theme</Text>
          <Pressable onPress={() => setShowThemes(true)} style={[styles.settingsRow, { borderBottomColor: themeColors.border }]}>
            <View style={styles.themeRowCopy}>
              <Text style={[styles.appName, { color: themeColors.text }]}>Lock screen colour</Text>
              <Text style={[styles.appState, { color: themeColors.muted }]}>Used on the lock screen shown when a protected app opens</Text>
            </View>
            <View style={styles.themeRowPreview}>
              <View style={[styles.themeRowSwatch, { backgroundColor: accentColor(accent).bg }]} />
              <Text style={[styles.link, { color: themeColors.teal }]}>{accent}</Text>
            </View>
          </Pressable>
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

        <View style={[styles.settingsCard, { backgroundColor: themeColors.panel, borderColor: themeColors.border }]}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>About</Text>
          {aboutEntries.map((entry) => (
            <Pressable key={entry.id} onPress={() => setAboutTopic(entry.id)} style={[styles.settingsRow, { borderBottomColor: themeColors.border }]}>
              <Text style={[styles.appName, { color: themeColors.text }]}>{entry.title}</Text>
              <Text style={[styles.link, { color: themeColors.teal }]}>View</Text>
            </Pressable>
          ))}
          <Pressable onPress={openRateUs} style={[styles.settingsRow, { borderBottomColor: themeColors.border }]}>
            <Text style={[styles.appName, { color: themeColors.text }]}>Rate us</Text>
            <Text style={[styles.link, { color: themeColors.teal }]}>Rate</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={aboutEntry !== null} transparent animationType="fade" onRequestClose={() => setAboutTopic(null)}>
        <View style={styles.aboutBackdrop}>
          <View style={[styles.aboutCard, { backgroundColor: themeColors.panel, borderColor: themeColors.border }]}>
            <Text style={[styles.aboutTitle, { color: themeColors.text }]}>{aboutEntry?.title}</Text>
            <ScrollView style={styles.aboutScroll} contentContainerStyle={styles.aboutScrollContent}>
              <Text style={[styles.aboutBody, { color: themeColors.muted }]}>{aboutEntry?.body}</Text>
            </ScrollView>
            <Pressable onPress={() => setAboutTopic(null)} style={[styles.aboutClose, { borderColor: themeColors.teal }]}>
              <Text style={[styles.aboutCloseText, { color: themeColors.teal }]}>{aboutEntry?.id === 'terms' ? 'OK' : 'Close'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={!aboutEntry} transparent animationType="fade" onRequestClose={() => { setRating(0); }}>
        <Pressable style={styles.aboutBackdrop} onPress={() => setRating(0)}>
          <Pressable style={[styles.aboutCard, { backgroundColor: themeColors.panel, borderColor: themeColors.border }]} onPress={() => {}}>
            <Text style={[styles.aboutTitle, { color: themeColors.text }]}>Rate us</Text>
            {submittedRating ? (
              <>
                <Text style={[styles.aboutBody, { color: themeColors.muted }]}>Thank you for rating Screen Guard {rating} out of {RATING_MAX}.</Text>
                <Pressable onPress={() => setRating(0)} style={[styles.aboutClose, { borderColor: themeColors.teal }]}>
                  <Text style={[styles.aboutCloseText, { color: themeColors.teal }]}>OK</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={[styles.aboutBody, { color: themeColors.muted }]}>Tap a star to rate Screen Guard out of {RATING_MAX}.</Text>
                <View style={styles.starRow}>
                  {Array.from({ length: RATING_MAX }, (_, index) => {
                    const value = index + 1;
                    const filled = value <= rating;
                    return (
                      <Pressable
                        key={value}
                        onPress={() => setRating(value)}
                        accessibilityRole="button"
                        accessibilityLabel={`${value} star${value === 1 ? '' : 's'}`}
                        style={styles.starButton}
                      >
                        <Text style={[styles.starGlyph, { color: filled ? themeColors.teal : themeColors.muted }]}>{filled ? '★' : '☆'}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Pressable disabled={rating === 0} onPress={submitRating} style={[styles.aboutClose, { borderColor: themeColors.teal }, rating === 0 && styles.disabledButton]}>
                  <Text style={[styles.aboutCloseText, { color: themeColors.teal }, rating === 0 && styles.disabledText]}>Submit</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showThemes} animationType="slide" onRequestClose={() => setShowThemes(false)}>
        <SafeAreaView style={[styles.safe, { backgroundColor }]}>
          <StatusBar barStyle={theme === 'Light' ? 'dark-content' : 'light-content'} backgroundColor={backgroundColor} />
          <View style={styles.themePageHeader}>
            <Pressable onPress={() => setShowThemes(false)} style={styles.themeBackButton}>
              <Text style={[styles.link, { color: themeColors.teal }]}>← Back</Text>
            </Pressable>
            <Text style={[styles.title, { color: themeColors.text }]}>Supported themes</Text>
            <Text style={[styles.appState, { color: themeColors.muted }]}>The colour you pick is used as the background of the lock screen shown when a protected app opens.</Text>
          </View>
          <ScrollView contentContainerStyle={styles.themePageContent}>
            <View style={styles.themeGrid}>
              {accentNames.map((name) => {
                const palette = accentColor(name);
                const selected = name === accent;
                return (
                  <Pressable
                    key={name}
                    onPress={() => setAccent(name)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${name} theme`}
                    style={[styles.themeSwatch, { backgroundColor: palette.bg, borderColor: selected ? themeColors.teal : 'rgba(127, 145, 170, 0.35)' }, selected && styles.themeSwatchSelected]}
                  >
                    <Text style={[styles.themeSwatchLabel, { color: palette.on }]}>{name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
