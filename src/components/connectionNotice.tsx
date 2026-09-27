// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Icon} from '@rneui/themed';
import {useTheme} from 'hooks';
import Strings from 'strings';
import {Text} from './typography';
import DetailsAction from './detailsAction';
import {palette} from '../theme/palette';
import type {ConnectionError} from '../connection';

export type ConnectionNoticeAction = {
  label: string;
  onPress(): void;
  testID?: string;
};

/**
 * Shared presentation for an intentional disconnect or a sanitized {@link ConnectionError}.
 * The error object never carries a raw cause, response body or credential, so
 * everything rendered here is already safe to display.
 */
export default function ConnectionNotice({
  error,
  disconnected = false,
  action,
  diagnostics = false,
  testID = disconnected ? 'connection-disconnected' : 'connection-error',
}: (
  | {error: ConnectionError; disconnected?: false}
  | {error?: never; disconnected: true}
) & {
  action?: ConnectionNoticeAction;
  diagnostics?: boolean;
  testID?: string;
}) {
  const {dark} = useTheme();
  const appearance = palette(dark);
  const notice = Strings.Connection.Notice;
  const titles: Partial<Record<string, string>> = notice.Titles;
  const guidance: Partial<Record<string, string>> = notice.Guidance;
  const title = error
    ? titles[error.code] ?? notice.Titles.Default
    : notice.Disconnected.Title;
  const hint = error ? guidance[error.code] : undefined;
  const message = error
    ? hint
      ? `${error.message} ${hint}`
      : error.message
    : notice.Disconnected.Message;
  const status =
    error?.status !== undefined && error.status >= 100 && error.status <= 599
      ? error.status
      : undefined;

  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.container, {backgroundColor: appearance.dangerSurface}]}>
      <View style={styles.header}>
        <View
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.icon}>
          <Icon
            name={disconnected ? 'link-variant-off' : 'alert-circle-outline'}
            type="material-community"
            size={20}
            color={appearance.danger}
          />
        </View>
        <View style={styles.body}>
          <Text style={[styles.title, {color: appearance.danger}]}>
            {title}
          </Text>
          <Text style={[styles.message, {color: appearance.text}]}>
            {message}
          </Text>
        </View>
      </View>
      {action && (
        <DetailsAction
          id={action.testID}
          label={action.label}
          accessibilityLabel={action.label}
          variant="secondary"
          onInset
          onPress={action.onPress}
        />
      )}
      {diagnostics && error && (
        <View style={styles.diagnostics}>
          <Text
            testID="connection-error-code"
            selectable
            style={[styles.code, {color: appearance.muted}]}>
            {error.code}
          </Text>
          {status !== undefined && (
            <Text
              testID="connection-http-status"
              selectable
              style={[styles.code, {color: appearance.muted}]}>
              {`HTTP ${status}`}
            </Text>
          )}
          {error.serviceCode !== undefined && (
            <Text
              testID="connection-service-code"
              selectable
              style={[styles.code, {color: appearance.muted}]}>
              {error.serviceCode}
            </Text>
          )}
          {error.operationId !== undefined && (
            <Text
              testID="connection-operation-id"
              selectable
              style={[styles.code, {color: appearance.muted}]}>
              {error.operationId}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  icon: {
    paddingTop: 1,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  diagnostics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 12,
    rowGap: 2,
  },
  code: {
    fontSize: 12,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
});
