import React from 'react';
import renderer, {act} from 'react-test-renderer';
import ConnectionSummary from '../src/components/connectionSummary';
import * as hooks from '../src/hooks';
import {Alert, Share, Modal, Platform, StyleSheet} from 'react-native';
import {PHONE_MODEL_ID} from '../src/connection/types';
import {ConnectionError} from '../src/connection/errors';
import {palette} from '../src/theme/palette';
import {surfaceColor} from '../src/components/surface';
import Strings from '../src/strings';
jest.mock('@rneui/themed', () => ({Icon: 'Icon'}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 60, bottom: 24, left: 14, right: 8}),
}));

jest.mock('../src/hooks', () => ({
  useConnectIoTCentralClient: jest.fn(),
  useIoTCentralClient: jest.fn(),
  useSimulation: jest.fn(),
  useTheme: jest.fn(),
}));
jest.mock('../src/components/typography', () => ({Text: 'Text', Name: 'Text'}));

let view;
let connected;
let state;
const connect = jest.fn(async () => ({ok: true}));
const cancel = jest.fn(async () => {});
const clear = jest.fn();
const manual = jest.fn();
const originalOS = Platform.OS;
const text = () => JSON.stringify(view.toJSON());
// The painted pill inside a compact summary action; it carries no touch target.
const pill = control =>
  control.findAll(
    node =>
      typeof node.type === 'string' &&
      StyleSheet.flatten(node.props.style)?.minHeight === 40,
  )[0];
