import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Dimensions, Platform, StyleSheet} from 'react-native';
import RegistrationActions from '../src/components/registrationActions';
import {useTheme} from '../src/hooks';
import {palette} from '../src/theme/palette';
import Strings from '../src/strings';

jest.mock('../src/components/button', () => 'Button');
jest.mock('../src/hooks', () => ({useTheme: jest.fn()}));

const originalOS = Platform.OS;
let view;
let window;
beforeEach(() => {
  // useWindowDimensions reads through Dimensions, so this is where a test
  // window actually reaches the component.
  window = {width: 393, height: 800, scale: 3, fontScale: 1};
  jest.spyOn(Dimensions, 'get').mockImplementation(() => window);
});
afterEach(() => {
  act(() => view?.unmount());
  Platform.OS = originalOS;
  jest.restoreAllMocks();
});

test.each([
  ['ios', false],
  ['ios', true],
  ['android', false],
  ['android', true],
])('pairs compact Close and new-device actions on %s (dark=%s)', (os, dark) => {
  Platform.OS = os;
  useTheme.mockReturnValue({dark});
  const onClose = jest.fn();
  const onRegisterNew = jest.fn();
  act(() => {
    view = renderer.create(
      <RegistrationActions onClose={onClose} onRegisterNew={onRegisterNew} />,
    );
  });
  const footer = view.root.findAllByProps({
    testID: 'registration-actions',
  })[0];
  const buttons = view.root.findAllByType('Button');
  const colors = palette(dark);
  expect(StyleSheet.flatten(footer.props.style)).toMatchObject({
    gap: 8,
    marginTop: 20,
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopColor: colors.border,
  });
  expect(buttons.map(button => button.props.title)).toEqual([
    Strings.Core.Close,
    Strings.Registration.Manual.RegisterNew.ShortTitle,
  ]);
  expect(buttons.map(button => button.props.type)).toEqual([
    'outline',
    'solid',
  ]);
  // The shared Button hierarchy owns the paint; the footer only asks for the
  // secondary/primary pair and the heights that pair implies.
  expect(StyleSheet.flatten(buttons[0].props.buttonStyle)).toMatchObject({
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 16,
  });
  expect(StyleSheet.flatten(buttons[1].props.buttonStyle)).toMatchObject({
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 16,
  });
  for (const button of buttons) {
    expect(
      StyleSheet.flatten(button.props.buttonStyle).backgroundColor,
    ).toBeUndefined();
  }
  for (const button of buttons) {
    expect(StyleSheet.flatten(button.props.titleStyle)).toMatchObject({
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '600',
    });
    expect(button.props.numberOfLines).toBeUndefined();
    expect(StyleSheet.flatten(button.props.containerStyle)).toMatchObject({
      width: 'auto',
      maxWidth: '100%',
      flexShrink: 1,
    });
    expect(StyleSheet.flatten(button.props.buttonStyle).height).toBeUndefined();
  }
  expect(buttons[1].props.icon.color).toBe(colors.onPrimary);
  expect(buttons[1].props.accessibilityLabel).toBe(
    Strings.Registration.Manual.RegisterNew.Title,
  );
  expect(onClose).not.toHaveBeenCalled();
  expect(onRegisterNew).not.toHaveBeenCalled();
  act(() => buttons[0].props.onPress());
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onRegisterNew).not.toHaveBeenCalled();
  act(() => buttons[1].props.onPress());
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onRegisterNew).toHaveBeenCalledTimes(1);
});

test.each([
  [320, 1],
  [393, 1.8],
])(
  'stacks compact actions without truncating labels at width %s and scale %s',
  (width, fontScale) => {
    window = {width, fontScale, height: 800, scale: 3};
    useTheme.mockReturnValue({dark: false});
    act(() => {
      view = renderer.create(
        <RegistrationActions onClose={() => {}} onRegisterNew={() => {}} />,
      );
    });
    const footer = view.root.findByProps({testID: 'registration-actions'});
    expect(StyleSheet.flatten(footer.props.style).flexDirection).toBe('column');
    for (const button of view.root.findAllByType('Button')) {
      expect(StyleSheet.flatten(button.props.containerStyle)).toMatchObject({
        width: '100%',
        maxWidth: 320,
      });
      expect(button.props.numberOfLines).toBeUndefined();
    }
  },
);
