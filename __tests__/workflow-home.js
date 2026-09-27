import React from 'react';
import renderer, {act} from 'react-test-renderer';
import * as Keychain from 'react-native-keychain';
import WorkflowHome from '../src/experience/WorkflowHome';
import {projectSetup} from '../src/experience/setupProjection';
import {ExperienceStrings} from '../src/experience/strings';
import {IoTCContext} from '../src/contexts/iotc';
import {StorageContext} from '../src/contexts/storage';
import {ConnectionError} from '../src/connection/errors';
import {PHONE_MODEL_ID} from '../src/connection/types';
import {parseAzureContext} from '../src/onboarding/azureContext';
import {useTheme} from '../src/hooks';
import {palette} from '../src/theme/palette';
import {detailStyles} from '../src/theme/detailStyles';
import {useDecorativeLoop, useGentleTransition} from '../src/hooks/motion';
import ChannelFlow, {
  FEATHER,
  INTERRUPTED_DASH,
  LANE_HEIGHT,
  STRIP_HEIGHT,
  caretPath,
  channelPath,
  laneCaretPath,
  lanePath,
} from '../src/experience/ChannelFlow';
import {surfaceColor} from '../src/components/surface';
import Svg from 'react-native-svg';

const Native = require('react-native');

jest.mock('../src/hooks', () => ({
  useTheme: jest.fn(() => ({dark: false})),
  useSensors: jest.fn(() => {
    throw new Error('Home must not own sensors');
  }),
  useProperties: jest.fn(() => {
    throw new Error('Home must not own properties');
  }),
  useConnectIoTCentralClient: jest.fn(() => {
    throw new Error('Home must not own the connection');
  }),
}));
jest.mock('../src/components/typography', () => ({Text: 'Text'}));
jest.mock('@rneui/themed', () => ({Icon: 'Icon'}));
jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Path: 'Path',
  Defs: 'Defs',
  LinearGradient: 'LinearGradient',
  Stop: 'Stop',
  Rect: 'Rect',
  G: 'G',
  Circle: 'Circle',
  Polygon: 'Polygon',
}));
jest.mock('@react-native-masked-view/masked-view', () => {
  const ReactModule = require('react');
  return {
    __esModule: true,
    // Drop the mask element: a React element prop is not serializable here.
    default: ({maskElement, ...props}) =>
      ReactModule.createElement('MaskedView', props),
  };
});
jest.mock('../src/hooks/motion', () => {
  const {Animated} = require('react-native');
  return {
    useMotionAllowed: jest.fn(() => true),
    useGentleTransition: jest.fn(() => new Animated.Value(1)),
    useDecorativeLoop: jest.fn(() => new Animated.Value(0)),
  };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 24, bottom: 16, left: 0, right: 0}),
}));

jest.mock('@react-navigation/native', () => ({useIsFocused: () => true}));

const text = ExperienceStrings.Home;
const key = Buffer.alloc(32, 7).toString('base64');
const groupKey = Buffer.alloc(32, 9).toString('base64');
const identity = {
  deviceId: 'Assigned-Phone-42',
  registrationId: 'registration-phone',
  assignedHub: 'assigned-hub.device.azure-devices.net',
  modelId: PHONE_MODEL_ID,
};
const credentials = {
  registrationId: identity.registrationId,
  scopeId: '0ne12345678',
  deviceKey: key,
  provisioningHost: 'global-canary.azure-devices-provisioning.net',
  keyType: 'device',
};
const snapshot = () => {
  const subscription = '11111111-2222-4333-8444-555555555555';
  const scope = `/subscriptions/${subscription}/resourceGroups/home-rg`;
  const namespace = `${scope}/providers/Microsoft.DeviceRegistry/namespaces/home-namespace`;
  return parseAzureContext(
    JSON.stringify({
      schema: 'paad.azure-context',
      version: 1,
      capturedAt: '2026-09-17T19:00:00.000Z',
      binding: {
        assignedHub: identity.assignedHub,
        deviceId: identity.deviceId,
        registrationId: identity.registrationId,
      },
      subscription: {id: subscription, name: 'Home fixture'},
      resourceGroup: {name: 'home-rg'},
      namespace: {
        name: 'home-namespace',
        resourceId: namespace,
        location: 'testregion',
      },
      hub: {
        name: 'assigned-hub',
        resourceId: `${scope}/providers/Microsoft.Devices/IotHubs/assigned-hub`,
      },
      registryDevice: {
        name: 'historical-phone',
        resourceId: `${namespace}/registryDevices/historical-phone`,
        externalDeviceId: identity.deviceId,
      },
      activities: [],
    }),
  );
};
const sensor = overrides => ({
  id: 'accelerometer',
  name: 'Accelerometer',
  enabled: true,
  simulated: false,
  availability: 'available',
  enable: jest.fn(),
  sendInterval: jest.fn(),
  ...overrides,
});
let tree;
let storage;
let connection;
let props;
let dimensions;
let focusSpy;
const originalOS = Native.Platform.OS;
const content = () => JSON.stringify(tree.toJSON());
const control = id => tree.root.findAllByProps({testID: id})[0];
const press = id => act(() => control(id).props.onPress());
const render = () => {
  const element = (
    <StorageContext.Provider value={storage}>
      <IoTCContext.Provider value={connection}>
        <WorkflowHome {...props} />
      </IoTCContext.Provider>
    </StorageContext.Provider>
  );
  act(() => {
    if (tree) tree.update(element);
    else
      tree = renderer.create(element, {
        createNodeMock: elementNode => ({
          nativeID: elementNode.props.testID,
        }),
      });
  });
};
const dismiss = () => {
  press('home-panel-close');
  act(() => {
    tree.root.findByType(Native.Modal).props.onDismiss();
    jest.runOnlyPendingTimers();
  });
};

test.each([1, 1.8])(
  'fits icon-and-label nodes without truncating at font scale %s',
  fontScale => {
    dimensions = {...dimensions, fontScale};
    render();
    for (const name of ['adr', 'dps', 'hub', 'phone']) {
      const horizontal = fontScale > 1.2 || name === 'adr' || name === 'phone';
      const button = control(`home-node-${name}`);
      expect(
        Native.StyleSheet.flatten(button.props.style({pressed: false})),
      ).toMatchObject({
        minHeight: 80,
        alignItems: 'center',
        justifyContent: 'center',
        gap: horizontal ? 8 : 4,
      });
      for (const label of button.findAllByType('Text')) {
        expect(
          Native.StyleSheet.flatten(label.props.style).textAlign ?? 'left',
        ).toBe(horizontal ? 'left' : 'center');
        expect(label.props.numberOfLines).toBeUndefined();
        expect(label.props.allowFontScaling).not.toBe(false);
      }
    }
    expect(content()).toContain('Latest observations');
  },
);

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  Native.Platform.OS = 'ios';
  dimensions = {width: 390, height: 844, scale: 1, fontScale: 1};
  jest
    .spyOn(Native, 'useWindowDimensions')
    .mockImplementation(() => dimensions);
  jest.spyOn(Native, 'findNodeHandle').mockImplementation(target => {
    const id = target.nativeID ?? target.props?.testID;
    if (id === 'home-panel-close') return 101;
    if (id?.startsWith('home-node-')) return 102;
    throw new Error('Unexpected native focus target');
  });
  focusSpy = jest
    .spyOn(Native.AccessibilityInfo, 'setAccessibilityFocus')
    .mockImplementation(() => {});
  useTheme.mockReturnValue({dark: false});
  storage = {
    credentials,
    simulated: false,
    azureContext: null,
    azureContextError: false,
    initialized: true,
    save: jest.fn(),
    read: jest.fn(),
    clear: jest.fn(),
  };
  connection = {
    client: {
      identity,
      isConnected: jest.fn(() => true),
      connect: jest.fn(),
      disconnect: jest.fn(),
      on: jest.fn(),
      fetchTwin: jest.fn(),
    },
    error: null,
    connecting: false,
    stage: 'connected',
  };
  props = {
    sensors: [],
    onDetails: jest.fn(),
    onTelemetry: jest.fn(),
    onActivity: jest.fn(),
  };
});
afterEach(() => {
  if (tree) act(() => tree.unmount());
  tree = undefined;
  expect(storage.save).not.toHaveBeenCalled();
  expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
  expect(global.fetch).not.toHaveBeenCalled();
  expect(global.XMLHttpRequest).not.toHaveBeenCalled();
  expect(global.WebSocket).not.toHaveBeenCalled();
  jest.restoreAllMocks();
  Native.Platform.OS = originalOS;
  jest.useRealTimers();
});

