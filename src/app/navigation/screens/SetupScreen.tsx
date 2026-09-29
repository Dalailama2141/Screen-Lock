import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { LockMethod } from '../../../types';
import type { ThemePalette } from '../shared';
import { lockMethods } from '../shared';
import styles from './SetupScreen.scss';

type SetupScreenProps = {
  method: LockMethod;
  setMethod: (value: LockMethod) => void;
  themeColors: ThemePalette;
  onContinue: () => void;
};

const methodIcon = (option: LockMethod) => option === 'Fingerprint' ? '◉' : option === 'Pattern' ? '⠿' : '••••';
const methodDescription = (option: LockMethod) => option === 'Fingerprint' ? 'Unlock instantly with your finger' : option === 'Pattern' ? 'Drag between at least four dots' : '4-digit numeric code';

export function SetupScreen({ method, setMethod, themeColors, onContinue }: SetupScreenProps) {
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
            <Text style={[styles.bigIcon, { color: themeColors.text, backgroundColor: themeColors.border }]}>{methodIcon(option)}</Text>
            <View style={styles.methodCopy}>
              <Text style={[styles.methodTitle, { color: themeColors.text }]}>{option}{option === 'Fingerprint' && <Text style={[styles.recommended, { color: themeColors.teal }]}>  Recommended</Text>}</Text>
              <Text style={[styles.methodDescription, { color: themeColors.muted }]}>{methodDescription(option)}</Text>
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
