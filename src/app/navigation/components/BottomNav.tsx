import React from 'react';
import { Pressable, Text, View } from 'react-native';
import styles from './BottomNav.scss';
import type { Tab, ThemePalette } from '../shared';

const TAB_ICONS: Record<Tab, string> = {
  Home: '⌂',
  Statistics: '▥',
  Settings: '⚙',
};

const TABS: Tab[] = ['Home', 'Statistics', 'Settings'];

type BottomNavProps = {
  tab: Tab;
  onChange: (value: Tab) => void;
  themeColors: ThemePalette;
};

export function BottomNav({ tab, onChange, themeColors }: BottomNavProps) {
  return (
    <View style={[styles.bottom, { backgroundColor: themeColors.bg, borderTopColor: themeColors.border }]}>
      {TABS.map((item) => (
        <Pressable
          key={item}
          accessibilityRole="button"
          style={styles.nav}
          hitSlop={10}
          onPress={() => onChange(item)}
        >
          <Text style={[styles.navIcon, { color: themeColors.muted }, tab === item && { color: themeColors.teal }]}>{TAB_ICONS[item]}</Text>
          <Text style={[styles.navLabel, { color: themeColors.muted }, tab === item && { color: themeColors.teal }]}>{item}</Text>
        </Pressable>
      ))}
    </View>
  );
}