const press = label =>
  view.root
    .findAll(
      node =>
        node.props.accessibilityRole === 'button' &&
        (node.props.accessibilityLabel === label ||
          node
            .findAllByType('Text')
            .some(child => child.props.children === label)),
    )[0]
    .props.onPress();
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  connected = true;
  state = {
    client: {
      id: 'registration-id',
      identity: {
        deviceId: 'Exact-Assigned-ID',
        assignedHub: 'assigned.azure-devices.net',
        registrationId: 'registration-id',
        modelId: PHONE_MODEL_ID,
      },
      isConnected: () => connected,
    },
    loading: false,
    error: null,
    stage: 'connected',
  };
  hooks.useConnectIoTCentralClient.mockImplementation(() => [
    connect,
    cancel,
    clear,
    state,
  ]);
  hooks.useIoTCentralClient.mockReturnValue([
    null,
    {deviceId: 'registration-id'},
  ]);
  hooks.useSimulation.mockReturnValue([false]);
  hooks.useTheme.mockReturnValue({dark: false, colors: {card: '#fff'}});
});
it('reports modal coverage so native Home decoration stops behind Details', () => {
  const visibility = jest.fn();
  act(() => {
    view = renderer.create(
      <ConnectionSummary
        onManualConnection={manual}
        onDetailsVisibilityChange={visibility}
      />,
    );
  });
  expect(visibility).toHaveBeenLastCalledWith(false);
  act(() => press('Connection details'));
  expect(visibility).toHaveBeenLastCalledWith(true);
  act(() => view.root.findByType(Modal).props.onRequestClose());
  expect(visibility).toHaveBeenLastCalledWith(false);
});
it('opens scrollable details with value-only IDs and local-only destructive forgetting', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const share = jest.spyOn(Share, 'share').mockResolvedValue({});
  act(() => {
    view = renderer.create(<ConnectionSummary onManualConnection={manual} />);
  });

  act(() => press('Connection details'));
  expect(view.root.findByType(Modal).props.allowSwipeDismissal).toBe(
    Platform.OS === 'ios',
  );
  const value = id =>
    view.root.findAllByType('Text').find(node => node.props.testID === id)
      ?.props.children;
  expect(value('assigned-device-id')).toBe('Exact-Assigned-ID');
  expect(value('assigned-hub')).toBe('assigned.azure-devices.net');
  expect(value('model-id')).toBe(PHONE_MODEL_ID);
  expect(value('registration-id')).toBe('registration-id');
  expect(value('registry-status')).toBe('Not checked');
  const sheet = view.root.findAllByProps({testID: 'connection-details-sheet'});
  expect(sheet.length).toBeGreaterThan(0);
  expect(
    view.root.findAllByProps({testID: 'connection-details-close'}).length,
  ).toBeGreaterThan(0);
  await act(async () => {
    await press('Share nonsecret diagnostics');
  });
  expect(JSON.parse(share.mock.calls[0][0].message)).toMatchObject({
    registryStatus: 'Not checked',
  });
  act(() => press('Forget credentials'));
  expect(cancel).not.toHaveBeenCalled();
  expect(alert.mock.calls[0][1]).toContain('No Azure device');
  await act(async () => {
    await alert.mock.calls[0][2]
      .find(button => button.style === 'destructive')
      .onPress();
  });
  expect(cancel).toHaveBeenCalledWith({clear: true});
  alert.mockRestore();
  share.mockRestore();
});
it('opens the single authoritative sheet from Home attention without reconnecting', () => {
  act(() => {
    view = renderer.create(
      <ConnectionSummary onManualConnection={manual} detailsRequest={0} />,
    );
  });
  expect(view.root.findAllByType(Modal)).toHaveLength(0);
  act(() => {
    view.update(
      <ConnectionSummary onManualConnection={manual} detailsRequest={1} />,
    );
  });
  expect(view.root.findAllByType(Modal)).toHaveLength(1);
  expect(view.root.findByType(Modal).props.visible).toBe(true);
  expect(connect).not.toHaveBeenCalled();
  expect(cancel).not.toHaveBeenCalled();
  act(() => view.root.findByType(Modal).props.onRequestClose());
  act(() => {
    view.update(
      <ConnectionSummary onManualConnection={manual} detailsRequest={2} />,
    );
  });
  expect(view.root.findByType(Modal).props.visible).toBe(true);
});
it('announces requested versus presented Details without changing navigation or visuals', () => {
  act(() => {
    view = renderer.create(<ConnectionSummary onManualConnection={manual} />);
  });
  const disclosure = () =>
    view.root.findAllByProps({testID: 'connection-details'})[0];
  expect(disclosure().props.accessibilityState).toEqual({
    busy: false,
    expanded: false,
  });
  const style = disclosure().props.style;
  act(() => press('Connection details'));
  expect(disclosure().props.accessibilityState).toEqual({
    busy: true,
    expanded: false,
  });
  const onShow = view.root.findByType(Modal).props.onShow;
  act(() => onShow());
  expect(disclosure().props.accessibilityState).toEqual({
    busy: false,
    expanded: true,
  });
  expect(disclosure().props.style).toEqual(style);
  act(() => view.root.findByType(Modal).props.onRequestClose());
  expect(disclosure().props.accessibilityState).toEqual({
    busy: false,
    expanded: false,
  });
  act(() => onShow());
  expect(disclosure().props.accessibilityState).toEqual({
    busy: false,
    expanded: false,
  });
  act(() => press('Connection details'));
  expect(disclosure().props.accessibilityState).toEqual({
    busy: true,
    expanded: false,
  });
  act(() =>
    view.root
      .findAllByProps({testID: 'connection-details-close'})[0]
      .props.onPress(),
  );
  expect(disclosure().props.accessibilityState).toEqual({
    busy: false,
    expanded: false,
  });
});
afterEach(() => {
  act(() => view?.unmount());
  view = undefined;
  jest.runAllTicks();
  expect(jest.getTimerCount()).toBe(0);
  jest.useRealTimers();
  jest.restoreAllMocks();
  Platform.OS = originalOS;
});

it.each([false, true])(
  'uses a spaced, theme-aware status emblem and tactile Details pill (%s)',
  dark => {
    hooks.useTheme.mockReturnValue({dark, colors: {card: '#fff'}});
    act(() => {
      view = renderer.create(<ConnectionSummary onManualConnection={manual} />);
    });
    const capsule = view.root.findByProps({
      testID: 'connection-status-capsule',
    });
    expect(StyleSheet.flatten(capsule.props.style)).toMatchObject({
      backgroundColor: palette(dark).surface,
      borderColor: palette(dark).border,
      borderRadius: 20,
      minHeight: 60,
    });
    for (const key of [
      'shadowColor',
      'shadowOpacity',
      'shadowRadius',
      'shadowOffset',
      'elevation',
    ]) {
      expect(StyleSheet.flatten(capsule.props.style)[key]).toBeUndefined();
    }
    const group = view.root.findByProps({testID: 'connection-status-group'});
    expect(StyleSheet.flatten(group.props.style).gap).toBeGreaterThanOrEqual(
      14,
    );
    const emblem = view.root.findByProps({testID: 'connection-status-emblem'});
    expect(emblem.props).toMatchObject({
      accessible: false,
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
    });
    expect(emblem.findByType('Icon').props).toMatchObject({
      name: 'cloud-check-outline',
      color: palette(dark).positive,
    });
    const disclosure = view.root
      .findAllByProps({testID: 'connection-details'})
      .find(node => node.props.onPress);
    expect(StyleSheet.flatten(disclosure.props.style)).toMatchObject({
      minHeight: 48,
      minWidth: 92,
    });
    expect(StyleSheet.flatten(pill(disclosure).props.style)).toMatchObject({
      backgroundColor: surfaceColor(dark, {tone: 'secondary'}),
      minHeight: 40,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
    });
    // Pressed feedback is a tonal background step, never dimmed text.
    act(() => disclosure.props.onPressIn());
    const held = StyleSheet.flatten(pill(disclosure).props.style);
    expect(held.backgroundColor).toBe(
      surfaceColor(dark, {tone: 'secondary', pressed: true}),
    );
    expect(held.backgroundColor).not.toBe(
      surfaceColor(dark, {tone: 'secondary'}),
    );
    expect(held.opacity).toBeUndefined();
    expect(
      view.root
        .findAllByType('Text')
        .every(
          node => StyleSheet.flatten(node.props.style)?.opacity === undefined,
        ),
    ).toBe(true);
    act(() => disclosure.props.onPressOut());
    expect(
      StyleSheet.flatten(pill(disclosure).props.style).backgroundColor,
    ).toBe(surfaceColor(dark, {tone: 'secondary'}));
  },
);