test('renders the approved native topology and opens each of the four scrollable panels', () => {
  render();
  expect(tree.root.findByType(Native.Modal).props.allowSwipeDismissal).toBe(
    true,
  );
  expect(control('home-map')).toBeDefined();
  expect(control('home-map-compact')).toBeDefined();
  expect(control('home-map-phone-dps-path')).toBeDefined();
  expect(control('home-map-phone-hub-path')).toBeDefined();
  const paths = tree.root.findAllByType('Path');
  expect(paths.some(path => path.props.strokeDasharray)).toBe(true);
  for (const node of ['adr', 'dps', 'hub', 'phone']) {
    press(`home-node-${node}`);
    expect(control(`home-panel-${node}`).props.accessibilityViewIsModal).toBe(
      true,
    );
    expect(control('home-panel-close').props.accessibilityRole).toBe('button');
    expect(
      control('workflow-home-content').props.importantForAccessibility,
    ).toBe('no-hide-descendants');
    expect(
      control('workflow-home-content').props.accessibilityElementsHidden,
    ).toBe(true);
    expect(
      tree.root.findAllByType(Native.ScrollView).length,
    ).toBeGreaterThanOrEqual(2);
    dismiss();
  }
  expect(control('workflow-home-content').props.importantForAccessibility).toBe(
    'auto',
  );
  expect(connection.client.connect).not.toHaveBeenCalled();
  expect(connection.client.on).not.toHaveBeenCalled();
  expect(connection.client.fetchTwin).not.toHaveBeenCalled();
});

test('labels a DPS assignment from the actual setup mode even when optional registration metadata is absent', () => {
  const assigned = {...identity, registrationId: undefined};
  expect(projectSetup(credentials, assigned, false).assignment.source).toBe(
    'dps',
  );
});

test.each([320, 360, 440])(
  'aligns namespace and phone paths with native service centers at map width %i',
  measuredWidth => {
    dimensions.width = measuredWidth + 62;
    render();
    act(() => {
      control('home-map-compact').props.onLayout({
        nativeEvent: {layout: {width: measuredWidth}},
      });
    });
    const azure = Native.StyleSheet.flatten(
      control('home-map-azure').props.style,
    );
    const services = Native.StyleSheet.flatten(
      control('home-map-services').props.style,
    );
    const phone = Native.StyleSheet.flatten(
      control('home-map-phone').props.style,
    );
    const inset = azure.padding + azure.borderWidth;
    const serviceWidth = measuredWidth - 2 * inset;
    const serviceNodeWidth = (serviceWidth - services.gap) / 2;
    const phoneWidth = (measuredWidth * parseFloat(phone.width)) / 100;
    const coordinates = id =>
      control(id)
        .props.d.match(/-?\d+(?:\.\d+)?/g)
        .map(Number);
    const namespace = coordinates('home-map-namespace-path');
    const dps = coordinates('home-map-phone-dps-path');
    const hub = coordinates('home-map-phone-hub-path');
    expect(control('home-map-namespace-lines').props.viewBox).toBe(
      `0 0 ${serviceWidth} 24`,
    );
    expect(control('home-map-phone-lines').props.viewBox).toBe(
      `0 0 ${measuredWidth} ${STRIP_HEIGHT}`,
    );
    expect(namespace[0]).toBeCloseTo(serviceWidth / 2);
    expect(namespace[3]).toBeCloseTo(serviceNodeWidth / 2);
    expect(namespace[6]).toBeCloseTo(serviceWidth - serviceNodeWidth / 2);
    // Each route starts on its service center and ends on its phone quarter.
    const dpsPhoneX = namespace[3] + inset;
    const hubPhoneX = namespace[6] + inset;
    const phoneLeftX = measuredWidth / 2 - phoneWidth / 4;
    const phoneRightX = measuredWidth / 2 + phoneWidth / 4;
    expect(dps[0]).toBeCloseTo(dpsPhoneX);
    expect(hub[0]).toBeCloseTo(hubPhoneX);
    expect(dps[dps.length - 2]).toBeCloseTo(phoneLeftX);
    expect(hub[hub.length - 2]).toBeCloseTo(phoneRightX);
    expect(dps[0]).toBeLessThan(dps[dps.length - 2]);
    expect(hub[0]).toBeGreaterThan(hub[hub.length - 2]);
    // The two routes are exact mirrors of each other about the map center.
    expect(control('home-map-phone-dps-path').props.d).toBe(
      channelPath(dpsPhoneX, phoneLeftX),
    );
    expect(control('home-map-phone-hub-path').props.d).toBe(
      channelPath(hubPhoneX, phoneRightX),
    );
    expect(dpsPhoneX + hubPhoneX).toBeCloseTo(measuredWidth);
    expect(phoneLeftX + phoneRightX).toBeCloseTo(measuredWidth);
    // Neither route bends into a smile: it stays vertical, runs, then lands.
    expect(dps[1]).toBe(1);
    expect(dps[dps.length - 1]).toBe(STRIP_HEIGHT - 1);
    for (const path of [dps, hub]) {
      for (let index = 1; index < path.length; index += 2)
        expect(path[index]).toBeLessThanOrEqual(path[path.length - 1]);
    }
    // A caret on each end of each route marks the two-way connector.
    for (const [id, from, to] of [
      ['dps', dpsPhoneX, phoneLeftX],
      ['hub', hubPhoneX, phoneRightX],
    ]) {
      const arrows = control(`home-map-phone-${id}-arrows`);
      expect(arrows.props.d).toBe(caretPath(from, to));
      expect(arrows.props.fill).toBe('none');
      expect(arrows.props.strokeDasharray).toBeUndefined();
    }
  },
);

test('gives the group plate real air and drops the namespace caption from the map face', () => {
  render();
  const azure = Native.StyleSheet.flatten(
    control('home-map-azure').props.style,
  );
  const services = Native.StyleSheet.flatten(
    control('home-map-services').props.style,
  );
  // A calm plate: one solid edge with room inside it, not a dashed box drawn
  // tight around the nodes.
  expect(azure.borderStyle).toBeUndefined();
  expect(azure.padding).toBeGreaterThanOrEqual(18);
  expect(services.gap).toBeGreaterThanOrEqual(16);
  const captions = () =>
    tree.root
      .findAllByType('Text')
      .filter(node => node.props.children === text.NamespaceLinks);
  expect(captions()).toHaveLength(0);
  // The only dashed stroke left on the map is the namespace coordination line.
  expect(control('home-map-namespace-path').props.strokeDasharray).toBe('4 3');
  // The relationship itself is still stated, in the legend's assistive output.
  expect(
    tree.root
      .findAllByType('Text')
      .find(node =>
        node.props.accessibilityLabel?.includes(text.NamespaceLinks),
      ),
  ).toBeDefined();
  // Stacked layouts lose the caption too, and keep their own lane captions.
  dimensions = {width: 320, height: 640, scale: 1, fontScale: 1};
  render();
  expect(control('home-map-stacked')).toBeDefined();
  expect(captions()).toHaveLength(0);
  expect(content()).toContain(text.PhoneDpsPath);
  expect(
    Native.StyleSheet.flatten(control('home-map-services').props.style)
      .marginTop,
  ).toBeGreaterThanOrEqual(16);
});

