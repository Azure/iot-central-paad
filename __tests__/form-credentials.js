import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {StyleSheet} from 'react-native';
import Form from '../src/components/form';
import Strings from '../src/strings';

jest.mock('../src/hooks', () => ({
  useTheme: () => ({colors: {text: '#000'}}),
}));
jest.mock('@rneui/themed', () => ({Input: 'Input'}));
jest.mock('../src/components/buttonGroup', () => 'ButtonGroup');
jest.mock('../src/components/typography', () => ({
  Text: require('react-native').Text,
  Name: require('react-native').Text,
  normalize: value => value,
}));

let app;
const field = {id: 'deviceKey', label: 'Device key', secure: true, multiline: false};
const tree = items => <Form items={items} submit={false} submitAction={jest.fn()} />;
afterEach(async () => {
  await act(async () => app?.unmount());
});

test('credentials stay controlled, masked and excluded from keyboard prediction', async () => {
  await act(async () => { app = renderer.create(tree([field])); });
  expect(app.root.findByType('Input').props).toMatchObject({
    value: '',
    secureTextEntry: true,
    autoCapitalize: 'none',
    autoCorrect: false,
    autoComplete: 'off',
    textContentType: 'none',
  });
  await act(async () => {
    app.root.findByType('Input').props.onChangeText('synthetic-key');
    app.root.findByType('Input').props.rightIcon.onPress();
  });
  expect(app.root.findByType('Input').props.secureTextEntry).toBe(false);
  expect(app.root.findByType('Input').props.value).toBe('synthetic-key');
  expect(app.root.findByType('Input').props.rightIcon.accessibilityLabel).toBe(
    Strings.Core.HideCredential,
  );
});

test('changing the credential form resets reveal rather than exposing a new key', async () => {
  await act(async () => { app = renderer.create(tree([field])); });
  await act(async () => app.root.findByType('Input').props.rightIcon.onPress());
  await act(async () => {
    app.update(tree([{...field, value: 'different-synthetic-key'}]));
  });
  expect(app.root.findByType('Input').props).toMatchObject({
    secureTextEntry: true,
    value: 'different-synthetic-key',
    rightIcon: {accessibilityLabel: Strings.Core.ShowCredential},
  });
});

test('credential reveal gives the actual icon pressable a full-size tonal target', async () => {
  await act(async () => { app = renderer.create(tree([field])); });
  const icon = app.root.findByType('Input').props.rightIcon;
  expect(icon.accessibilityRole).toBe('button');
  for (const pressed of [false, true]) {
    const style = StyleSheet.flatten(icon.pressableProps.style({pressed}));
    expect(style).toMatchObject({
      minWidth: 48,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
    });
    expect(style.opacity ?? 1).toBe(1);
    if (pressed) expect(style.backgroundColor).toBeDefined();
  }
});
