import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Card} from '../src/components/card';
import {StyleSheet, TouchableOpacity, Pressable} from 'react-native';
import {Properties} from '../src/properties';
import {palette} from '../src/theme/palette';

jest.mock('../src/hooks', () => ({
  useTheme: () => ({dark: false, colors: {text: '#111', card: '#fff'}}),
}));
jest.mock('../src/components', () => ({Button: 'Button'}));
jest.mock('../src/components/typography', () => ({
  Text: 'Text',
  Name: 'Name',
  Headline: 'Headline',
  getRandomColor: () => '#000',
  normalize: value => value,
  bytesToSize: value => `${value} bytes`,
}));
jest.mock('@rneui/themed', () => ({Icon: 'Icon', Input: 'Input'}));

let view;
const render = props =>
  act(() => {
    view = renderer.create(<Card title="Location" enabled={true} {...props} />);
  });
const text = () => JSON.stringify(view.toJSON());
afterEach(() => act(() => view?.unmount()));

it('renders null location fields safely with units and explicit simulation metadata', () => {
  render({
    dataType: 'object',
    value: {lat: 0, lon: 0, alt: null},
    simulated: true,
    unit: '°',
  });
  expect(text()).toContain('N/A');
  expect(text()).toContain('Simulated data');
  expect(text()).toContain('°');
});
it('shows availability instead of presenting stale readings as current', () => {
  render({value: 987, dataType: 'number', availability: 'unavailable'});
  expect(text()).toContain('Unavailable');
  expect(text()).not.toContain('"987"');
});
it('does not show a disabled sensor value as live', () => {
  render({value: 987, enabled: false});
  expect(text()).toContain('Disabled');
  expect(text()).not.toContain('"987"');
});

it('lets long readings grow instead of clipping them into a fixed-height tile', () => {
  render({
    accentKey: 'location',
    value: {x: 12.5, y: -100.125, altitude: null},
    dataType: 'object',
  });
  const style = StyleSheet.flatten(
    view.root.findByProps({testID: 'card-location'}).props.style,
  );
  expect(style.height).toBeUndefined();
  expect(style.minHeight).toBeGreaterThanOrEqual(140);
  expect(text()).toContain('altitude');
  expect(text()).toContain('N/A');
});

it('exposes the enable action separately from chart navigation and the long-press shortcut', () => {
  const onToggle = jest.fn();
  const onPress = jest.fn();
  const onLongPress = jest.fn();
  render({
    accentKey: 'location',
    availability: 'unavailable',
    onToggle,
    onPress,
    onLongPress,
  });
  const toggle = view.root.findByProps({testID: 'sensor-toggle-location'});
  expect(toggle.props.accessibilityRole).toBe('switch');
  expect(toggle.props.accessibilityState).toEqual({checked: true});
  expect(toggle.props.accessibilityLabel).toBe('Disable sensor: Location');
  const toggleStyle = () => StyleSheet.flatten(toggle.props.style);
  expect(toggleStyle().minHeight).toBeGreaterThanOrEqual(48);
  // A press seats the control deeper; it never dims the label it belongs to.
  expect(toggleStyle().backgroundColor).toBeUndefined();
  act(() => toggle.props.onPressIn());
  const held = StyleSheet.flatten(
    view.root.findByProps({testID: 'sensor-toggle-location'}).props.style,
  );
  expect(held.backgroundColor).toBe(palette(false).inset);
  expect(held.opacity).toBeUndefined();
  act(() => toggle.props.onPressOut());
  expect(toggleStyle().backgroundColor).toBeUndefined();
  const card = view.root.findByType(TouchableOpacity);
  expect(card.findAllByType(Pressable)).toHaveLength(0);
  act(() => toggle.props.onPress());
  expect(onToggle).toHaveBeenCalledTimes(1);
  expect(onPress).not.toHaveBeenCalled();
  expect(onLongPress).not.toHaveBeenCalled();
  act(() => card.props.onLongPress());
  expect(onLongPress).toHaveBeenCalledTimes(1);
  act(() => card.props.onPress());
  expect(onPress).toHaveBeenCalledTimes(1);
});