it.each([
  [320, 1, 'row'],
  [320, 1.45, 'row'],
  [320, 1.8, 'column'],
  [390, 2.5, 'column'],
])(
  'reflows the status/action without truncating text at width %s and scale %s',
  (width, fontScale, direction) => {
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
      width,
      fontScale,
      height: 800,
      scale: 2,
    });
    connected = false;
    act(() => {
      view = renderer.create(<ConnectionSummary onManualConnection={manual} />);
    });
    const capsule = view.root.findByProps({
      testID: 'connection-status-capsule',
    });
    expect(StyleSheet.flatten(capsule.props.style).flexDirection).toBe(
      direction,
    );
    const status = view.root.findByProps({testID: 'connection-status'});
    expect(status.props.children).toBe('Disconnected');
    expect(status.props.numberOfLines).toBeUndefined();
    expect(status.props.maxFontSizeMultiplier).toBeUndefined();
    const action = view.root
      .findAllByProps({testID: 'connection-details'})
      .find(node => node.props.onPress);
    expect(
      StyleSheet.flatten(action.props.style).minHeight,
    ).toBeGreaterThanOrEqual(48);
    if (direction === 'column') {
      expect(StyleSheet.flatten(action.props.style).alignSelf).toBe('stretch');
      expect(StyleSheet.flatten(pill(action).props.style).alignSelf).toBe(
        'stretch',
      );
    }
  },
);

