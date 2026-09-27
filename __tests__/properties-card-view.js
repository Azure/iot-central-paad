import React from 'react';
import renderer, {act} from 'react-test-renderer';
import * as Native from 'react-native';
import CardView from '../src/CardView';
import {Card} from '../src/components/card';
import {Properties} from '../src/properties';
import {PropertyDraftProvider} from '../src/runtime/propertyDrafts';

jest.mock('../src/hooks', () => ({
  useTheme: () => ({
    dark: false,
    colors: {text: '#111', card: '#fff', background: '#fff'},
  }),
}));
jest.mock('../src/components', () => ({Button: 'Button'}));
jest.mock('../src/components/typography', () => ({
  Text: 'Text',
  Headline: 'Headline',
  normalize: value => value,
  bytesToSize: value => `${value} bytes`,
}));
jest.mock('../src/components/bottomPopup', () => 'BottomPopup');
jest.mock('@rneui/themed', () => {
  const React = require('react');
  const ListItem = props =>
    React.createElement('ListItem', props, props.children);
  ListItem.Content = 'ListItemContent';
  ListItem.Title = 'ListItemTitle';
  return {ListItem, Icon: 'Icon', Input: 'Input'};
});

let view;
afterEach(() => {
  act(() => view?.unmount());
  jest.restoreAllMocks();
});
const render = (items = Properties, onEdit = jest.fn()) => {
  act(() => {
    view = renderer.create(
      <CardView items={items} componentName="Property" onEdit={onEdit} />,
    );
  });
  return onEdit;
};
const press = id =>
  view.root
    .findAllByProps({testID: id})
    .find(node => node.props.onPress)
    .props.onPress();

test('groups phone-edited and cloud-requested samples without making device information editable', () => {
  render();
  expect(view.root.findByType(Native.ScrollView).props).toMatchObject({
    automaticallyAdjustKeyboardInsets: true,
    keyboardShouldPersistTaps: 'handled',
  });
  expect(
    view.root.findByProps({testID: 'properties-group-phone'}).findByType(Card)
      .props.accentKey,
  ).toBe('readOnlyProp');
  expect(
    view.root.findByProps({testID: 'properties-group-cloud'}).findByType(Card)
      .props.accentKey,
  ).toBe('writeableProp');
  const device = view.root.findByProps({testID: 'properties-group-device'});
  expect(device.findAllByType(Card)).toHaveLength(8);
  expect(device.findAllByType(Card).every(card => !card.props.editable)).toBe(
    true,
  );
  expect(device.findAllByType('Input')).toHaveLength(0);
  expect(view.root.findAllByType('Input')).toHaveLength(1);
  expect(view.root.findByType('Input').props.testID).toBe(
    'property-input-readOnlyProp',
  );
  expect(JSON.stringify(view.toJSON())).toContain('Read-only to the cloud');
  expect(
    view.root.findAllByProps({testID: 'sensor-toggle-readOnlyProp'}),
  ).toHaveLength(0);
});

test('labels OS version and total capacities accurately while preserving values and technical names', () => {
  const items = Properties.map(item => ({
    ...item,
    value:
      item.id === 'swVersion'
        ? '26.5'
        : item.id === 'totalStorage'
        ? 1024
        : item.value,
  }));
  render(items);
  const os = view.root
    .findAllByType(Card)
    .find(card => card.props.accentKey === 'swVersion');
  expect(os.props.title).toBe('OS system version');
  expect(os.props.value).toBe('26.5');
  const text = JSON.stringify(view.toJSON());
  expect(text).toContain('not the app build');
  expect(text).toContain('Total storage capacity, not free or used storage');
  expect(text).toContain('Total memory capacity, not free or used memory');
  expect(
    view.root.findAllByProps({testID: 'property-name-swVersion'}),
  ).toHaveLength(0);
  act(() => press('property-technical-swVersion'));
  expect(
    view.root.findByProps({testID: 'property-name-swVersion'}).props,
  ).toMatchObject({children: 'swVersion', selectable: true});
  act(() => press('property-technical-swVersion'));
  expect(
    view.root.findAllByProps({testID: 'property-name-swVersion'}),
  ).toHaveLength(0);
  expect(items.find(item => item.id === 'swVersion').name).toBe(
    'OS system version',
  );
});

test('keeps an unsent draft through disclosure, unrelated cloud updates and responsive layout changes', () => {
  const dimensions = jest
    .spyOn(Native, 'useWindowDimensions')
    .mockReturnValue({width: 390, height: 844, scale: 2, fontScale: 1});
  const onEdit = render();
  const input = () => view.root.findByType('Input');
  act(() => input().props.onChangeText('unsent draft'));
  act(() => press('property-technical-readOnlyProp'));
  expect(onEdit).not.toHaveBeenCalled();
  dimensions.mockReturnValue({width: 820, height: 500, scale: 2, fontScale: 2});
  const updates = Properties.map(item =>
    item.id === 'writeableProp' ? {...item, value: 'cloud update'} : item,
  );
  act(() =>
    view.update(
      <CardView items={updates} componentName="Property" onEdit={onEdit} />,
    ),
  );
  expect(input().props.value).toBe('unsent draft');
  act(() => press('property-submit-readOnlyProp'));
  expect(onEdit).toHaveBeenCalledWith(
    Properties.find(item => item.id === 'readOnlyProp'),
    'unsent draft',
  );
  expect(input().props.value).toBe('unsent draft');
  act(() =>
    view.update(
      <CardView
        items={updates.map(item =>
          item.id === 'readOnlyProp' ? {...item, value: 'source value'} : item,
        )}
        componentName="Property"
        onEdit={onEdit}
      />,
    ),
  );
  expect(input().props.value).toBe('source value');
});