it.each([
  [
    true,
    'checking',
    undefined,
    'Enabled',
    'Availability: ',
    'No reading observed yet',
  ],
  [true, 'available', 0, 'Enabled', 'Availability: ', 'Observed by this phone'],
  [
    true,
    'available',
    undefined,
    'Enabled',
    'Availability: ',
    'No reading observed yet',
  ],
  [true, 'unavailable', 123, 'Enabled', 'Availability: ', 'No current reading'],
  [
    false,
    'available',
    123,
    'Disabled',
    'Last checked availability: ',
    'Paused while disabled',
  ],
])(
  'separates enabled intent, availability and reading (%#)',
  (enabled, availability, value, intent, prefix, reading) => {
    render({
      accentKey: 'location',
      enabled,
      availability,
      value,
      onToggle: jest.fn(),
    });
    const content = id => view.root.findByProps({testID: id}).props.children;
    expect(content('sensor-enabled-location')).toBe(intent);
    expect(content('sensor-availability-location').join('')).toContain(
      prefix.trim(),
    );
    expect(content('sensor-reading-location').join('')).toContain(reading);
    if (enabled && availability === 'available' && value === 0) {
      expect(view.root.findByType('Headline').props.children).toBe('0');
    } else {
      expect(view.root.findAllByType('Headline')).toHaveLength(0);
    }
    if (!enabled) {
      expect(
        view.root.findByProps({testID: 'sensor-toggle-location'}).props
          .accessibilityState,
      ).toEqual({checked: false});
    }
  },
);

it('does not infer a permission denial from unavailable hardware', () => {
  render({availability: 'unavailable', onToggle: jest.fn()});
  expect(text()).toContain('The app has not determined the cause');
  expect(text()).not.toContain('permission denial');
});

it('shows a purposeful cloud empty state instead of an unavailable-value abbreviation', () => {
  const property = Properties.find(item => item.id === 'writeableProp');
  render({...property, title: property.name, accentKey: property.id});
  expect(text()).toContain('Waiting for a cloud update');
  expect(text()).toContain('Values set in your IoT application appear here.');
  expect(text()).not.toContain('N/A');
});

it('starts the editable device property empty with an accessible input and a real placeholder', () => {
  const property = Properties.find(item => item.id === 'readOnlyProp');
  const edit = jest.fn();
  expect(property.value).toBeUndefined();
  render({
    ...property,
    title: property.name,
    accentKey: property.id,
    onEdit: edit,
  });
  const input = view.root.findByType('Input');
  expect(input.props.value).toBe('');
  expect(input.props.placeholder).toBe('Enter a value to share');
  expect(input.props.accessibilityLabel).toBe('Device property');
  expect(input.props.inputStyle.minHeight).toBeGreaterThanOrEqual(48);
  expect(view.root.findByType('Button').props.disabled).toBe(true);
  act(() => input.props.onChangeText('A real device value'));
  expect(view.root.findByType('Button').props.disabled).toBe(false);
  act(() => view.root.findByType('Button').props.onPress());
  expect(edit).toHaveBeenCalledWith('A real device value');
  expect(text()).not.toContain('N/A');
});

it.each([0, false])(
  'does not confuse the valid value %s with an empty property',
  value => {
    render({value, presentation: {emptyLabel: 'Waiting for a cloud update'}});
    expect(view.root.findByType('Headline').props.children).toBe(String(value));
    expect(text()).not.toContain('Waiting for a cloud update');
  },
);

it('lets an existing editable value be deliberately cleared and follows new source values', () => {
  const edit = jest.fn();
  render({value: 'old value', editable: true, onEdit: edit});
  act(() => view.root.findByType('Input').props.onChangeText(''));
  expect(view.root.findByType('Button').props.disabled).toBe(false);
  act(() => view.root.findByType('Button').props.onPress());
  expect(edit).toHaveBeenCalledWith('');
  act(() =>
    view.update(
      <Card
        title="Property"
        enabled
        value="new value"
        editable
        onEdit={edit}
      />,
    ),
  );
  expect(view.root.findByType('Input').props.value).toBe('new value');
});

it('uses the same clear label/value hierarchy for property and telemetry cards', () => {
  render({value: 12.5, dataType: 'number'});
  const label = view.root.findByProps({testID: 'card-label'});
  const value = view.root.findByProps({testID: 'card-value'});
  expect(StyleSheet.flatten(label.props.style).fontSize).toBeLessThan(
    StyleSheet.flatten(value.props.style).fontSize,
  );
  expect(StyleSheet.flatten(label.props.style).color).not.toBe(
    StyleSheet.flatten(value.props.style).color,
  );
});
