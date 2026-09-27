import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {StyleSheet} from 'react-native';
import ConnectionNotice from '../src/components/connectionNotice';
import {ConnectionError} from '../src/connection/errors';
import {palette} from '../src/theme/palette';

jest.mock('@rneui/themed', () => ({Icon: 'Icon'}));
jest.mock('../src/hooks', () => ({useTheme: () => ({dark: false})}));
jest.mock('../src/components/typography', () => ({Text: 'Text'}));

let view;
const render = element =>
  act(() => {
    view = renderer.create(element);
  });
const json = () => JSON.stringify(view.toJSON());
const value = id =>
  view.root.findAllByType('Text').find(node => node.props.testID === id)?.props
    .children;
afterEach(() => {
  act(() => view?.unmount());
  view = undefined;
});

it('styles an interrupted session distinctly from a failed initial connection', () => {
  render(
    <ConnectionNotice error={new ConnectionError('CONNECTION_LOST')} />, // no diagnostics
  );
  expect(json()).toContain('Connection interrupted');
  expect(json()).toContain('The cloud connection was interrupted.');
  expect(json()).toContain('Reconnect to resume sending data.');
  // A compact notice without diagnostics never leaks the raw code.
  expect(json()).not.toContain('CONNECTION_LOST');

  act(() => view.unmount());
  render(<ConnectionNotice error={new ConnectionError('CONNECT_FAILED')} />);
  expect(json()).toContain('Could not connect');
  expect(json()).not.toContain('Credentials');
  expect(json()).not.toContain('invalid');
});

it('announces politely on a restrained danger surface that grows with the text', () => {
  render(<ConnectionNotice error={new ConnectionError('CONNECT_FAILED')} />);
  const container = view.root
    .findAllByProps({testID: 'connection-error'})
    .find(node => typeof node.type === 'string');
  expect(container.props.accessibilityRole).toBe('alert');
  expect(container.props.accessibilityLiveRegion).toBe('polite');
  const style = StyleSheet.flatten(container.props.style);
  expect(style.backgroundColor).toBe(palette(false).dangerSurface);
  expect(style.height).toBeUndefined();
  expect(style.maxHeight).toBeUndefined();
  expect(
    view.root
      .findAllByType('Text')
      .every(node => node.props.numberOfLines === undefined),
  ).toBe(true);
});

it('describes intentional disconnection without inventing a transport failure', () => {
  render(<ConnectionNotice disconnected diagnostics />);
  expect(json()).toContain('Disconnected on this phone');
  expect(json()).toContain('Your saved connection is kept');
  expect(json()).not.toContain('Connection interrupted');
  expect(json()).not.toContain('CONNECTION_LOST');
  expect(value('connection-error-code')).toBeUndefined();
  expect(view.root.findByType('Icon').props.name).toBe('link-variant-off');
  const notice = view.root.findAllByProps({
    testID: 'connection-disconnected',
  })[0];
  expect(notice.props.accessibilityLiveRegion).toBe('polite');
});

it('offers a single comfortably sized recovery action', () => {
  const onPress = jest.fn();
  render(
    <ConnectionNotice
      error={new ConnectionError('CONNECT_FAILED')}
      action={{label: 'Retry', onPress, testID: 'connection-error-retry'}}
    />,
  );
  const buttons = view.root.findAll(
    node =>
      typeof node.type === 'string' &&
      node.props.accessibilityRole === 'button',
  );
  expect(buttons).toHaveLength(1);
  expect(
    StyleSheet.flatten(buttons[0].props.style).minHeight,
  ).toBeGreaterThanOrEqual(48);
  const pressable = view.root
    .findAllByProps({testID: 'connection-error-retry'})
    .find(node => typeof node.props.onPress === 'function');
  act(() => pressable.props.onPress());
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('exposes only sanitized technical values behind stable IDs', () => {
  render(
    <ConnectionNotice
      diagnostics
      error={
        new ConnectionError('PROVISIONING_FAILED', {
          status: 400,
          serviceCode: 400123,
          operationId: 'operation-7',
          // Rejected by the sanitizers, and never reachable from the UI.
          cause: 'fixture-secret-must-not-be-exposed',
        })
      }
    />,
  );
  expect(value('connection-error-code')).toBe('PROVISIONING_FAILED');
  expect(value('connection-http-status')).toBe('HTTP 400');
  expect(value('connection-service-code')).toBe(400123);
  expect(value('connection-operation-id')).toBe('operation-7');
  expect(json()).not.toContain('fixture-secret');
});

it('omits diagnostics that are absent or implausible', () => {
  render(
    <ConnectionNotice
      diagnostics
      error={
        new ConnectionError('NETWORK_ERROR', {
          status: 9999,
          serviceCode: 'not-a-number',
          operationId: 'spaces are rejected',
        })
      }
    />,
  );
  expect(value('connection-error-code')).toBe('NETWORK_ERROR');
  expect(value('connection-http-status')).toBeUndefined();
  expect(value('connection-service-code')).toBeUndefined();
  expect(value('connection-operation-id')).toBeUndefined();
  expect(json()).not.toContain('9999');
});