it('keeps simulation honest during loading and gives Cancel the same real touch target', async () => {
  hooks.useSimulation.mockReturnValue([true]);
  state = {...state, loading: true, stage: 'connecting'};
  act(() => {
    view = renderer.create(<ConnectionSummary onManualConnection={manual} />);
  });
  const group = view.root.findByProps({testID: 'connection-status-group'});
  expect(group.findAllByType('Text').map(node => node.props.children)).toEqual(
    expect.arrayContaining([
      'Disconnected',
      'Offline simulation — no cloud connection',
      Strings.Connection.Stages.connecting,
    ]),
  );
  const emblem = view.root.findByProps({testID: 'connection-status-emblem'});
  expect(emblem.findByType('Icon').props).toMatchObject({
    name: 'cloud-outline',
    color: palette(false).muted,
  });
  const action = view.root
    .findAllByProps({testID: 'connection-cancel'})
    .find(node => node.props.onPress);
  expect(StyleSheet.flatten(action.props.style)).toMatchObject({
    minHeight: 48,
    minWidth: 92,
  });
  expect(StyleSheet.flatten(pill(action).props.style)).toMatchObject({
    backgroundColor: surfaceColor(false, {tone: 'secondary'}),
    borderRadius: 14,
  });
  await act(async () => {
    await action.props.onPress();
  });
  expect(cancel).toHaveBeenCalledTimes(1);
});
it.each(['android', 'ios'])(
  'protects Android modal controls from system insets without double-insetting the iOS page sheet (%s)',
  os => {
    Platform.OS = os;
    act(() => {
      view = renderer.create(<ConnectionSummary onManualConnection={manual} />);
    });
    act(() => press('Connection details'));
    const sheet = view.root.findAllByProps({
      testID: 'connection-details-sheet',
    })[0];
    const style = StyleSheet.flatten(sheet.props.style);
    if (os === 'android') {
      expect(style).toMatchObject({
        paddingTop: 60,
        paddingBottom: 24,
        paddingLeft: 14,
        paddingRight: 8,
      });
    } else {
      expect(style.paddingTop).toBeUndefined();
    }
    act(() => press('Close'));
    expect(
      view.root.findAllByProps({testID: 'connection-details-sheet'}),
    ).toHaveLength(0);
  },
);
it('keeps the status row compact and preserves all actions and exact identity in details', async () => {
  act(() => {
    view = renderer.create(<ConnectionSummary onManualConnection={manual} />);
  });
  expect(text()).not.toContain('Exact-Assigned-ID');
  expect(text()).not.toContain('assigned.azure-devices.net');
  expect(text()).not.toContain('registration-id');
  expect(text()).toContain('Connected');
  expect(
    view.root
      .findAllByType('Text')
      .some(node => node.props.children === 'Cloud connection'),
  ).toBe(false);
  expect(
    view.root.findAllByProps({testID: 'connection-status'})[0].props
      .accessibilityHint,
  ).toBe('Cloud connection');
  expect(text()).not.toContain('connection-disconnect');
  const disclosure = view.root
    .findAllByProps({testID: 'connection-details'})
    .find(node => node.props.onPress);
  expect(disclosure.props.hitSlop).toBeDefined();
  expect(
    view.root
      .findAllByType('Icon')
      .some(icon => icon.props.name === 'chevron-right'),
  ).toBe(true);
  act(() => press('Connection details'));
  expect(text()).toContain('Exact-Assigned-ID');
  expect(text()).toContain('assigned.azure-devices.net');
  act(() => press('Disconnect'));
  expect(clear).toHaveBeenCalledTimes(1);
  expect(clear).toHaveBeenCalledWith({disconnected: true});
  connected = false;
  act(() => jest.advanceTimersByTime(1000));
  expect(text()).toContain('Disconnected');
  await act(async () => {
    await press('Reconnect');
  });
  expect(connect).toHaveBeenCalledWith({deviceId: 'registration-id'});
  expect(text()).not.toContain('connection-details-sheet');
  act(() => press('Connection details'));
  act(() => press('Connect manually'));
  expect(manual).toHaveBeenCalledTimes(1);
  expect(text()).not.toContain('connection-details-sheet');
});
it('offers Home recovery after an intentional disconnect without reporting an error', async () => {
  connected = false;
  state = {...state, client: null, stage: 'disconnected'};
  act(() => {
    view = renderer.create(<ConnectionSummary onManualConnection={manual} />);
  });
  expect(text()).not.toContain('Disconnected on this phone');
  expect(text()).not.toContain(Strings.Connection.Notice.Disconnected.Message);
  expect(text()).not.toContain('Connection interrupted');
  expect(text()).not.toContain('CONNECTION_LOST');
  const status = view.root.findAllByProps({testID: 'connection-status'})[0];
  expect(status.props.children).toBe('Disconnected');
  expect(StyleSheet.flatten(status.props.style).color).toBe(
    palette(false).danger,
  );
  expect(
    view.root
      .findByProps({testID: 'connection-status-emblem'})
      .findByType('Icon').props.name,
  ).toBe('cloud-off-outline');
  const reconnect = view.root
    .findAllByProps({
      testID: 'connection-disconnected-reconnect',
    })
    .find(node => node.props.onPress);
  expect(reconnect.props.accessibilityHint).toBe(
    Strings.Connection.Summary.ReconnectDetail,
  );
  await act(async () => reconnect.props.onPress());
  expect(connect).toHaveBeenCalledWith({deviceId: 'registration-id'});
  expect(clear).not.toHaveBeenCalled();
  expect(cancel).not.toHaveBeenCalled();
});

it.each(['idle', 'loading', 'simulation', 'no-credentials'])(
  'does not show intentional-disconnect recovery for %s',
  condition => {
    connected = false;
    state = {...state, client: null, stage: 'disconnected'};
    if (condition === 'idle') state.stage = 'idle';
    if (condition === 'loading') state.loading = true;
    if (condition === 'simulation') hooks.useSimulation.mockReturnValue([true]);
    if (condition === 'no-credentials')
      hooks.useIoTCentralClient.mockReturnValue([null, null]);
    act(() => {
      view = renderer.create(<ConnectionSummary onManualConnection={manual} />);
    });
    expect(
      view.root.findAllByProps({testID: 'connection-disconnected-reconnect'}),
    ).toHaveLength(0);
  },
);
it('labels simulation as offline and exposes cancellation for the shared active request', async () => {
  hooks.useSimulation.mockReturnValue([true]);
  state = {...state, loading: true, stage: 'connecting'};
  act(() => {
    view = renderer.create(<ConnectionSummary onManualConnection={manual} />);
  });
  expect(text()).toContain('Offline simulation');
  expect(text()).toContain('Disconnected');
  expect(text()).not.toContain('Assigned device');
  await act(async () => {
    await press('Cancel');
  });
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(connect).not.toHaveBeenCalled();
});

