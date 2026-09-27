import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Platform, StyleSheet, TextInput} from 'react-native';
import {ProofActivity} from '../src/onboarding/proof';
import {useTheme} from '../src/hooks';
import {detailStyles} from '../src/theme/detailStyles';
import {palette} from '../src/theme/palette';
import Strings from '../src/strings';

jest.mock('../src/hooks', () => ({useTheme: jest.fn()}));
jest.mock('../src/components/typography', () => ({Text: 'Text'}));
jest.mock('@rneui/themed', () => ({Icon: 'Icon'}));

test.each([
  ['sheetTitle', 24, 31, '600', -0.5],
  ['sectionTitle', 17, 24, '600', -0.2],
  ['label', 12, 16, '600', 0.2],
  ['value', 15, 22, '400', undefined],
  ['supporting', 13, 19, '400', undefined],
  ['actionLabel', 15, 20, '600', undefined],
  ['status', 13, 18, '600', undefined],
])(
  'defines the native-scaled %s role',
  (role, fontSize, lineHeight, fontWeight, letterSpacing) => {
    expect(detailStyles[role]).toMatchObject({
      fontSize,
      lineHeight,
      fontWeight,
    });
    expect(detailStyles[role].letterSpacing).toBe(letterSpacing);
    expect(detailStyles[role].fontFamily).toBeUndefined();
  },
);

let view;
const style = node =>
  StyleSheet.flatten(
    typeof node.props.style === 'function'
      ? node.props.style({pressed: false})
      : node.props.style,
  );
const control = id => view.root.findAllByProps({testID: id})[0];
const textNode = content =>
  view.root.findAllByType('Text').find(node => node.props.children === content);
const device = () => ({
  isConnected: () => true,
  sendTelemetry: jest.fn(async () => ({delivery: 'submitted'})),
  sendProperty: jest.fn(async () => ({delivery: 'submitted'})),
});
afterEach(() => {
  act(() => view?.unmount());
  view = undefined;
});

test.each([false, true])(
  'uses one proof primary and honest pending, error and local-submission tones (dark %s)',
  async dark => {
    useTheme.mockReturnValue({dark});
    const client = device();
    const colors = palette(dark);
    const text = Strings.Connection.Summary;
    act(() => {
      view = renderer.create(
        <ProofActivity client={client} connected simulated={false} />,
      );
    });
    const heading = textNode(text.ProofTitle);
    expect(heading.props.accessibilityRole).toBe('header');
    expect(style(heading)).toMatchObject({
      ...detailStyles.sectionTitle,
      color: colors.text,
    });
    expect(style(heading.parent)).toMatchObject({
      ...detailStyles.card,
      borderWidth: StyleSheet.hairlineWidth,
      backgroundColor: colors.surface,
      borderColor: colors.border,
    });
    const input = () => view.root.findByType(TextInput);
    expect(style(input())).toMatchObject({
      minHeight: 48,
      borderRadius: 14,
      borderColor: colors.controlBorder,
      backgroundColor: colors.inset,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 14,
      lineHeight: 22,
    });
    expect(input().props.allowFontScaling).not.toBe(false);
    expect(input().props.maxFontSizeMultiplier).toBeUndefined();
    expect(style(control('proof-send'))).toMatchObject({
      minHeight: 52,
      borderRadius: 14,
      backgroundColor: colors.primary,
    });
    expect(style(textNode(text.ProofSend))).toMatchObject({
      ...detailStyles.actionLabel,
      color: colors.onPrimary,
    });
    act(() => input().props.onChangeText('short'));
    await act(async () => {
      await control('proof-send').props.onPress();
    });
    expect(control('proof-status').props.children).toBe(text.ProofInvalid);
    expect(style(control('proof-status')).color).toBe(colors.danger);
    expect(client.sendTelemetry).not.toHaveBeenCalled();

    let finish;
    client.sendTelemetry.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    act(() => input().props.onChangeText('exact_nonce_123456789'));
    let pending;
    act(() => {
      pending = control('proof-send').props.onPress();
    });
    expect(input().props.editable).toBe(false);
    expect(style(input()).opacity).toBe(0.5);
    expect(control('proof-send').props.accessibilityState.disabled).toBe(true);
    expect(style(control('proof-send')).backgroundColor).toBe(colors.inset);
    expect(style(textNode(text.ProofSend)).color).toBe(colors.muted);
    expect(control('proof-status').props.children).toBe(text.ProofSending);
    expect(style(control('proof-status')).color).toBe(colors.muted);
    await act(async () => {
      finish({delivery: 'submitted'});
      await pending;
    });
    expect(control('proof-status').props.children).toBe('Submitted locally');
    expect(style(control('proof-status'))).toMatchObject({
      ...detailStyles.status,
      color: colors.positive,
    });
    expect(control('proof-status').props.accessibilityLiveRegion).toBe(
      'polite',
    );
    expect(client.sendProperty).toHaveBeenCalledWith({
      paadProof: {nonce: 'exact_nonce_123456789', platform: Platform.OS},
    });
    client.sendProperty.mockRejectedValueOnce(new Error('not submitted'));
    await act(async () => {
      await control('proof-send').props.onPress();
    });
    expect(control('proof-status').props.children).toBe(text.ProofFailed);
    expect(style(control('proof-status')).color).toBe(colors.danger);
    expect(control('proof-send').props.disabled).toBe(false);
  },
);

test.each([
  [false, false, false],
  [true, true, false],
  [false, true, true],
])(
  'keeps unavailable proof neutral (dark %s, connected %s, simulated %s)',
  (dark, connected, simulated) => {
    useTheme.mockReturnValue({dark});
    act(() => {
      view = renderer.create(
        <ProofActivity
          client={connected && !simulated ? null : device()}
          connected={connected}
          simulated={simulated}
        />,
      );
    });
    expect(control('proof-send').props.disabled).toBe(true);
    expect(style(control('proof-send')).backgroundColor).toBe(
      palette(dark).inset,
    );
    expect(style(textNode(Strings.Connection.Summary.ProofSend)).color).toBe(
      palette(dark).muted,
    );
  },
);