test('draws only one solid two-way connector per service and keeps ADR dashed', () => {
  render();
  const colors = palette(false);
  const route = id => control(`home-map-phone-${id}-path`);
  expect(control('home-map-namespace-path').props.strokeDasharray).toBe('4 3');
  // Exactly one route and one caret pair per service, and nothing else solid.
  const solid = control('home-map-phone-lines')
    .findAllByType('Path')
    .filter(path => !path.props.strokeDasharray);
  const ids = solid.map(path => path.props.testID).sort();
  expect(ids).toEqual([
    'home-map-phone-dps-arrows',
    'home-map-phone-dps-path',
    'home-map-phone-dps-tint',
    'home-map-phone-hub-arrows',
    'home-map-phone-hub-path',
    'home-map-phone-hub-tint',
  ]);
  for (const path of solid) {
    expect(path.props.strokeLinecap).toBe('round');
    expect(path.props.strokeLinejoin).toBe('round');
    expect(path.props.fill).toBe('none');
  }
  for (const id of ['dps', 'hub']) {
    expect(route(id).props.stroke).toBe(colors.channel);
    expect(control(`home-map-phone-${id}-arrows`).props.stroke).toBe(
      colors.channel,
    );
    // The connected tint rides the identical route, never a second shape.
    const tint = control(`home-map-phone-${id}-tint`);
    expect(tint.props.d).toBe(route(id).props.d);
    expect(tint.props.stroke).toBe(colors.channelGlow);
    expect(tint.props.strokeOpacity).toBe(0.14);
    expect(tint.props.strokeWidth).toBeGreaterThan(route(id).props.strokeWidth);
  }
  // No route ever joins the phone to ADR.
  expect(
    tree.root.findAllByProps({testID: 'home-map-phone-adr-path'}),
  ).toHaveLength(0);
});

test('drops the connected tint and the light when the phone is not connected', () => {
  connection.client.isConnected.mockReturnValue(false);
  render();
  for (const id of ['dps', 'hub']) {
    // The route itself never disappears or changes shape: it only goes grey.
    expect(control(`home-map-phone-${id}-path`).props.stroke).toBe(
      palette(false).controlBorder,
    );
    expect(control(`home-map-phone-${id}-path`).props.strokeDasharray).toBe(
      undefined,
    );
    expect(control(`home-map-phone-${id}-arrows`).props.stroke).toBe(
      palette(false).controlBorder,
    );
    expect(
      tree.root.findAllByProps({testID: `home-map-phone-${id}-tint`}),
    ).toHaveLength(0);
    expect(
      tree.root.findAllByProps({testID: `home-map-flow-${id}`}),
    ).toHaveLength(0);
  }
  expect(useDecorativeLoop).toHaveBeenLastCalledWith(false);
  // Finite motion stays legible when the map light is correctly dark.
  expect(useGentleTransition).toHaveBeenCalled();
  const footer = control('home-activity');
  act(() => footer.props.onPressIn());
  expect(control('home-activity').props.accessibilityRole).toBe('button');
  expect(
    Native.StyleSheet.flatten(control('home-activity').props.style).opacity,
  ).toBeUndefined();
  act(() => footer.props.onPressOut());
  press('home-activity');
  expect(props.onActivity).toHaveBeenCalledTimes(1);
});

test.each([false, true])(
  'uses quiet solid Sage surfaces behind every 3D icon in dark mode %s',
  dark => {
    useTheme.mockReturnValue({dark});
    render();
    const colors = palette(dark);
    const background = id =>
      Native.StyleSheet.flatten(control(id).props.style({pressed: false}))
        .backgroundColor;
    for (const node of ['phone', 'adr', 'dps', 'hub']) {
      expect(background(`home-node-${node}`)).toBe(surfaceColor(dark));
      const style = Native.StyleSheet.flatten(
        control(`home-node-${node}`).props.style({pressed: true}),
      );
      expect(style.backgroundColor).toBe(surfaceColor(dark, {pressed: true}));
      expect(style.borderColor).toBe(colors.border);
    }
    expect(control('home-icon-iphone')).toBeDefined();
    expect(content()).toContain(text.PhonePlatforms.ios);
  },
);

test('names the capability and the connection heading without a second product title', () => {
  render();
  expect(content()).toContain('IoT Plug and Play');
  expect(content()).not.toContain('IOT PLUG AND PLAY');
  expect(content()).not.toContain('Phone as a Device');
  const heading = tree.root
    .findAllByType('Text')
    .find(node => node.props.accessibilityRole === 'header');
  const style = Native.StyleSheet.flatten(heading.props.style);
  expect(heading.props.children).toBe(text.Map);
  expect(style.fontFamily).toBe(detailStyles.displayTitle.fontFamily);
  // Android falls back to sans-serif when a weight is paired with the family.
  expect(style.fontWeight).toBeUndefined();
  expect(style.fontSize).toBe(detailStyles.displayTitle.fontSize);
  expect(style.lineHeight).toBe(detailStyles.displayTitle.lineHeight);
  dimensions = {...dimensions, width: 320, fontScale: 1.8};
  render();
  expect(
    Native.StyleSheet.flatten(
      tree.root
        .findAllByType('Text')
        .find(node => node.props.accessibilityRole === 'header').props.style,
    ).fontSize,
  ).toBe(detailStyles.displayTitle.fontSize);
});

test('explains the decorative light instead of claiming traffic', () => {
  render();
  expect(content()).toContain(text.FlowNote);
  const legend = tree.root
    .findAllByType('Text')
    .find(node => node.props.accessibilityLabel?.includes(text.FlowNote));
  expect(legend.props.children).toBe(`${text.MapLegend} ${text.FlowHint}`);
  expect(legend.props.accessibilityLabel).not.toContain(text.FlowHint);
  for (const claim of ['packets', 'throughput', 'delivery confirmation'])
    expect(text.FlowNote).toContain(claim);
  expect(text.FlowNote).toContain('not a persistent message path');
  // Two dashed meanings, told apart by tone in the same legend voice.
  expect(text.MapLegend).toContain('Grey dashed: cloud coordination');
  expect(text.Interrupted).toContain('Red, broken');
  expect(text.Interrupted.split(' ').length).toBeLessThanOrEqual(12);
});

test.each([
  ['a real connection', {}, true],
  ['simulation', {simulated: true}, false],
  ['a reconnect in progress', {connecting: true}, false],
  ['a reported error', {error: new ConnectionError('CONNECTION_LOST')}, false],
  ['a client that reports no connection', {offline: true}, false],
])('runs the decorative light only for %s', (_label, overrides, expected) => {
  if (overrides.simulated) storage.simulated = true;
  if (overrides.connecting) connection.connecting = true;
  if (overrides.error) connection.error = overrides.error;
  if (overrides.offline) connection.client.isConnected = jest.fn(() => false);
  render();
  expect(useDecorativeLoop).toHaveBeenLastCalledWith(expected);
  expect(
    tree.root.findAllByProps({testID: 'home-map-flow-hub'}).length > 0,
  ).toBe(expected);
  expect(connection.client.connect).not.toHaveBeenCalled();
});

test('suppresses the decorative light for a covering modal and an open panel', () => {
  props.motionVisible = false;
  render();
  expect(useDecorativeLoop).toHaveBeenLastCalledWith(false);
  props.motionVisible = true;
  render();
  expect(useDecorativeLoop).toHaveBeenLastCalledWith(true);
  press('home-node-hub');
  expect(useDecorativeLoop).toHaveBeenLastCalledWith(false);
  expect(tree.root.findAllByProps({testID: 'home-map-flow-hub'})).toHaveLength(
    0,
  );
  dismiss();
  expect(useDecorativeLoop).toHaveBeenLastCalledWith(true);
});