it('replaces the plain error line with one actionable notice and keeps codes in details', async () => {
  connected = false;
  state = {
    ...state,
    error: new ConnectionError('CONNECT_FAILED', {
      status: 503,
      serviceCode: 404001,
      operationId: 'operation-9',
    }),
    stage: 'idle',
  };
  act(() => {
    view = renderer.create(<ConnectionSummary onManualConnection={manual} />);
  });
  const notices = view.root
    .findAllByProps({testID: 'connection-error'})
    .filter(node => typeof node.type === 'string');
  expect(notices).toHaveLength(1);
  expect(StyleSheet.flatten(notices[0].props.style).backgroundColor).toBe(
    palette(false).dangerSurface,
  );
  expect(text()).toContain('Could not connect');
  expect(text()).toContain('The device transport could not connect.');
  // Raw diagnostics stay in the details sheet, not in the compact row.
  expect(text()).not.toContain('CONNECT_FAILED');
  expect(text()).not.toContain('HTTP 503');
  expect(text()).not.toContain('404001');

  act(() => press('Connection details'));
  const value = id =>
    view.root.findAllByType('Text').filter(node => node.props.testID === id);
  expect(value('connection-error-code').map(n => n.props.children)).toEqual([
    'CONNECT_FAILED',
  ]);
  expect(value('connection-http-status').map(n => n.props.children)).toEqual([
    'HTTP 503',
  ]);
  expect(value('connection-service-code').map(n => n.props.children)).toEqual([
    '404001',
  ]);
  act(() => press('Close'));

  await act(async () => {
    await press('Reconnect');
  });
  expect(connect).toHaveBeenCalledWith({deviceId: 'registration-id'});
});

it('falls back to reviewing details when there is nothing saved to reconnect with', () => {
  connected = false;
  hooks.useIoTCentralClient.mockReturnValue([null, null]);
  state = {...state, error: new ConnectionError('CONNECTION_LOST')};
  act(() => {
    view = renderer.create(<ConnectionSummary onManualConnection={manual} />);
  });
  expect(text()).toContain('Connection interrupted');
  expect(
    view.root.findAllByProps({testID: 'connection-error-reconnect'}),
  ).toHaveLength(0);
  act(() => press('Connection details'));
  expect(
    view.root.findAllByProps({testID: 'connection-details-sheet'}).length,
  ).toBeGreaterThan(0);
  expect(connect).not.toHaveBeenCalled();
});

it.each([
  [320, 1],
  [390, 1],
  [320, 2.5],
])(
  'shows an interrupted status and compact recovery without duplicate prose at %s/%s',
  async (width, fontScale) => {
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
      width,
      fontScale,
      height: 800,
      scale: 2,
    });
    connected = false;
    state = {
      ...state,
      error: new ConnectionError('CONNECTION_LOST'),
      stage: 'error',
    };
    act(() => {
      view = renderer.create(<ConnectionSummary onManualConnection={manual} />);
    });
    expect(
      view.root.findByProps({testID: 'connection-status'}).props.children,
    ).toBe('Connection interrupted');
    expect(
      view.root
        .findByProps({testID: 'connection-status-emblem'})
        .findByType('Icon').props.name,
    ).toBe('cloud-alert');
    expect(view.root.findAllByProps({testID: 'connection-error'})).toHaveLength(
      0,
    );
    expect(
      view.root.findAllByType('Text').map(node => node.props.children),
    ).toEqual(['Connection interrupted', 'Reconnect', 'Details']);
    const actions = view.root.findByProps({
      testID: 'connection-summary-recovery',
    });
    expect(StyleSheet.flatten(actions.props.style)).toMatchObject({
      flexDirection: 'row',
      flexWrap: 'wrap',
      maxWidth: '100%',
    });
    for (const id of ['connection-error-reconnect', 'connection-details']) {
      const action = view.root
        .findAllByProps({testID: id})
        .find(node => node.props.onPress);
      expect(StyleSheet.flatten(action.props.style)).toMatchObject({
        minHeight: 48,
        maxWidth: '100%',
      });
      expect(StyleSheet.flatten(pill(action).props.style).minHeight).toBe(40);
    }
    const group = view.root.findByProps({testID: 'connection-status-group'});
    expect(StyleSheet.flatten(group.props.style).flexBasis).toBe(
      fontScale > 1.45 ? undefined : 180,
    );
    act(() => press('Connection details'));
    expect(text()).toContain('CONNECTION_LOST');
    act(() => press('Close'));
    await act(async () => press('Reconnect'));
    expect(connect).toHaveBeenCalledWith({deviceId: 'registration-id'});
  },
);

