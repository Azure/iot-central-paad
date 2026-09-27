import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {ScrollView, StyleSheet} from 'react-native';
import {Registration} from '../src/Registration';
import {RegistrationScreens} from '../src/types';
import {palette} from '../src/theme/palette';
import {surfaceColor} from '../src/components/surface';
import Strings from '../src/strings';

jest.mock('@react-navigation/stack', () => {
  // Screens render nothing here; the test drives each screen component directly.
  const Screen = () => null;
  const Navigator = ({children}) => children;
  return {createStackNavigator: () => ({Navigator, Screen}), Navigator, Screen};
});
const {
  Navigator: StackNavigator,
  Screen: StackScreen,
} = require('@react-navigation/stack');
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
let mockInsets = {top: 24, bottom: 24, left: 0, right: 0};
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));
jest.mock('@react-navigation/native', () => ({
  CommonActions: {reset: jest.fn(config => config)},
  useIsFocused: () => true,
  useNavigation: () => ({navigate: mockNavigate, replace: mockReplace}),
}));
jest.mock('../src/components', () => {
  const typography = require('../src/components/typography');
  return {
    ...typography,
    Button: 'Button',
    Link: 'Link',
    Name: 'Name',
    ConnectionNotice: 'ConnectionNotice',
    QRCodeScanner: 'QRCodeScanner',
  };
});
jest.mock('../src/onboarding/manual', () => ({
  CredentialForm: 'CredentialForm',
}));
jest.mock('../src/components/registrationActions', () => 'RegistrationActions');
jest.mock('@rneui/themed', () => ({Icon: 'Icon', Text: 'Text'}));
const cancel = jest.fn(async () => {});
const connect = jest.fn(async () => ({ok: true}));
jest.mock('../src/hooks', () => ({
  useConnectIoTCentralClient: jest.fn(),
  useScreenDimensions: () => ({
    screen: {width: 393, height: 852},
    orientation: 'portrait',
  }),
  useTheme: () => ({dark: false, colors: {text: '#17252A'}}),
}));
const hooks = require('../src/hooks');

const colors = palette(false);
let view;
const screen = name =>
  view.root.findAllByType(StackScreen).find(node => node.props.name === name);
const control = id =>
  view.root.findAllByProps({testID: id}).find(node => node.props.onPress);
const flatten = node =>
  StyleSheet.flatten(
    typeof node.props.style === 'function'
      ? node.props.style({pressed: false})
      : node.props.style,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockInsets = {top: 24, bottom: 24, left: 0, right: 0};
  hooks.useConnectIoTCentralClient.mockReturnValue([
    connect,
    cancel,
    jest.fn(),
    {client: null, loading: false, error: null, stage: 'idle'},
  ]);
});
afterEach(() => {
  act(() => view?.unmount());
  view = undefined;
});

const renderEmptyScreen = () => {
  act(() => {
    view = renderer.create(<Registration />);
  });
  const Empty = screen(RegistrationScreens.EMPTY).props.component;
  act(() => {
    view.update(<Empty />);
  });
};

test('nested registration headers do not cast a shadow', () => {
  act(() => {
    view = renderer.create(<Registration />);
  });
  expect(
    view.root.findByType(StackNavigator).props.screenOptions
      .headerShadowVisible,
  ).toBe(false);
});

test('the welcome screen groups one restrained scan action with a quiet manual entry', () => {
  renderEmptyScreen();
  const group = view.root.findAllByProps({testID: 'registration-choices'})[0];
  expect(flatten(group)).toMatchObject({
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: colors.surface,
  });

  const scan = control('registration-scan');
  const scanStyle = flatten(scan);
  expect(scan.props.accessibilityRole).toBe('button');
  expect(scan.props.accessibilityLabel).toBe(Strings.Registration.QRCode.Scan);
  // The primary action uses the shared solid forest fill.
  expect(scanStyle.backgroundColor).toBe(
    surfaceColor(false, {tone: 'primary'}),
  );
  expect(scanStyle.backgroundColor).toBe(colors.primary);
  // Restrained: one standard primary height, not an oversized hero button.
  expect(scanStyle.minHeight).toBeGreaterThanOrEqual(48);
  expect(scanStyle.minHeight).toBeLessThanOrEqual(52);
  expect(scanStyle.alignSelf).toBe('stretch');

  const manual = control('registration-manual');
  const manualStyle = flatten(manual);
  expect(manual.props.accessibilityRole).toBe('button');
  expect(manual.props.accessibilityLabel).toBe(
    Strings.Registration.QRCode.Manually,
  );
  // Quiet: unpainted and borderless, but still a full 48pt target.
  expect(manualStyle.backgroundColor).toBe('transparent');
  expect(manualStyle.borderWidth).toBe(0);
  expect(manualStyle.opacity).toBeUndefined();
  expect(manualStyle.minHeight).toBeGreaterThanOrEqual(48);
  expect(manualStyle.minWidth).toBeGreaterThanOrEqual(48);
});

test('both welcome choices keep their real navigation behavior', () => {
  renderEmptyScreen();
  act(() => control('registration-scan').props.onPress());
  expect(mockNavigate).toHaveBeenLastCalledWith(RegistrationScreens.QR);
  act(() => control('registration-manual').props.onPress());
  expect(mockNavigate).toHaveBeenLastCalledWith(RegistrationScreens.MANUAL);
  expect(mockReplace).not.toHaveBeenCalled();
});

test.each([
  {top: 24, bottom: 24, left: 0, right: 0},
  {top: 59, bottom: 34, left: 0, right: 0},
  {top: 0, bottom: 24, left: 44, right: 16},
])('welcome content clears system bars and cutouts (%j)', insets => {
  mockInsets = insets;
  renderEmptyScreen();
  const scroll = view.root.findByType(ScrollView);
  const content = StyleSheet.flatten(scroll.props.contentContainerStyle);
  expect(content).toMatchObject({
    flexGrow: 1,
    padding: 20,
    paddingBottom: 20 + insets.bottom,
    paddingLeft: 20 + insets.left,
    paddingRight: 20 + insets.right,
  });
  expect(content.height).toBeUndefined();
  expect(content.maxHeight).toBeUndefined();
  expect(content.paddingTop).toBeUndefined();
  expect(JSON.stringify(view.toJSON())).toContain(
    Strings.Registration.StartHere.Title,
  );
});

test('the scanner footer keeps a legible manual action that cancels before replacing', async () => {
  act(() => {
    view = renderer.create(<Registration />);
  });
  const QR = screen(RegistrationScreens.QR).props.children;
  act(() => {
    view.update(<>{QR({})}</>);
  });
  const footer = view.root.findByType('QRCodeScanner').props.bottomContent;
  let scanner;
  act(() => {
    scanner = renderer.create(footer);
  });
  const manual = scanner.root
    .findAllByProps({testID: 'registration-manual'})
    .find(node => node.props.onPress);
  expect(flatten(manual).alignSelf).toBe('stretch');
  // Over the camera the manual action stays painted so it remains readable.
  const style = flatten(manual);
  expect(style.backgroundColor).toBe(surfaceColor(false, {tone: 'secondary'}));
  expect(style.backgroundColor).not.toBe('transparent');
  expect(style.minHeight).toBeGreaterThanOrEqual(48);
  expect(manual.props.accessibilityLabel).toBe(
    Strings.Registration.QRCode.Manually,
  );
  await act(async () => {
    await manual.props.onPress();
  });
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(mockReplace).toHaveBeenCalledWith(RegistrationScreens.MANUAL);
  act(() => scanner.unmount());
});
