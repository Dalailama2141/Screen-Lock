import React from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type { AppItem, ThemePalette } from '../shared';
import styles from './AppsScreen.scss';

type AppsScreenProps = {
  apps: AppItem[];
  totalCount: number;
  lockedCount: number;
  loading: boolean;
  search: string;
  setSearch: (value: string) => void;
  themeColors: ThemePalette;
  onToggle: (packageName: string) => void;
  onOpen: (app: AppItem) => void;
};

export function AppsScreen({ apps, totalCount, lockedCount, loading, search, setSearch, themeColors, onToggle, onOpen }: AppsScreenProps) {
  return (
    <ScrollView contentContainerStyle={[styles.list, { backgroundColor: themeColors.bg }]} keyboardShouldPersistTaps="handled">
      <View style={styles.brandRow}>
        <Text style={[styles.brandDiamond, { color: themeColors.teal }]}>◆</Text>
        <Text style={[styles.brandLabel, { color: themeColors.text }]}>Screen Lock</Text>
      </View>

      <View style={[styles.appsHero, { backgroundColor: themeColors.panel, borderColor: themeColors.border }]}>
        <View style={styles.appsHeroCopy}>
          <Text style={[styles.appsHeroTitle, { color: themeColors.text }]}>Protected apps</Text>
          <Text style={[styles.appsHeroSubtitle, { color: themeColors.muted }]}>Choose which apps require your lock.</Text>
        </View>
        <View style={[styles.appsCountBadge, { borderColor: themeColors.teal }]}>
          <Text style={[styles.appsCountValue, { color: themeColors.teal }]}>{lockedCount}</Text>
          <Text style={[styles.appsCountLabel, { color: themeColors.muted }]}>locked</Text>
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
