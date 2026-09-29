import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { ThemePalette } from '../shared';
import styles from './ValidationPage.scss';

type ValidationPageProps = {
  title: string;
  subtitle: string;
  onBack: () => void;
  error: string;
  themeColors: ThemePalette;
  children: React.ReactNode;
};

export function ValidationPage({ title, subtitle, onBack, error, themeColors, children }: ValidationPageProps) {
  return (
    <View style={[styles.fill, { backgroundColor: themeColors.bg }]}>
      <ScrollView contentContainerStyle={[styles.validation, { backgroundColor: themeColors.bg }]}>
        <Pressable onPress={onBack}><Text style={[styles.link, { color: themeColors.teal }]}>← Change lock method</Text></Pressable>
        <Text style={[styles.title, { color: themeColors.text }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: themeColors.muted }]}>{subtitle}</Text>
        {error ? <Text style={[styles.error, { color: themeColors.danger }]}>{error}</Text> : null}
        {children}
      </ScrollView>
    </View>
  );
}
