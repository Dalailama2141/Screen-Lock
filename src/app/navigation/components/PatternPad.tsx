import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, Text, View } from 'react-native';
import { screenGuardColors } from '../../../theme';
import type { ThemePalette } from '../shared';
import { PATTERN_DOT_SIZE, PATTERN_POINTS, PATTERN_POINT_RADIUS, PATTERN_SIZE } from '../shared';
import styles from './PatternPad.scss';

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
        styles.patternLine,
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

type PatternPadProps = {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  themeColors?: ThemePalette;
  translucent?: boolean;
};

export function PatternPad({ value, onChange, onComplete, disabled = false, themeColors = screenGuardColors, translucent = false }: PatternPadProps) {
  const [activePoint, setActivePoint] = useState<PatternPoint | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const onCompleteRef = useRef(onComplete);
  const disabledRef = useRef(disabled);
  valueRef.current = value;
  onChangeRef.current = onChange;
  onCompleteRef.current = onComplete;
  disabledRef.current = disabled;

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
    onStartShouldSetPanResponder: () => !disabledRef.current,
    onStartShouldSetPanResponderCapture: () => !disabledRef.current,
    onMoveShouldSetPanResponder: () => !disabledRef.current,
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
    // Lifting the finger submits the pattern, so no separate confirm control is needed.
    onPanResponderRelease: () => {
      setActivePoint(null);
      if (valueRef.current.length >= 4) onCompleteRef.current?.(valueRef.current);
    },
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
      style={[styles.patternPad, { backgroundColor: translucent ? 'rgba(2, 11, 27, 0.45)' : themeColors.bg, borderColor: themeColors.border }, disabled && styles.patternPadDisabled]}
      accessibilityState={{ disabled }}
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
              styles.patternDot,
              {
                left: point.x - PATTERN_DOT_SIZE / 2,
                top: point.y - PATTERN_DOT_SIZE / 2,
                backgroundColor: selected ? themeColors.teal : (translucent ? 'rgba(8, 21, 37, 0.55)' : themeColors.panel),
                borderColor: selected ? themeColors.teal : themeColors.border,
              },
            ]}
          >
            <Text style={[styles.patternNumber, { color: selected ? themeColors.bg : themeColors.muted }]}>
              {selected ? selectedIndex + 1 : ''}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
