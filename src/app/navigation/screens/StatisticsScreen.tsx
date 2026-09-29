import React, { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import type { AppUsageStat } from '../../../services/native/appLock';
import type { AppItem, ThemePalette } from '../shared';
import { formatDuration } from '../shared';
import styles from './StatisticsScreen.scss';

type StatisticsScreenProps = {
  apps: AppItem[];
  usage: AppUsageStat[];
  loading: boolean;
  themeColors: ThemePalette;
};

export function StatisticsScreen({ apps, usage, loading, themeColors }: StatisticsScreenProps) {
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
  const usageValueFor = (packageName: string) => {
    const stat = usage.find((item) => item.packageName === packageName);
    if (selectedDay === null) return stat?.totalMillis ?? 0;
    return stat?.daily[selectedDay]?.millis ?? 0;
  };
  const sortedApps = [...apps].sort((left, right) => usageValueFor(right.packageName) - usageValueFor(left.packageName));

  return (
    <ScrollView contentContainerStyle={[styles.activity, { backgroundColor: themeColors.bg }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: themeColors.text }]}>Usage statistics</Text>
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
      ) : sortedApps.map((app) => {
        const stat = usage.find((item) => item.packageName === app.packageName);
        const daily = stat?.daily ?? [];
        // On a single day there is nothing to compare against, so one bar is shown instead of
        // the full week, scaled against the busiest app that day to stay comparable across apps.
        const visibleDays = selectedDay === null ? daily : daily.filter((_, dayIndex) => dayIndex === selectedDay);
        const appMax = selectedDay === null
          ? Math.max(...daily.map((day) => day.millis), 1)
          : Math.max(...usage.map((item) => item.daily[selectedDay]?.millis ?? 0), 1);
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
              {visibleDays.map((day) => {
                const height = Math.max(4, Math.round((day.millis / appMax) * 44));
                const isSelected = selectedDay !== null && day.date === stat?.daily[selectedDay]?.date;
                return (
                  <View key={day.date} style={styles.miniChartColumn}>
                    <View style={[styles.miniChartTrack, { backgroundColor: themeColors.bg }, isSelected && { borderColor: themeColors.teal, borderWidth: 1 }]}>
                      <View style={[styles.miniChartBar, { height, backgroundColor: selectedDay === null || isSelected ? themeColors.teal : themeColors.border }]} />
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