it('hides the notice while a connection attempt is in flight', () => {
  state = {
    ...state,
    loading: true,
    stage: 'connecting',
    error: new ConnectionError('CONNECT_FAILED'),
  };
  act(() => {
    view = renderer.create(<ConnectionSummary onManualConnection={manual} />);
  });
  expect(view.root.findAllByProps({testID: 'connection-error'})).toHaveLength(
    0,
  );
  expect(text()).toContain('Connecting to the assigned IoT Hub');
});

it.each([
  [false, 1],
  [true, 1],
  [false, 2.5],
  [true, 2.5],
])(
  'unifies details without scaling or truncating identity values (dark %s, font scale %s)',
  (dark, fontScale) => {
    hooks.useTheme.mockReturnValue({dark, colors: {card: '#fff'}});
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
      width: 320,
      fontScale,
      height: 800,
      scale: 2,
    });
    connected = false;
    state.client.identity.operationId = 'operation-id-with-exact-case';
    state.client.identity.deviceId = `Assigned-${'x'.repeat(128)}`;
    act(() => {
      view = renderer.create(<ConnectionSummary onManualConnection={manual} />);
    });
    act(() => press('Connection details'));
    const colors = palette(dark);
    const textNode = content =>
      view.root
        .findAllByType('Text')
        .find(node => node.props.children === content);
    const style = node =>
      StyleSheet.flatten(
        typeof node.props.style === 'function'
          ? node.props.style({pressed: false})
          : node.props.style,
      );
    const control = id => view.root.findAllByProps({testID: id})[0];
    const titleStyle = {
      fontSize: 17,
      lineHeight: 24,
      fontWeight: '600',
      letterSpacing: -0.2,
      color: colors.text,
    };
    for (const title of [
      Strings.Connection.Summary.Registry,
      Strings.Connection.Summary.ProofTitle,
      Strings.AzureContext.Title,
    ]) {
      expect(style(textNode(title))).toMatchObject(titleStyle);
      expect(textNode(title).props.accessibilityRole).toBe('header');
    }
    expect(style(textNode(Strings.Connection.Summary.Details))).toMatchObject({
      fontSize: 24,
      lineHeight: 31,
      fontWeight: '600',
      letterSpacing: -0.5,
    });
    for (const [id, value] of [
      ['assigned-device-id', state.client.identity.deviceId],
      ['registration-id', state.client.identity.registrationId],
      [undefined, state.client.identity.operationId],
    ]) {
      const node = id ? control(id) : textNode(value);
      expect(node.props.children).toBe(value);
      expect(node.props.selectable).toBe(true);
      expect(style(node)).toMatchObject({
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontSize: 14,
        lineHeight: 22,
        color: colors.text,
      });
    }
    for (const id of ['assigned-hub', 'model-id']) {
      expect(control(id).props.selectable).toBe(true);
      expect(style(control(id))).toMatchObject({
        fontSize: 15,
        lineHeight: 22,
        fontWeight: '400',
        color: colors.text,
      });
      expect(style(control(id)).fontFamily).toBeUndefined();
    }
    for (const node of view.root.findAllByType('Text')) {
      expect(node.props.numberOfLines).toBeUndefined();
      expect(node.props.maxFontSizeMultiplier).toBeUndefined();
      expect(node.props.allowFontScaling).not.toBe(false);
    }
    const badge = control('registry-status');
    expect(badge.props.children).toBe('Not checked');
    expect(style(badge)).toMatchObject({
      backgroundColor: colors.inset,
      color: colors.muted,
      borderColor: colors.border,
      borderWidth: StyleSheet.hairlineWidth,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '600',
    });
    expect(style(control('connection-details-close'))).toMatchObject({
      minHeight: 48,
      borderRadius: 14,
      paddingHorizontal: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.controlBorder,
      backgroundColor: surfaceColor(dark, {tone: 'secondary'}),
    });
    for (const id of ['connection-reconnect', 'connection-manual']) {
      expect(style(control(id))).toMatchObject({
        minHeight: 48,
        borderRadius: 14,
        paddingHorizontal: 14,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        backgroundColor: colors.tints[0],
      });
    }
    expect(style(textNode(Strings.Connection.Summary.Disconnect)).color).toBe(
      colors.danger,
    );
    expect(style(control('connection-forget'))).toMatchObject({
      backgroundColor: colors.dangerSurface,
      minHeight: 48,
      borderRadius: 14,
    });
    const card = textNode(Strings.Connection.Summary.Registry).parent;
    expect(style(card)).toMatchObject({
      borderRadius: 20,
      paddingHorizontal: 20,
      paddingVertical: 16,
      gap: 12,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: StyleSheet.hairlineWidth,
    });
  },
);