test('uses the existing sensor action for explicit toggles and retains long-press confirmation and retry', async () => {
  const action = jest.fn();
  const retry = jest.fn();
  const item = {
    id: 'test',
    name: 'Sensor',
    enabled: true,
    availability: 'unavailable',
    retry,
    enable: jest.fn(),
  };
  act(() => {
    view = renderer.create(
      <CardView
        items={[item]}
        componentName="Telemetry"
        onItemLongPress={action}
      />,
    );
  });
  await act(async () => press('sensor-toggle-test'));
  expect(action).toHaveBeenCalledWith(item);
  expect(item.enable).not.toHaveBeenCalled();
  act(() => view.root.findByType(Card).props.onLongPress());
  expect(view.root.findByType('BottomPopup').props.isVisible).toBe(true);
  const retryRow = view.root
    .findAllByType('ListItem')
    .find(
      node =>
        node.findByType('ListItemTitle').props.children === 'Retry sensor',
    );
  act(() => retryRow.props.onPress());
  expect(retry).toHaveBeenCalledTimes(1);
  expect(view.root.findByType('BottomPopup').props.isVisible).toBe(false);
  act(() => view.root.findByType(Card).props.onLongPress());
  const toggleRow = view.root
    .findAllByType('ListItem')
    .find(
      node =>
        node.findByType('ListItemTitle').props.children === 'Disable sensor',
    );
  await act(async () => toggleRow.props.onPress());
  expect(action).toHaveBeenCalledTimes(2);
});

test('retains one editable draft through Properties pop, another tool, and reopening without submitting', () => {
  const onEdit = jest.fn();
  const screen = (route, items = Properties) => (
    <PropertyDraftProvider properties={items}>
      {route === 'Properties' ? (
        <CardView items={items} componentName="Property" onEdit={onEdit} />
      ) : (
        <Native.View testID={route} />
      )}
    </PropertyDraftProvider>
  );
  act(() => {
    view = renderer.create(screen('Properties'));
  });
  act(() =>
    view.root.findByType('Input').props.onChangeText('saved unsent draft'),
  );
  act(() => view.update(screen('directory')));
  expect(view.root.findAllByType('Input')).toHaveLength(0);
  act(() => view.update(screen('Telemetry')));
  expect(view.root.findAllByType(Card)).toHaveLength(0);
  act(() => view.update(screen('Properties')));
  expect(view.root.findAllByType('Input')).toHaveLength(1);
  expect(view.root.findByType('Input').props.value).toBe('saved unsent draft');
  expect(onEdit).not.toHaveBeenCalled();
  act(() => press('property-submit-readOnlyProp'));
  expect(onEdit).toHaveBeenCalledWith(
    Properties.find(item => item.id === 'readOnlyProp'),
    'saved unsent draft',
  );
  act(() => view.update(screen('directory')));
  act(() => view.update(screen('Properties')));
  expect(view.root.findByType('Input').props.value).toBe('saved unsent draft');
});

test('observes source changes while popped, preserves deliberate clears, and does not restore an old draft when a source returns', () => {
  const onEdit = jest.fn();
  const items = value =>
    Properties.map(item =>
      item.id === 'readOnlyProp' ? {...item, value} : item,
    );
  const screen = (shown, value) => {
    const source = items(value);
    return (
      <PropertyDraftProvider properties={source}>
        {shown ? (
          <CardView items={source} componentName="Property" onEdit={onEdit} />
        ) : (
          <Native.View />
        )}
      </PropertyDraftProvider>
    );
  };
  act(() => {
    view = renderer.create(screen(true, 'original'));
  });
  act(() => view.root.findByType('Input').props.onChangeText(''));
  act(() => view.update(screen(false, 'original')));
  act(() => view.update(screen(true, 'original')));
  expect(view.root.findByType('Input').props.value).toBe('');
  expect(view.root.findByType('Button').props.disabled).toBe(false);
  act(() => view.update(screen(false, 'original')));
  act(() => view.update(screen(false, 'new source')));
  act(() => view.update(screen(false, 'original')));
  act(() => view.update(screen(true, 'original')));
  expect(view.root.findByType('Input').props.value).toBe('original');
  expect(view.root.findByType('Button').props.disabled).toBe(true);
  expect(onEdit).not.toHaveBeenCalled();
});

test('drafts are scoped to the provider and discarded when the provider leaves the runtime', () => {
  const screen = () => (
    <PropertyDraftProvider properties={Properties}>
      <CardView
        items={Properties}
        componentName="Property"
        onEdit={jest.fn()}
      />
    </PropertyDraftProvider>
  );
  act(() => {
    view = renderer.create(screen());
  });
  act(() =>
    view.root.findByType('Input').props.onChangeText('old session draft'),
  );
  act(() => view.update(<Native.View />));
  act(() => view.update(screen()));
  expect(view.root.findByType('Input').props.value).toBe('');
});