test('animates only the Hub route and never DPS when the setup bypasses provisioning', () => {
  storage.credentials = {
    connectionString: `HostName=direct.azure-devices.net;DeviceId=phone;SharedAccessKey=${key}`,
  };
  render();
  expect(control('home-map-flow-hub')).toBeDefined();
  expect(tree.root.findAllByProps({testID: 'home-map-flow-dps'})).toHaveLength(
    0,
  );
  expect(
    tree.root.findAllByProps({testID: 'home-map-phone-dps-arrows'}),
  ).toHaveLength(0);
  expect(content()).toContain(text.DpsNotUsed);
});

test('uses actual map width for the direct-Hub compact threshold and rotation', () => {
  storage.credentials = {
    connectionString: `HostName=direct.azure-devices.net;DeviceId=phone;SharedAccessKey=${key}`,
  };
  dimensions.width = 768;
  render();
  act(() => {
    control('home-map-compact').props.onLayout({
      nativeEvent: {layout: {width: 319}},
    });
  });
  expect(control('home-map-stacked')).toBeDefined();
  act(() => {
    control('home-map-stacked').props.onLayout({
      nativeEvent: {layout: {width: 320}},
    });
  });
  expect(control('home-map-compact')).toBeDefined();
  expect(
    tree.root.findAllByProps({testID: 'home-map-phone-dps-path'}),
  ).toHaveLength(0);
  expect(content()).toContain(text.DpsNotUsed);
  dimensions.width = 360;
  render();
  act(() => {
    control('home-map-compact').props.onLayout({
      nativeEvent: {layout: {width: 298}},
    });
  });
  expect(control('home-map-stacked')).toBeDefined();
});

test.each([false, true])(
  'uses a non-destructive warm attention treatment in dark mode %s',
  dark => {
    useTheme.mockReturnValue({dark});
    props.sensors = [sensor({availability: 'unavailable'})];
    connection.error = new ConnectionError('CONNECTION_LOST');
    render();
    for (const id of ['home-attention-connection', 'home-attention-sensors']) {
      const row = control(id);
      const style = Native.StyleSheet.flatten(
        typeof row.props.style === 'function'
          ? row.props.style({pressed: false})
          : row.props.style,
      );
      expect(style.backgroundColor).toBe(palette(dark).tints[2]);
      expect(style.backgroundColor).not.toBe(palette(dark).dangerSurface);
      // One material: the press deepens the same warm tone in both themes.
      expect(
        Native.StyleSheet.flatten(row.props.style({pressed: true}))
          .backgroundColor,
      ).toBe(surfaceColor(dark, {from: palette(dark).tints[2], pressed: true}));
      expect(style.minHeight).toBeGreaterThanOrEqual(48);
      expect(row.props.accessibilityRole).toBe('button');
      expect(
        row
          .findAllByType('Icon')
          .some(icon => icon.props.name === 'alert-outline'),
      ).toBe(true);
      press(id);
    }
    expect(props.onDetails).toHaveBeenCalledTimes(1);
    expect(props.onTelemetry).toHaveBeenCalledTimes(1);
  },
);

test.each([
  {width: 390, fontScale: 1, direction: 'row'},
  {width: 390, fontScale: 2, direction: 'column'},
  {width: 320, fontScale: 1, direction: 'column'},
])(
  'pins the panel heading, simulation and Close outside its scroll body (%#)',
  layout => {
    dimensions = {
      ...dimensions,
      width: layout.width,
      fontScale: layout.fontScale,
    };
    storage.simulated = true;
    render();
    for (const node of ['phone', 'dps', 'hub', 'adr']) {
      press(`home-node-${node}`);
      const header = control('home-panel-header');
      const body = control('home-panel-body');
      expect(Native.StyleSheet.flatten(header.props.style).flexDirection).toBe(
        layout.direction,
      );
      expect(
        header.findAllByProps({testID: 'home-panel-title'}).length,
      ).toBeGreaterThan(0);
      expect(
        header.findAllByProps({testID: 'home-panel-close'}).length,
      ).toBeGreaterThan(0);
      expect(
        header.findAllByProps({testID: 'home-panel-simulation'}).length,
      ).toBeGreaterThan(0);
      expect(control('home-panel-title').props.children).toBe(
        text.Nodes[node].Panel,
      );
      expect(body.findAllByProps({testID: 'home-panel-title'})).toHaveLength(0);
      expect(body.findAllByProps({testID: 'home-panel-close'})).toHaveLength(0);
      expect(control('home-panel-title').props.numberOfLines).toBeUndefined();
      dismiss();
    }
  },
);

test('shows exact provisioning host, distinct registration and assignment, preview Hub and declared model', () => {
  render();
  press('home-node-dps');
  expect(content()).toContain(credentials.provisioningHost);
  expect(content()).toContain(identity.registrationId);
  expect(content()).toContain(identity.deviceId);
  expect(content()).toContain(identity.assignedHub);
  expect(content()).toContain(text.Sources.Dps);
  expect(content()).toContain(text.Fields.IndividualKey);
  expect(content()).not.toContain(key);
  expect(content()).not.toContain(text.Fields.GroupKey);
  dismiss();
  press('home-node-phone');
  expect(content()).toContain(PHONE_MODEL_ID);
  expect(content()).toContain(text.ModelNote);
  expect(content()).toContain(text.Hidden);
  const endpoint = tree.root
    .findAllByType('Text')
    .find(node => node.props.children === credentials.provisioningHost);
  expect(endpoint.props.selectable).toBe(true);
});

test('labels legacy group credentials explicitly without exposing key material', () => {
  storage.credentials = {...credentials, keyType: 'group', authKey: groupKey};
  render();
  for (const node of ['phone', 'dps']) {
    press(`home-node-${node}`);
    expect(content()).toContain(text.Fields.GroupKey);
    expect(content()).toContain(text.GroupNote);
    expect(content()).not.toContain(groupKey);
    expect(content()).not.toContain(key);
    if (node === 'dps') expect(content()).toContain(text.GroupAuthentication);
    dismiss();
  }
});

test('projects only allowlisted direct-Hub identifiers and bypasses the DPS path', () => {
  const connectionString = `HostName=direct-hub.device.azure-devices.cn;DeviceId=Direct-Phone;SharedAccessKey=${key}`;
  storage.credentials = {connectionString};
  connection.client.identity = null;
  const projected = projectSetup(storage.credentials, null, false);
  expect(projected).toMatchObject({
    mode: 'hub',
    configuredHub: 'direct-hub.device.azure-devices.cn',
    configuredDeviceId: 'Direct-Phone',
    credentialKind: 'connectionString',
    credentialPresent: true,
  });
  expect(JSON.stringify(projected)).not.toContain(key);
  expect(JSON.stringify(projected)).not.toContain(connectionString);
  render();
  expect(
    tree.root.findAllByProps({testID: 'home-map-phone-dps-path'}),
  ).toHaveLength(0);
  for (const node of ['phone', 'hub']) {
    press(`home-node-${node}`);
    expect(content()).toContain('direct-hub.device.azure-devices.cn');
    expect(content()).toContain('Direct-Phone');
    expect(content()).toContain(text.Sources.Setup);
    expect(content()).not.toContain(key);
    expect(content()).not.toContain(connectionString);
    dismiss();
  }
  press('home-node-dps');
  expect(content()).toContain(text.DirectRole);
  expect(content()).not.toContain(text.Fields.AssignedHub);
});