it('styles share failures and disabled forgetting without changing their actions', async () => {
  jest.spyOn(Share, 'share').mockRejectedValue(new Error('share unavailable'));
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  let finish;
  cancel.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  act(() => {
    view = renderer.create(<ConnectionSummary onManualConnection={manual} />);
  });
  act(() => press('Connection details'));
  await act(async () => {
    await press(Strings.Connection.Summary.Share);
  });
  const failure = view.root
    .findAllByType('Text')
    .find(
      node => node.props.children === Strings.Connection.Summary.ShareFailed,
    );
  expect(StyleSheet.flatten(failure.props.style)).toMatchObject({
    color: palette(false).danger,
    fontSize: 13,
    lineHeight: 18,
  });
  expect(failure.props.accessibilityLiveRegion).toBe('polite');
  act(() => press(Strings.Connection.Summary.Forget));
  let pending;
  act(() => {
    pending = alert.mock.calls[0][2]
      .find(button => button.style === 'destructive')
      .onPress();
  });
  const forget = view.root.findAllByProps({testID: 'connection-forget'})[0];
  expect(forget.props.disabled).toBe(true);
  expect(forget.props.accessibilityState.disabled).toBe(true);
  expect(StyleSheet.flatten(forget.props.style).opacity).toBe(0.5);
  await act(async () => {
    finish();
    await pending;
  });
  expect(cancel).toHaveBeenCalledWith({clear: true});
});

it.each([false, true])(
  'groups the diagnostics and credential utilities as accented and destructive rows (dark %s)',
  dark => {
    hooks.useTheme.mockReturnValue({dark, colors: {card: '#fff'}});
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
      width: 390,
      height: 844,
      fontScale: 1,
      scale: 3,
    });
    act(() => {
      view = renderer.create(<ConnectionSummary onManualConnection={manual} />);
    });
    act(() => press('Connection details'));
    const colors = palette(dark);
    const summary = Strings.Connection.Summary;
    const control = id => view.root.findAllByProps({testID: id})[0];
    const style = node =>
      StyleSheet.flatten(
        typeof node.props.style === 'function'
          ? node.props.style({pressed: false})
          : node.props.style,
      );
    const textNode = content =>
      view.root
        .findAllByType('Text')
        .find(node => node.props.children === content);
    const group = textNode(summary.Utilities).parent;
    expect(textNode(summary.Utilities).props.accessibilityRole).toBe('header');
    expect(style(group)).toMatchObject({
      borderRadius: 20,
      paddingHorizontal: 20,
      paddingVertical: 16,
      gap: 12,
      backgroundColor: colors.surface,
      borderColor: colors.border,
    });
    for (const id of ['connection-share', 'connection-forget']) {
      expect(group.findAllByProps({testID: id})).not.toHaveLength(0);
      expect(style(control(id))).toMatchObject({
        minHeight: 48,
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
      });
      expect(control(id).props.accessibilityRole).toBe('button');
    }
    expect(style(control('connection-share'))).toMatchObject({
      backgroundColor: colors.tints[0],
      borderColor: colors.border,
    });
    expect(style(control('connection-forget'))).toMatchObject({
      backgroundColor: colors.dangerSurface,
      borderColor: colors.danger,
    });
    expect(control('connection-share').props.accessibilityLabel).toBe(
      summary.Share,
    );
    expect(control('connection-share').props.accessibilityHint).toBe(
      summary.ShareDetail,
    );
    expect(control('connection-forget').props.accessibilityLabel).toBe(
      summary.Forget,
    );
    expect(control('connection-forget').props.accessibilityHint).toBe(
      summary.ForgetDetail,
    );
    expect(summary.ShareDetail).toContain('redacted');
    expect(summary.ForgetDetail).toContain('this phone only');
    expect(summary.ForgetDetail).toContain('No Azure device');
    expect(style(textNode(summary.Share)).color).toBe(colors.text);
    expect(style(textNode(summary.Forget)).color).toBe(colors.danger);
    for (const detail of [summary.ShareDetail, summary.ForgetDetail]) {
      expect(style(textNode(detail))).toMatchObject({
        fontSize: 13,
        lineHeight: 19,
        color: colors.muted,
      });
    }
  },
);

