import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {StyleSheet} from 'react-native';
import QRCodeScanner from '../src/components/qrcodeScanner';
import Strings from '../src/strings';
import {palette} from '../src/theme/palette';
import {surfaceColor} from '../src/components/surface';

jest.mock('expo-camera', () => ({
  Camera: {
    getCameraPermissionsAsync: jest.fn(async () => ({
      granted: false,
      canAskAgain: false,
    })),
    requestCameraPermissionsAsync: jest.fn(async () => ({granted: false})),
  },
  CameraView: 'CameraView',
}));
jest.mock('../src/tools/Torch', () => ({acquireCamera: () => () => {}}));
jest.mock('@rneui/themed', () => ({Icon: 'Icon', Text: 'Text'}));
jest.mock('../src/hooks', () => ({
  useTheme: () => ({dark: false, colors: {text: '#26302A'}}),
}));

let view;
const control = label =>
  view.root.findAll(
    node =>
      typeof node.type === 'string' &&
      node.props.accessibilityRole === 'button' &&
      node.props.accessibilityLabel === label,
  )[0];
afterEach(() => {
  act(() => view?.unmount());
  view = undefined;
});

it('ranks the paused scanner controls without changing what they do', async () => {
  const colors = palette(false);
  const onClose = jest.fn();
  await act(async () => {
    view = renderer.create(
      <QRCodeScanner
        width={300}
        height={600}
        markerSize={200}
        onRead={jest.fn()}
        onClose={onClose}
      />,
    );
  });
  // Permission was refused, so the camera stays closed and both actions show.
  const retry = control(Strings.Core.Retry);
  const close = control(Strings.Core.Close);
  const retryStyle = StyleSheet.flatten(retry.props.style);
  const closeStyle = StyleSheet.flatten(close.props.style);

  // One primary recovery action, painted with the forest gradient.
  expect(retryStyle.backgroundColor).toBe(
    surfaceColor(false, {tone: 'primary'}),
  );
  expect(retryStyle.minHeight).toBeGreaterThanOrEqual(48);
  expect(retryStyle.opacity).toBeUndefined();

  // The secondary action stays painted and legible over the camera.
  expect(closeStyle.backgroundColor).toBe(
    surfaceColor(false, {tone: 'secondary'}),
  );
  expect(closeStyle.backgroundColor).not.toBe(
    surfaceColor(false, {tone: 'primary'}),
  );
  expect(closeStyle.minHeight).toBeGreaterThanOrEqual(48);
  expect(closeStyle.borderWidth).toBeLessThanOrEqual(1);
  expect(
    view.root
      .findAllByType('Text')
      .some(
        node => StyleSheet.flatten(node.props.style)?.color === colors.primary,
      ),
  ).toBe(true);

  const pressable = view.root.findAll(
    node =>
      node.props.accessibilityLabel === Strings.Core.Close &&
      typeof node.props.onPress === 'function',
  )[0];
  await act(async () => {
    await pressable.props.onPress();
  });
  expect(onClose).toHaveBeenCalledTimes(1);
});