test.each([
  `HostName=direct.azure-devices.net;DeviceId=phone;SharedAccessKey=${key};SharedAccessKeyName=owner`,
  'HostName=direct.azure-devices.net;DeviceId=phone;SharedAccessSignature=SECRET_CANARY',
  `HostName=direct.azure-devices.net;DeviceId=SECRET_CANARY?sig=hidden;SharedAccessKey=${key}`,
  `HostName=https://SECRET_CANARY/?sig=hidden;DeviceId=phone;SharedAccessKey=${key}`,
])(
  'surfaces unsafe direct setup without leaking raw credentials (%#)',
  connectionString => {
    storage.credentials = {connectionString};
    connection.client.identity = null;
    const projection = projectSetup(storage.credentials, null, false);
    expect(projection.invalidSetup).toBe(true);
    expect(projection.configuredHub).toBeUndefined();
    expect(projection.configuredDeviceId).toBeUndefined();
    render();
    press('home-node-phone');
    expect(content()).toContain(text.InvalidSetup);
    expect(content()).not.toContain(key);
    expect(content()).not.toContain('SECRET_CANARY');
  },
);

test('shows matching snapshot only as historical context, never as current Azure health', () => {
  storage.azureContext = snapshot();
  render();
  press('home-node-adr');
  expect(content()).toContain('home-namespace');
  expect(content()).toContain('historical-phone');
  expect(content()).toContain('2026-09-17T19:00:00.000Z');
  expect(content()).toContain(text.Sources.Snapshot);
  expect(content()).toContain(text.SnapshotNote);
  expect(content()).toContain(text.NotChecked);
  expect(content()).toContain(text.RegistryNote);
  expect(tree.root.findAllByProps({testID: 'home-attention'})).toHaveLength(0);
  connection.client.identity = {...identity, deviceId: 'different-phone'};
  render();
  expect(content()).not.toContain('home-namespace');
  expect(content()).not.toContain('historical-phone');
  expect(content()).toContain(text.SnapshotOtherDevice);
});

test('absent or unreadable ADR context is neutral, with no attention or invented state', () => {
  render();
  press('home-node-adr');
  expect(content()).toContain(text.NoSnapshot);
  expect(content()).toContain(text.NotChecked);
  storage.azureContextError = true;
  render();
  expect(content()).toContain(text.SnapshotUnavailable);
  expect(tree.root.findAllByProps({testID: 'home-attention'})).toHaveLength(0);
});

test('uses only explicit connection errors and enabled-unavailable sensors for attention', () => {
  props.sensors = [
    sensor({availability: 'checking'}),
    sensor({enabled: false, availability: 'unavailable'}),
    sensor({availability: 'available', value: undefined}),
  ];
  connection.client.isConnected.mockReturnValue(false);
  connection.stage = 'error';
  render();
  expect(tree.root.findAllByProps({testID: 'home-attention'})).toHaveLength(0);
  connection.error = new ConnectionError('CONNECTION_LOST');
  props.sensors.push(sensor({availability: 'unavailable'}));
  render();
  const attention = control('home-attention');
  const actions = attention.findAll(
    node =>
      typeof node.type === 'string' &&
      node.props.accessibilityRole === 'button',
  );
  expect(actions[0].props.testID).toBe('home-attention-connection');
  press('home-attention-connection');
  press('home-attention-sensors');
  expect(props.onDetails).toHaveBeenCalledTimes(1);
  expect(props.onTelemetry).toHaveBeenCalledTimes(1);
  connection.connecting = true;
  render();
  expect(
    tree.root.findAllByProps({testID: 'home-attention-connection'}),
  ).toHaveLength(0);
  expect(control('home-attention-sensors')).toBeDefined();
});

test('labels simulation and suppresses live assignment, historical context and stale connection error', () => {
  storage.simulated = true;
  storage.azureContext = snapshot();
  connection.error = new ConnectionError('CONNECTION_LOST');
  render();
  expect(control('home-simulation').props.children).toBe(text.Simulation);
  expect(tree.root.findAllByProps({testID: 'home-attention'})).toHaveLength(0);
  press('home-node-dps');
  expect(content()).not.toContain(identity.assignedHub);
  expect(content()).not.toContain(identity.deviceId);
  expect(content()).toContain(text.SimulationIdentity);
  dismiss();
  press('home-node-adr');
  expect(content()).not.toContain('home-namespace');
});

test('does not invent missing setup, assignment or communication observations', () => {
  storage.credentials = null;
  connection.client = null;
  render();
  expect(content()).toContain(text.CommunicationEmpty);
  press('home-activity');
  expect(props.onActivity).toHaveBeenCalledTimes(1);
  press('home-node-phone');
  expect(content()).toContain(text.NoSetup);
  expect(content()).not.toContain('global.azure-devices-provisioning.net');
  dismiss();
  props.communication = (
    <Native.Text testID="actual-communication">
      A typed observation supplied by the runtime
    </Native.Text>
  );
  render();
  expect(control('actual-communication')).toBeDefined();
  expect(content()).not.toContain(text.CommunicationEmpty);
  expect(
    tree.root.findAll(
      node =>
        typeof node.type === 'string' &&
        node.props.testID === 'home-communication',
    ),
  ).toHaveLength(1);
  expect(
    tree.root
      .findAllByType('Text')
      .filter(node => node.props.children === text.Communication),
  ).toHaveLength(1);
  expect(
    tree.root.findAll(
      node =>
        typeof node.type === 'string' && node.props.testID === 'home-activity',
    ),
  ).toHaveLength(1);
});

test.each([false, true])(
  'grounds the activity route as a full-width footer with a settling caret (dark=%s)',
  dark => {
    useTheme.mockReturnValue({dark});
    render();
    const colors = palette(dark);
    const footer = control('home-activity');
    const style = Native.StyleSheet.flatten(footer.props.style);
    expect(footer.props.accessibilityRole).toBe('button');
    expect(footer.props.accessibilityLabel).toBe(text.Activity);
    expect(footer.props.accessibilityHint).toBe(text.ActivityHint);
    expect(style.minHeight).toBeGreaterThanOrEqual(56);
    expect(style.flexDirection).toBe('row');
    expect(style.alignItems).toBe('center');
    expect(style.borderColor).toBe(colors.surfaceBorder);
    // Seated on the card, not floating: a hairline lid, no shadow.
    expect(style.borderTopWidth).toBeGreaterThan(0);
    expect(style.borderBottomWidth ?? 0).toBe(0);
    expect(style.shadowOpacity).toBeUndefined();
    expect(style.elevation).toBeUndefined();
    const plate = Native.StyleSheet.flatten(
      control('home-activity-plate').props.style,
    );
    expect(plate).toMatchObject({width: 32, height: 32});
    const carets = footer.findAllByType('Icon');
    expect(carets.map(icon => icon.props.name)).toEqual([
      'pulse',
      'chevron-right',
    ]);
    // One solid fill, painted by the footer itself: no gradient competes with
    // the page behind the card, and nothing is layered over the hairline.
    expect(style.backgroundColor).toBe(surfaceColor(dark, {tone: 'footer'}));
    expect(footer.findAllByType(Svg)).toHaveLength(0);
    // Press feedback is the caret settling plus the surface, never a dim.
    act(() => footer.props.onPressIn());
    const held = Native.StyleSheet.flatten(
      control('home-activity').props.style,
    );
    expect(held.opacity).toBeUndefined();
    expect(held.backgroundColor).toBe(
      surfaceColor(dark, {tone: 'footer', pressed: true}),
    );
    act(() => footer.props.onPressOut());
    expect(footer.props.hitSlop).toBe(2);
  },
);