it.each([
  [false, 1],
  [true, 1],
  [false, 2.5],
])(
  'groups connection actions under one heading with the shared row treatment (dark %s, font scale %s)',
  (dark, fontScale) => {
    hooks.useTheme.mockReturnValue({dark, colors: {card: '#fff'}});
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
      width: 320,
      height: 800,
      fontScale,
      scale: 2,
    });
    connected = false;
    act(() => {
      view = renderer.create(<ConnectionSummary onManualConnection={manual} />);
    });
    act(() => press('Connection details'));
    const colors = palette(dark);
    const summary = Strings.Connection.Summary;
    const control = id => view.root.findAllByProps({testID: id})[0];
    const style = node =>
      StyleSheet.flatten(
        typeof node.props.style === 'function'
          ? node.props.style({pressed: false})
          : node.props.style,
      );
    const textNode = content =>
      view.root
        .findAllByType('Text')
        .find(node => node.props.children === content);
    const heading = textNode(summary.Manage);
    expect(heading.props.accessibilityRole).toBe('header');
    expect(style(heading)).toMatchObject({
      fontSize: 17,
      lineHeight: 24,
      fontWeight: '600',
      color: colors.text,
    });
    const card = heading.parent;
    expect(style(card)).toMatchObject({
      borderRadius: 20,
      paddingHorizontal: 20,
      paddingVertical: 16,
      gap: 12,
      backgroundColor: colors.surface,
      borderColor: colors.border,
    });
    // Recovery first, destructive last: the same order as the accepted footer.
    expect(
      card
        .findAll(
          node =>
            typeof node.type === 'string' &&
            node.props.accessibilityRole === 'button',
        )
        .map(node => node.props.testID),
    ).toEqual([
      'connection-reconnect',
      'connection-manual',
      'connection-disconnect',
    ]);
    for (const [id, label, hint] of [
      ['connection-reconnect', summary.Reconnect, summary.ReconnectDetail],
      ['connection-manual', summary.Manual, summary.ManualDetail],
      ['connection-disconnect', summary.Disconnect, summary.DisconnectDetail],
    ]) {
      const row = control(id);
      expect(row.props.accessibilityRole).toBe('button');
      expect(row.props.accessibilityLabel).toBe(label);
      expect(row.props.accessibilityHint).toBe(hint);
      expect(row.props.accessibilityState).toMatchObject({disabled: false});
      const rowStyle = style(row);
      expect(rowStyle.minHeight).toBeGreaterThanOrEqual(48);
      expect(rowStyle.height).toBeUndefined();
      expect(rowStyle).toMatchObject({
        alignSelf: 'stretch',
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        alignItems: fontScale > 1.45 ? 'flex-start' : 'center',
      });
      expect(textNode(hint).props.numberOfLines).toBeUndefined();
      expect(style(textNode(hint)).color).toBe(colors.muted);
    }
    expect(style(control('connection-disconnect'))).toMatchObject({
      backgroundColor: colors.dangerSurface,
      borderColor: colors.danger,
    });
    expect(style(textNode(summary.Disconnect)).color).toBe(colors.danger);
    expect(style(textNode(summary.Manual)).color).toBe(colors.text);
    for (const [id, icon] of [
      ['connection-reconnect', 'refresh'],
      ['connection-manual', 'lan-connect'],
      ['connection-disconnect', 'link-variant-off'],
    ]) {
      expect(control(id).findByType('Icon').props).toMatchObject({
        name: icon,
        color: id === 'connection-disconnect' ? colors.danger : colors.primary,
      });
    }
    // Disconnecting stops the session only; credentials stay for a reconnect.
    act(() => control('connection-disconnect').props.onPress());
    expect(clear).toHaveBeenCalledTimes(1);
    expect(cancel).not.toHaveBeenCalled();
    expect(summary.DisconnectDetail).toContain('saved credentials are kept');
  },
);
