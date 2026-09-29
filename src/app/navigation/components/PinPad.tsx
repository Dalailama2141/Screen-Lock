import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { screenGuardColors } from '../../../theme';
import type { ThemePalette } from '../shared';
import styles from './PinPad.scss';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'];

type PinPadProps = {
  value: string;
  onChange: (value: string) => void;
  themeColors?: ThemePalette;
  translucent?: boolean;
};

export function PinPad({ value, onChange, themeColors = screenGuardColors, translucent = false }: PinPadProps) {
  return (
    <View style={styles.pinPad}>
      {KEYS.map((key) => {
        const selected = key !== 'clear' && key !== 'back' && value.includes(key);
        return (
          <Pressable
            key={key}
            style={[
              styles.key,
              { backgroundColor: translucent ? 'rgba(2, 11, 27, 0.5)' : themeColors.panel, borderColor: themeColors.border },
              selected && { backgroundColor: translucent ? 'rgba(38, 228, 213, 0.22)' : themeColors.bg, borderColor: themeColors.teal },
            ]}
            onPress={() => key === 'clear' ? onChange('') : key === 'back' ? onChange(value.slice(0, -1)) : value.length < 4 ? onChange(value + key) : undefined}
          >
            <Text style={[styles.keyText, { color: selected ? themeColors.teal : themeColors.text }]}>{key === 'back' ? '←' : key === 'clear' ? 'C' : key}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