test.each([false, true])(
  'points the activity caret along the reading direction (rtl=%s)',
  rtl => {
    const original = Native.I18nManager.isRTL;
    Native.I18nManager.isRTL = rtl;
    try {
      render();
      const footer = control('home-activity');
      // Identity and contract are direction independent.
      expect(footer.props.testID).toBe('home-activity');
      expect(footer.props.accessibilityLabel).toBe(text.Activity);
      expect(footer.props.accessibilityHint).toBe(text.ActivityHint);
      const icons = footer.findAllByType('Icon');
      expect(icons.map(icon => icon.props.name)).toEqual([
        'pulse',
        rtl ? 'chevron-left' : 'chevron-right',
      ]);
      // Only the caret moves, and only along the writing axis.
      const animated = footer
        .findAllByType(Native.Animated.View)
        .filter(node => node.props.style?.transform !== undefined);
      expect(animated).toHaveLength(1);
      const [step] = animated[0].props.style.transform;
      expect(Object.keys(step)).toEqual(['translateX']);
      // A driven interpolation, seated at rest, settling by four toward
      // the trailing edge the caret above already points at.
      expect(typeof step.translateX).toBe('object');
      expect(step.translateX.__getValue()).toBe(0);
      const settled = Object.create(
        Object.getPrototypeOf(step.translateX),
        Object.getOwnPropertyDescriptors(step.translateX),
      );
      settled._parent = {__getValue: () => 1};
      expect(settled.__getValue()).toBe(rtl ? -4 : 4);
    } finally {
      Native.I18nManager.isRTL = original;
    }
  },
);

test.each([false, true])(
  'mirrors compact routes with their actual service columns (direct Hub=%s)',
  direct => {
    const original = Native.I18nManager.isRTL;
    try {
      Native.I18nManager.isRTL = false;
      if (direct) {
        storage.credentials = {
          connectionString: `HostName=direct.azure-devices.net;DeviceId=phone;SharedAccessKey=${key}`,
        };
      }
      render();
      act(() => {
        control('home-map-compact').props.onLayout({
          nativeEvent: {layout: {width: 360}},
        });
      });
      const ltr = tree.root.findByType(ChannelFlow).props.channels;
      expect(ltr.map(route => route.id)).toEqual(
        direct ? ['hub'] : ['dps', 'hub'],
      );
      Native.I18nManager.isRTL = true;
      render();
      const mirrored = ltr.map(route => ({
        ...route,
        from: 360 - route.from,
        to: 360 - route.to,
      }));
      expect(tree.root.findByType(ChannelFlow).props.channels).toEqual(
        mirrored,
      );
      for (const route of mirrored) {
        expect(control(`home-map-phone-${route.id}-path`).props.d).toBe(
          channelPath(route.from, route.to),
        );
      }
    } finally {
      Native.I18nManager.isRTL = original;
    }
  },
);

test('leads with the captions and draws no route until a width is measured', () => {
  dimensions = {width: 320, height: 640, scale: 1, fontScale: 1};
  render();
  const drawn = id => [
    ...tree.root.findAllByProps({testID: `home-map-lane-${id}-lines`}),
    ...tree.root.findAllByProps({testID: `home-map-phone-${id}-path`}),
    ...tree.root.findAllByProps({testID: `home-map-flow-${id}`}),
  ];
  // Text first: the relationship is readable while the measurement arrives.
  expect(content()).toContain(text.PhoneDpsPath);
  expect(content()).toContain(text.PhoneHubPath);
  expect(content()).toContain(text.NamespaceLinks);
  for (const id of ['dps', 'hub']) {
    expect(control(`home-map-lane-${id}`)).toBeDefined();
    expect(drawn(id)).toHaveLength(0);
  }
  // A zero measurement is not a coordinate space, so still nothing is drawn.
  const measure = width =>
    act(() => {
      for (const id of ['dps', 'hub'])
        control(`home-map-lane-${id}`).props.onLayout({
          nativeEvent: {layout: {width}},
        });
    });
  measure(0);
  expect(drawn('dps')).toHaveLength(0);
  measure(24);
  expect(drawn('dps')).toHaveLength(0);
  // Once it is real, every viewBox describes a positive area.
  measure(272);
  expect(drawn('dps').length).toBeGreaterThan(0);
  expect(drawn('hub').length).toBeGreaterThan(0);
  for (const svg of tree.root.findAllByType('Svg')) {
    if (svg.props.viewBox === undefined) continue;
    const [x, y, boxWidth, boxHeight] = svg.props.viewBox
      .split(' ')
      .map(Number);
    expect([x, y]).toEqual([0, 0]);
    expect(boxWidth).toBeGreaterThan(0);
    expect(boxHeight).toBeGreaterThan(0);
  }
});

test('never feathers the light wider than the static connected tint', () => {
  render();
  for (const id of ['dps', 'hub'])
    expect(control(`home-map-phone-${id}-tint`).props.strokeWidth).toBe(
      FEATHER,
    );
  expect(FEATHER).toBeGreaterThan(
    control('home-map-phone-hub-path').props.strokeWidth,
  );
});

test.each([
  {width: 320, height: 640, scale: 1, fontScale: 1},
  {width: 390, height: 844, scale: 1, fontScale: 2},
])(
  'stacks the same relationships for narrow width and large text (%#)',
  nextDimensions => {
    dimensions = nextDimensions;
    useTheme.mockReturnValue({dark: true});
    render();
    expect(control('home-map-stacked')).toBeDefined();
    expect(content()).toContain(text.NamespaceLinks);
    expect(content()).toContain(text.PhoneDpsPath);
    expect(content()).toContain(text.PhoneHubPath);
    act(() => {
      for (const id of ['dps', 'hub'])
        control(`home-map-lane-${id}`).props.onLayout({
          nativeEvent: {layout: {width: 272}},
        });
    });
    // No unlabelled fork: the stacked fallback is two self contained lanes.
    const notes = control('home-map-stacked-paths');
    expect(
      Native.StyleSheet.flatten(notes.props.style).paddingTop,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAllByProps({testID: 'home-map-phone-lines'}),
    ).toHaveLength(0);
    const lane = {from: 10, to: 272 - 10};
    for (const [id, caption, other] of [
      ['dps', text.PhoneDpsPath, text.PhoneHubPath],
      ['hub', text.PhoneHubPath, text.PhoneDpsPath],
    ]) {
      const group = control(`home-map-lane-${id}`);
      // The caption and the only line in the lane name the same one pair.
      const captions = group
        .findAllByType('Text')
        .map(label => label.props.children);
      expect(captions).toEqual([caption]);
      expect(captions).not.toContain(other);
      for (const label of group.findAllByType('Text'))
        expect(Native.StyleSheet.flatten(label.props.style).fontSize).toBe(
          Native.StyleSheet.flatten(detailStyles.supporting).fontSize,
        );
      expect(
        group.findAll(
          node =>
            typeof node.props.testID === 'string' &&
            /^home-map-phone-\w+-path$/.test(node.props.testID),
        ),
      ).toHaveLength(1);
      const route = group.findByProps({testID: `home-map-phone-${id}-path`});
      // A straight, two-way, horizontal connector spanning its own lane.
      expect(route.props.d).toBe(lanePath(lane.from, lane.to));
      expect(route.props.strokeDasharray).toBeUndefined();
      expect(
        group.findByProps({testID: `home-map-phone-${id}-arrows`}).props.d,
      ).toBe(laneCaretPath(lane.from, lane.to));
      expect(
        group.findByProps({testID: `home-map-lane-${id}-lines`}).props.viewBox,
      ).toBe(`0 0 272 ${LANE_HEIGHT}`);
      // Water runs in the lane it belongs to, off nothing else.
      expect(
        group.findAllByProps({testID: `home-map-flow-${id}`}).length,
      ).toBeGreaterThan(0);
    }
    // Both lanes share one loop: a single hook call per render, not one each.
    useDecorativeLoop.mockClear();
    render();
    expect(useDecorativeLoop).toHaveBeenCalledTimes(1);
    expect(useDecorativeLoop).toHaveBeenLastCalledWith(true);
    expect(
      tree.root.findAllByProps({testID: 'home-map-phone-adr-path'}),
    ).toHaveLength(0);
    for (const node of ['phone', 'dps', 'hub', 'adr']) {
      press(`home-node-${node}`);
      expect(control('home-panel-close')).toBeDefined();
      dismiss();
    }
    expect(
      tree.root.findAll(node => node.props.maxFontSizeMultiplier !== undefined),
    ).toHaveLength(0);
  },
);

