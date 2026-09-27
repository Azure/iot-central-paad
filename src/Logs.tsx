// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, {useMemo, useRef, useState} from 'react';
import {FlatList, Platform, Pressable, StyleSheet, View} from 'react-native';
import {Icon} from '@rneui/themed';
import {useLogger, useTheme} from 'hooks';
import {Text} from './components/typography';
import Strings, {resolveString} from 'strings';
import {TimedLog} from './types';
import {palette} from './theme/palette';
import {detailStyles} from './theme/detailStyles';
import FluidDisclosure from './components/fluidDisclosure';
import SelectionControl from './components/selectionControl';

export function logLevel(eventName: string): 'info' | 'warning' | 'error' {
  if (/\berror\b/i.test(eventName)) return 'error';
  if (/\bwarn(?:ing)?\b/i.test(eventName)) return 'warning';
  return 'info';
}

const Logs = React.memo(({visible = true}: {visible?: boolean}) => {
  const {dark} = useTheme();
  const appearance = palette(dark);
  const [logs] = useLogger();
  const [issuesOnly, setIssuesOnly] = useState(false);
  const list = useRef<FlatList<TimedLog[number]>>(null);
  const entries = useMemo(
    () =>
      issuesOnly
        ? logs.filter(entry => logLevel(entry.logItem.eventName) !== 'info')
        : logs,
    [issuesOnly, logs],
  );
  const text = Strings.LogScreen;
  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <View style={styles.headingRow}>
          <Text
            accessibilityRole="header"
            style={[detailStyles.sectionTitle, styles.headingTitle]}>
            {text.Title}
          </Text>
          <Pressable
            testID="logs-latest"
            accessibilityRole="button"
            accessibilityState={{disabled: !entries.length}}
            disabled={!entries.length}
            onPress={() => list.current?.scrollToEnd({animated: false})}
            hitSlop={8}
            style={styles.textAction}>
            <Text
              style={[
                styles.actionLabel,
                {color: entries.length ? appearance.primary : appearance.muted},
              ]}>
              {text.Latest}
            </Text>
          </Pressable>
        </View>
        <Text style={[styles.supporting, {color: appearance.muted}]}>
          {text.Header}
        </Text>
        <View style={styles.toolbar}>
          <SelectionControl
            variant="filter"
            label={text.Title}
            focused={visible}
            options={[
              {id: 'logs-filter-all', label: text.All},
              {id: 'logs-filter-issues', label: text.Issues},
            ]}
            selected={issuesOnly ? 1 : 0}
            onSelect={index => setIssuesOnly(index === 1)}
          />
          <Text style={[styles.count, {color: appearance.muted}]}>
            {resolveString(text.Count, String(entries.length))}
          </Text>
        </View>
      </View>
      <FlatList
        ref={list}
        testID="logs-list"
        data={entries}
        keyExtractor={entry => String(entry.id)}
        renderItem={({item, index}) => (
          <LogEvent
            entry={item}
            visible={visible}
            last={index === entries.length - 1}
          />
        )}
        contentContainerStyle={styles.feed}
        ListEmptyComponent={
          <View
            style={[
              styles.empty,
              {
                backgroundColor: appearance.surface,
                borderColor: appearance.border,
              },
            ]}>
            <View
              accessible={false}
              style={[
                styles.emptyIcon,
                {backgroundColor: appearance.tints[1]},
              ]}>
              <Icon
                name="history"
                type="material-community"
                color={appearance.text}
                size={28}
              />
            </View>
            <Text style={styles.emptyTitle}>
              {issuesOnly ? text.NoIssues : text.Empty}
            </Text>
            <Text style={[styles.emptyDetail, {color: appearance.muted}]}>
              {issuesOnly ? text.NoIssuesDetail : text.EmptyDetail}
            </Text>
          </View>
        }
      />
    </View>
  );
});

