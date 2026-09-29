import React from 'react';
import { Text, View } from 'react-native';
import { screenGuardColors } from '../../../theme';
import type { ThemePalette } from '../shared';
import styles from './PinDisplay.scss';

type PinDisplayProps = {
  value: string;
  themeColors?: ThemePalette;
  translucent?: boolean;
};

export function PinDisplay({ value, themeColors, translucent = false }: PinDisplayProps) {
  const colors = themeColors ?? screenGuardColors;
  return (
    <View style={[styles.pinDisplay, { backgroundColor: translucent ? 'rgba(2, 11, 27, 0.5)' : colors.panel, borderColor: colors.border }]}>
      <Text style={[styles.pinDisplayValue, { color: value.length > 0 ? colors.text : colors.muted }]}>{value.length > 0 ? value.replace(/./g, '* ').trim() : 'Enter PIN'}</Text>
    </View>
  );
}