test.each(['ios', 'android'])(
  'moves focus into the panel and returns it after dismissal on %s',
  platform => {
    Native.Platform.OS = platform;
    render();
    act(() => jest.runOnlyPendingTimers());
    press('home-node-hub');
    act(() => tree.root.findByType(Native.Modal).props.onShow());
    expect(focusSpy).toHaveBeenLastCalledWith(101);
    act(() => tree.root.findByType(Native.Modal).props.onRequestClose());
    act(() => {
      if (platform === 'ios')
        tree.root.findByType(Native.Modal).props.onDismiss();
      else jest.runOnlyPendingTimers();
    });
    expect(focusSpy).toHaveBeenLastCalledWith(102);
    expect(tree.root.findByType(Native.Modal).props.visible).toBe(false);
  },
);

test.each(['ios', 'android'])(
  'dismisses its panel before opening the sole authoritative Details on %s',
  platform => {
    Native.Platform.OS = platform;
    render();
    act(() => jest.runOnlyPendingTimers());
    press('home-node-hub');
    press('home-panel-details');
    expect(tree.root.findByType(Native.Modal).props.visible).toBe(false);
    if (platform === 'ios') expect(props.onDetails).not.toHaveBeenCalled();
    act(() => {
      if (platform === 'ios')
        tree.root.findByType(Native.Modal).props.onDismiss();
      else jest.runOnlyPendingTimers();
    });
    expect(props.onDetails).toHaveBeenCalledTimes(1);
    expect(connection.client.connect).not.toHaveBeenCalled();
  },
);

// The runtime's only explicit interruption: a transport that was established
// and then lost, reported as CONNECTION_LOST while the old identity is kept.
const drop = () => {
  connection.client.isConnected = jest.fn(() => false);
  connection.error = new ConnectionError('CONNECTION_LOST');
  connection.stage = 'error';
};

test.each([
  ['a live connection', () => {}, 'channel', undefined, true],
  ['an interrupted connection', drop, 'danger', INTERRUPTED_DASH, false],
  [
    'a reconnect in progress',
    () => {
      drop();
      connection.connecting = true;
    },
    'controlBorder',
    undefined,
    false,
  ],
  [
    'simulation',
    () => {
      drop();
      storage.simulated = true;
    },
    'controlBorder',
    undefined,
    false,
  ],
  [
    'a setup that never connected',
    () => {
      connection.client = null;
      connection.stage = 'idle';
    },
    'controlBorder',
    undefined,
    false,
  ],
  [
    'a stale drop report on a live transport',
    () => {
      connection.error = new ConnectionError('CONNECTION_LOST');
      connection.stage = 'error';
    },
    'controlBorder',
    undefined,
    false,
  ],
  [
    'a failure that never reached an established transport',
    () => {
      connection.client.isConnected = jest.fn(() => false);
      connection.error = new ConnectionError('CONNECT_FAILED');
      connection.stage = 'error';
    },
    'controlBorder',
    undefined,
    false,
  ],
  [
    'a refused credential',
    () => {
      connection.client.isConnected = jest.fn(() => false);
      connection.error = new ConnectionError('AUTHENTICATION_FAILED');
      connection.stage = 'error';
    },
    'controlBorder',
    undefined,
    false,
  ],
])(
  'draws the phone connectors for %s',
  (_label, prepare, token, dasharray, lit) => {
    prepare();
    render();
    const colors = palette(false);
    const interrupted = dasharray !== undefined;
    for (const id of ['dps', 'hub']) {
      const route = control(`home-map-phone-${id}-path`);
      // The route keeps its exact shape; only its tone and continuity change.
      expect(route.props.stroke).toBe(colors[token]);
      expect(route.props.strokeDasharray).toBe(dasharray);
      // Both carets survive a drop: the link stays two-way, just broken.
      const carets = control(`home-map-phone-${id}-arrows`);
      expect(carets.props.stroke).toBe(colors[token]);
      expect(carets.props.strokeDasharray).toBeUndefined();
      expect(
        tree.root.findAllByProps({testID: `home-map-phone-${id}-tint`}).length >
          0,
      ).toBe(lit);
      expect(
        tree.root.findAllByProps({testID: `home-map-flow-${id}`}).length > 0,
      ).toBe(lit);
    }
    // Colour never carries the state alone, and no claim is invented.
    expect(content().includes(text.Interrupted)).toBe(interrupted);
    if (interrupted) {
      const notice = control('home-map-interrupted');
      expect(notice.props.style).toContainEqual({color: colors.danger});
      // Assistive output states the condition and the route out of it, with
      // no colour key and no claim the app has reconnected.
      expect(notice.props.accessibilityLabel).toBe(text.InterruptedAlert);
      expect(notice.props.accessibilityLabel).not.toMatch(/red|grey|broken/i);
      expect(text.InterruptedAlert).toContain('Connection details');
    }
    // ADR coordination is unrelated to the phone's transport.
    expect(control('home-map-namespace-path').props.strokeDasharray).toBe(
      '4 3',
    );
    expect(control('home-map-namespace-path').props.stroke).toBe(
      colors.controlBorder,
    );
    if (connection.client)
      expect(connection.client.connect).not.toHaveBeenCalled();
  },
);

test('draws the same broken connectors for a deliberate disconnect, in its own words', () => {
  // The runtime clears the client and the error and records the stage, so the
  // map must read the stage instead of inventing a transport failure.
  connection.client = null;
  connection.error = null;
  connection.stage = 'disconnected';
  render();
  const colors = palette(false);
  act(() => {
    control('home-map-compact').props.onLayout({
      nativeEvent: {layout: {width: 360}},
    });
  });
  for (const id of ['dps', 'hub']) {
    const route = control(`home-map-phone-${id}-path`);
    expect(route.props.stroke).toBe(colors.danger);
    expect(route.props.strokeDasharray).toBe(INTERRUPTED_DASH);
    expect(
      control(`home-map-phone-${id}-arrows`).props.strokeDasharray,
    ).toBeUndefined();
    expect(
      tree.root.findAllByProps({testID: `home-map-flow-${id}`}),
    ).toHaveLength(0);
  }
  const notice = control('home-map-interrupted');
  expect(content()).toContain(text.Disconnected);
  expect(content()).not.toContain(text.Interrupted);
  expect(notice.props.accessibilityLabel).toBe(text.DisconnectedAlert);
  expect(notice.props.accessibilityLabel).not.toMatch(/red|grey|broken/i);
  // Attention names a choice the person made, not a fault to diagnose.
  expect(content()).toContain(text.DisconnectedAttention);
  expect(content()).not.toContain(text.ConnectionAttention);
  press('home-attention-connection');
  expect(props.onDetails).toHaveBeenCalledTimes(1);
});

test.each([
  ['a reconnect in flight', () => (connection.connecting = true)],
  ['simulation', () => (storage.simulated = true)],
  [
    'a client that still reports a live transport',
    () => {
      connection.client = {
        identity,
        isConnected: jest.fn(() => true),
        connect: jest.fn(),
        disconnect: jest.fn(),
        on: jest.fn(),
        fetchTwin: jest.fn(),
      };
    },
  ],
])('keeps the map whole when %s follows a disconnect', (_label, prepare) => {
  connection.client = null;
  connection.error = null;
  connection.stage = 'disconnected';
  prepare();
  render();
  act(() => {
    control('home-map-compact').props.onLayout({
      nativeEvent: {layout: {width: 360}},
    });
  });
  for (const flow of tree.root.findAllByType(ChannelFlow))
    expect(flow.props.interrupted).toBe(false);
  expect(control('home-map-phone-hub-path').props.stroke).not.toBe(
    palette(false).danger,
  );
  expect(
    tree.root.findAllByProps({testID: 'home-map-interrupted'}),
  ).toHaveLength(0);
  expect(
    tree.root.findAllByProps({testID: 'home-attention-connection'}),
  ).toHaveLength(0);
});

