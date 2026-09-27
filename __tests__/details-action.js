import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {StyleSheet} from 'react-native';
import DetailsAction from '../src/components/detailsAction';
import {surfaceColor} from '../src/components/surface';
import {useTheme} from '../src/hooks';
import {palette} from '../src/theme/palette';

jest.mock('../src/hooks', () => ({useTheme: jest.fn()}));
jest.mock('../src/components/typography', () => ({Text: 'Text'}));
jest.mock('@rneui/themed', () => ({Icon: 'Icon'}));

let tree;
const control = () => tree.root.findAllByProps({testID: 'action'})[0];
const style = () => StyleSheet.flatten(control().props.style);
// Nothing is layered over a control: every face paints its own background,
// so its hairline outline is never covered by a second rounded rectangle.
const overlays = () =>
  tree.root.findAll(
    node => typeof node.type !== 'string' && node.props.radius !== undefined,
  );
const press = (down = true) =>
  act(() =>
    down ? control().props.onPressIn() : control().props.onPressOut(),
  );
afterEach(() => act(() => tree?.unmount()));

test.each([false, true])(
  'gives every action an edge, label and scalable touch region (dark %s)',
  dark => {
    useTheme.mockReturnValue({dark});
    const colors = palette(dark);
    const onPress = jest.fn();
    for (const variant of ['primary', 'secondary', 'danger']) {
      act(() => {
        tree?.unmount();
        tree = renderer.create(
          <DetailsAction
            id="action"
            label="A long action label that may wrap"
            icon="send"
            variant={variant}
            onPress={onPress}
          />,
        );
      });
      const tone =
        variant === 'primary'
          ? 'primary'
          : variant === 'danger'
          ? 'danger'
          : 'secondary';
      expect(style()).toMatchObject({
        minHeight: variant === 'primary' ? 52 : 48,
        borderRadius: 14,
        paddingHorizontal: 16,
        maxWidth: '100%',
        alignSelf: 'flex-start',
        flexDirection: 'row',
        gap: 8,
        backgroundColor: surfaceColor(dark, {tone}),
        borderColor:
          variant === 'danger' ? colors.danger : colors.controlBorder,
        borderWidth: variant === 'primary' ? 0 : StyleSheet.hairlineWidth,
      });
      expect(style().height).toBeUndefined();
      // The reachable target never shrinks with the press settle.
      expect(control().props.hitSlop).toBe(2);
      expect(overlays()).toEqual([]);
      const label = tree.root.findByType('Text');
      expect(label.props.numberOfLines).toBeUndefined();
      expect(label.props.allowFontScaling).not.toBe(false);
      expect(StyleSheet.flatten(label.props.style)).toMatchObject({
        fontSize: 15,
        lineHeight: 20,
        fontWeight: '600',
        flexShrink: 1,
        color:
          variant === 'primary'
            ? colors.onPrimary
            : variant === 'danger'
            ? colors.danger
            : colors.primary,
      });
      expect(
        tree.root.findByType('Icon').parent.props.accessibilityElementsHidden,
      ).toBe(true);
      act(() => control().props.onPress());
    }
    expect(onPress).toHaveBeenCalledTimes(3);
  },
);

test.each(['primary', 'secondary', 'danger', 'quiet'])(
  'answers a press with a deeper surface rather than a dimmed label (%s)',
  variant => {
    useTheme.mockReturnValue({dark: false});
    act(() => {
      tree = renderer.create(
        <DetailsAction
          id="action"
          label="Send"
          icon="send"
          variant={variant}
          onPress={() => {}}
        />,
      );
    });
    const resting = style();
    const labelColor = () =>
      StyleSheet.flatten(tree.root.findByType('Text').props.style).color;
    const restingLabel = labelColor();
    press();
    const held = style();
    expect(held.backgroundColor).not.toBe(resting.backgroundColor);
    expect(held.opacity).toBeUndefined();
    expect(labelColor()).toBe(restingLabel);
    expect(overlays()).toEqual([]);
    press(false);
    expect(style().backgroundColor).toBe(resting.backgroundColor);
  },
);

test('distinguishes external links, expanded toggles and disabled busy actions', () => {
  useTheme.mockReturnValue({dark: false});
  const colors = palette(false);
  const onPress = jest.fn();
  act(() => {
    tree = renderer.create(
      <DetailsAction
        id="action"
        label="Azure portal"
        external
        onInset
        onPress={onPress}
      />,
    );
  });
  expect(control().props.accessibilityRole).toBe('link');
  // On a recessed panel the action lifts with the raised pair.
  expect(style().backgroundColor).toBe(surfaceColor(false, {tone: 'raised'}));
  expect(tree.root.findByType('Icon').props.name).toBe('open-in-new');
  act(() => {
    tree.update(
      <DetailsAction
        id="action"
        label="Hide details"
        expanded
        block
        onPress={onPress}
      />,
    );
  });
  expect(control().props.accessibilityState.expanded).toBe(true);
  expect(style()).toMatchObject({
    backgroundColor: colors.tints[0],
    alignSelf: 'stretch',
  });
  expect(tree.root.findByType('Icon').props.name).toBe('chevron-up');
  act(() => {
    tree.update(
      <DetailsAction
        id="action"
        label="Send"
        variant="primary"
        busy
        onPress={onPress}
      />,
    );
  });
  expect(control().props.disabled).toBe(true);
  expect(control().props.accessibilityState).toMatchObject({
    disabled: true,
    busy: true,
  });
  // A held action stops being painted at all, so it cannot look live.
  expect(style()).toMatchObject({
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.controlBorder,
    backgroundColor: colors.inset,
    opacity: 0.5,
  });
  press();
  expect(style().backgroundColor).toBe(colors.inset);
  expect(onPress).not.toHaveBeenCalled();
});

test.each([false, true])(
  'quiet actions shrink only the visual chrome (dark %s)',
  dark => {
    useTheme.mockReturnValue({dark});
    const onPress = jest.fn();
    act(() => {
      tree = renderer.create(
        <DetailsAction
          id="action"
          variant="quiet"
          label="Show technical name"
          expanded={false}
          onPress={onPress}
        />,
      );
    });
    expect(style()).toMatchObject({
      minHeight: 48,
      minWidth: 48,
      borderWidth: 0,
      backgroundColor: 'transparent',
      maxWidth: '100%',
    });
    expect(overlays()).toEqual([]);
    expect(control().props.accessibilityState.expanded).toBe(false);
    expect(
      StyleSheet.flatten(tree.root.findByType('Text').props.style),
    ).toMatchObject({
      fontSize: 13,
      lineHeight: 18,
      flexShrink: 1,
    });
    expect(tree.root.findByType('Icon').props.size).toBe(16);
    act(() => control().props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  },
);