export const LogEvent = React.memo(
  ({
    entry,
    last = true,
    visible = true,
  }: {
    entry: TimedLog[number];
    last?: boolean;
    visible?: boolean;
  }) => {
    const {dark} = useTheme();
    const appearance = palette(dark);
    const [expanded, setExpanded] = useState(false);
    const level = logLevel(entry.logItem.eventName);
    const foreground = level === 'error' ? appearance.danger : appearance.text;
    const background =
      level === 'error'
        ? appearance.dangerSurface
        : level === 'warning'
        ? appearance.tints[3]
        : appearance.tints[1];
    const accent =
      level === 'error'
        ? appearance.danger
        : level === 'warning'
        ? appearance.toolAccents[2]
        : appearance.controlBorder;
    const text = Strings.LogScreen;
    return (
      <View testID={`log-event-${entry.id}`} style={styles.eventRow}>
        <View
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.timeline}>
          <View
            style={[
              styles.mark,
              expanded && styles.markOpen,
              {backgroundColor: accent},
            ]}
          />
          {!last && (
            <View
              style={[
                styles.timelineLine,
                {backgroundColor: appearance.border},
              ]}
            />
          )}
        </View>
        <View style={styles.eventBody}>
          <View style={styles.eventMeta}>
            <Text
              style={[
                styles.level,
                {backgroundColor: background, color: foreground},
              ]}>
              {text.Levels[level]}
            </Text>
            <Text style={[styles.timestamp, {color: appearance.muted}]}>
              {typeof entry.timestamp === 'number'
                ? new Date(entry.timestamp).toLocaleString()
                : entry.timestamp}
            </Text>
            <Pressable
              testID={`log-toggle-${entry.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${
                expanded ? text.HideDetails : text.Details
              }: ${entry.logItem.eventName}`}
              accessibilityState={{expanded}}
              onPress={() => setExpanded(current => !current)}
              style={styles.disclosure}>
              {({pressed}) => (
                <View
                  accessible={false}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={[
                    styles.chevron,
                    {
                      borderColor: appearance.border,
                      backgroundColor: pressed
                        ? appearance.inset
                        : 'transparent',
                    },
                  ]}>
                  <Icon
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    type="material-community"
                    size={16}
                    color={appearance.muted}
                  />
                </View>
              )}
            </Pressable>
          </View>
          <Text selectable style={styles.eventTitle}>
            {entry.logItem.eventName}
          </Text>
          <FluidDisclosure expanded={!expanded} visible={visible}>
            <Text
              numberOfLines={2}
              style={[styles.preview, {color: appearance.muted}]}>
              {entry.logItem.eventData}
            </Text>
          </FluidDisclosure>
          <FluidDisclosure expanded={expanded} visible={visible}>
            <View
              style={[
                styles.payload,
                {
                  backgroundColor: appearance.inset,
                  borderColor: appearance.border,
                },
              ]}>
              <Text
                testID={`log-payload-${entry.id}`}
                selectable
                style={styles.payloadText}>
                {entry.logItem.eventData}
              </Text>
            </View>
          </FluidDisclosure>
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {flex: 1},
  heading: {paddingHorizontal: 20, paddingTop: 14, gap: 6},
  headingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headingTitle: {flexShrink: 1},
  supporting: {fontSize: 13, lineHeight: 20},
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  count: {fontSize: 13, lineHeight: 20},
  actionLabel: {fontSize: 13, lineHeight: 19, fontWeight: '600'},
  textAction: {
    minWidth: 48,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  disclosure: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -8,
    marginEnd: -8,
  },
  feed: {paddingHorizontal: 20, paddingBottom: 24, flexGrow: 1},
  eventRow: {flexDirection: 'row', gap: 12},
  timeline: {width: 12, alignItems: 'center'},
  mark: {width: 10, height: 10, borderRadius: 5, marginTop: 13},
  markOpen: {width: 12, height: 12, borderRadius: 6, marginTop: 12},
  timelineLine: {width: 2, flex: 1, borderRadius: 1, marginTop: 6},
  eventBody: {flex: 1, minWidth: 0, paddingBottom: 16},
  chevron: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  level: {
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  timestamp: {fontSize: 11, lineHeight: 17, flexGrow: 1, flexShrink: 1},
  eventTitle: {fontSize: 14, lineHeight: 21, fontWeight: '600', marginTop: 4},
  preview: {fontSize: 14, lineHeight: 21, paddingTop: 5},
  payload: {
    marginTop: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  payloadText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    lineHeight: 19,
  },
  empty: {
    padding: 28,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: 12,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyDetail: {fontSize: 14, lineHeight: 21, textAlign: 'center'},
});

export default Logs;