test('a deliberate disconnect keeps its own stage, never a fabricated error', () => {
  connection.client = null;
  connection.error = null;
  connection.stage = 'disconnected';
  render();
  // The map reads the stage alone; nothing here invents a transport failure.
  expect(content()).not.toContain('CONNECTION_LOST');
  expect(content()).not.toContain(text.ConnectionAttentionHint);
  expect(content()).toContain(text.DisconnectedAttentionHint);
  // An automatic drop and a deliberate disconnect never speak at once.
  connection.client = {
    identity,
    isConnected: jest.fn(() => false),
    connect: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn(),
    fetchTwin: jest.fn(),
  };
  connection.error = new ConnectionError('CONNECTION_LOST');
  connection.stage = 'error';
  render();
  expect(content()).toContain(text.Interrupted);
  expect(content()).not.toContain(text.Disconnected);
});

test('breaks each measured lane when a stacked map loses its connection', () => {
  dimensions = {width: 320, height: 640, scale: 1, fontScale: 1};
  drop();
  render();
  act(() => {
    for (const id of ['dps', 'hub'])
      control(`home-map-lane-${id}`).props.onLayout({
        nativeEvent: {layout: {width: 272}},
      });
  });
  const colors = palette(false);
  for (const id of ['dps', 'hub']) {
    const route = control(`home-map-phone-${id}-path`);
    expect(route.props.d).toBe(lanePath(10, 262));
    expect(route.props.stroke).toBe(colors.danger);
    expect(route.props.strokeDasharray).toBe(INTERRUPTED_DASH);
    const carets = control(`home-map-phone-${id}-arrows`);
    expect(carets.props.d).toBe(laneCaretPath(10, 262));
    expect(carets.props.strokeDasharray).toBeUndefined();
  }
  expect(content()).toContain(text.Interrupted);
});

test('mirrors a broken direct-Hub route without inventing a DPS lane', () => {
  const original = Native.I18nManager.isRTL;
  try {
    storage.credentials = {
      connectionString: `HostName=direct.azure-devices.net;DeviceId=phone;SharedAccessKey=${key}`,
    };
    drop();
    Native.I18nManager.isRTL = true;
    render();
    act(() => {
      control('home-map-compact').props.onLayout({
        nativeEvent: {layout: {width: 360}},
      });
    });
    const flow = tree.root.findByType(ChannelFlow);
    expect(flow.props.interrupted).toBe(true);
    expect(flow.props.channels.map(route => route.id)).toEqual(['hub']);
    const [route] = flow.props.channels;
    expect(control('home-map-phone-hub-path').props.d).toBe(
      channelPath(route.from, route.to),
    );
    expect(control('home-map-phone-hub-path').props.strokeDasharray).toBe(
      INTERRUPTED_DASH,
    );
    expect(
      tree.root.findAllByProps({testID: 'home-map-phone-dps-path'}),
    ).toHaveLength(0);
    expect(content()).toContain(text.DpsNotUsed);
  } finally {
    Native.I18nManager.isRTL = original;
  }
});

test.each([
  ['android', false],
  ['android', true],
  ['ios', false],
  ['ios', true],
])(
  'keeps %s icons static through connect, disconnect and recovery (dark %s)',
  (os, dark) => {
    Native.Platform.OS = os;
    useTheme.mockReturnValue({dark});
    render();
    const phone = os === 'ios' ? 'iphone' : 'android';
    const art = () =>
      ['adr', 'dps', 'hub', phone].map(node =>
        control(`home-icon-${node}`)
          .findByType('Svg')
          .findAll(n => ['Path', 'Polygon', 'Rect', 'Circle'].includes(n.type))
          .map(n => n.props),
      );
    const baseline = art();
    const geometry = control('home-map-phone-hub-path').props.d;
    const colors = palette(dark);
    const motion = () =>
      useGentleTransition.mock.calls
        .filter(([trigger]) => /:(connected|broken|neutral)$/.test(trigger))
        .at(-1);
    const check = (state, color, broken, flowing) => {
      expect(art()).toEqual(baseline);
      expect(control('home-map-phone-hub-path').props.d).toBe(geometry);
      for (const id of ['dps', 'hub']) {
        expect(control(`home-map-phone-${id}-path`).props.stroke).toBe(color);
        expect(control(`home-map-phone-${id}-path`).props.strokeDasharray).toBe(
          broken ? INTERRUPTED_DASH : undefined,
        );
        const label = control(`home-map-phone-${id}-label`);
        expect(Native.StyleSheet.flatten(label.props.style).borderColor).toBe(
          color,
        );
        expect(label.findByType('Text').props.children).toBe(
          text.PathLabels[id],
        );
        expect(
          tree.root.findAllByProps({testID: `home-map-flow-${id}`}).length > 0,
        ).toBe(flowing);
      }
      expect(motion()[0]).toMatch(new RegExp(`:${state}$`));
      expect(motion()[1]).toBe(true);
      expect(control('home-map-namespace-path').props.stroke).toBe(
        colors.controlBorder,
      );
    };
    expect(control('home-node-phone').props.accessibilityLabel).toContain(
      text.PhonePlatforms[os],
    );
    check('connected', colors.channel, false, true);
    connection.client = null;
    connection.error = null;
    connection.stage = 'disconnected';
    render();
    check('broken', colors.danger, true, false);
    expect(useDecorativeLoop).toHaveBeenLastCalledWith(false);
    connection.connecting = true;
    render();
    check('neutral', colors.controlBorder, false, false);
    connection.connecting = false;
    connection.stage = 'connected';
    connection.client = {identity, isConnected: jest.fn(() => true)};
    render();
    check('connected', colors.channel, false, true);
    drop();
    render();
    check('broken', colors.danger, true, false);
    props.motionVisible = false;
    render();
    expect(motion()[1]).toBe(false);
    expect(art()).toEqual(baseline);
  },
);

test.each([false, true])(
  'centers route labels on measured links in RTL %s',
  rtl => {
    const original = Native.I18nManager.isRTL;
    try {
      Native.I18nManager.isRTL = rtl;
      render();
      act(() =>
        control('home-map-compact').props.onLayout({
          nativeEvent: {layout: {width: 320}},
        }),
      );
      const flow = tree.root.findByType(ChannelFlow);
      expect(
        flow
          .findAllByType(Native.View)
          .some(
            view =>
              Native.StyleSheet.flatten(view.props.style)?.direction === 'ltr',
          ),
      ).toBe(true);
      const phoneTitle = control('home-node-phone')
        .findAllByType('Text')
        .find(label => label.props.children === text.PhonePlatforms.ios);
      expect(Native.StyleSheet.flatten(phoneTitle.props.style).textAlign).toBe(
        rtl ? 'right' : 'left',
      );
      for (const channel of tree.root.findByType(ChannelFlow).props.channels) {
        const label = control(`home-map-phone-${channel.id}-label`);
        const style = Native.StyleSheet.flatten(label.props.style);
        expect(style.left + style.width / 2).toBe(
          (channel.from + channel.to) / 2,
        );
        expect(style.left).toBeGreaterThanOrEqual(0);
        expect(style.left + style.width).toBeLessThanOrEqual(320);
        expect(label.props.accessibilityElementsHidden).toBe(true);
      }
      storage.credentials = {
        connectionString: `HostName=direct.azure-devices.net;DeviceId=phone;SharedAccessKey=${key}`,
      };
      render();
      expect(
        tree.root.findAllByProps({testID: 'home-map-phone-dps-label'}),
      ).toHaveLength(0);
      expect(control('home-map-phone-hub-label')).toBeDefined();
      dimensions.fontScale = 1.8;
      render();
      expect(
        tree.root.findAllByProps({testID: 'home-map-phone-hub-label'}),
      ).toHaveLength(0);
      expect(content()).toContain(text.PhoneHubPath);
    } finally {
      Native.I18nManager.isRTL = original;
    }
  },
);
