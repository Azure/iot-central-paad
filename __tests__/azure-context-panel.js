import React, {useContext} from 'react';
import renderer, {act} from 'react-test-renderer';
import {Linking, Platform, StyleSheet} from 'react-native';
import * as Keychain from 'react-native-keychain';
import AzureContextPanel from '../src/components/azureContextPanel';
import StorageProvider, {
  StorageContext,
  restoreStoredState,
} from '../src/contexts/storage';
import {decodeAzureContextInput} from '../src/onboarding/azureContextInput';
import Strings from '../src/strings';
import {useTheme} from '../src/hooks';
import {palette} from '../src/theme/palette';
import {surfaceColor} from '../src/components/surface';

jest.mock('../src/hooks', () => ({useTheme: jest.fn(() => ({dark: false}))}));
jest.mock('../src/components/typography', () => ({Text: 'Text'}));
jest.mock('@rneui/themed', () => ({Icon: 'Icon'}));

const subscription = '11111111-2222-4333-8444-555555555555';
const scope = `/subscriptions/${subscription}/resourceGroups/context-rg`;
const namespace = `${scope}/providers/Microsoft.DeviceRegistry/namespaces/context-ns`;
const identity = {
  deviceId: 'context-device',
  assignedHub: 'context-hub.device.azure-devices.net',
  registrationId: 'context-registration',
  modelId: 'dtmi:azureiot:PhoneAsADevice;2',
};
const credentials = {
  scopeId: '0ne12345678',
  registrationId: identity.registrationId,
  deviceKey: Buffer.alloc(32, 1).toString('base64'),
};
const fixture = () => ({
  schema: 'paad.azure-context',
  version: 1,
  capturedAt: '2026-09-17T19:00:00.000Z',
  binding: {
    deviceId: identity.deviceId,
    assignedHub: identity.assignedHub,
    registrationId: identity.registrationId,
  },
  subscription: {id: subscription, name: 'Context Subscription'},
  resourceGroup: {name: 'context-rg'},
  namespace: {
    name: 'context-ns',
    resourceId: namespace,
    location: 'testregion',
  },
  hub: {
    name: 'context-hub',
    resourceId: `${scope}/providers/Microsoft.Devices/IotHubs/context-hub`,
  },
  activities: [
    {
      timestamp: '2026-09-17T18:00:00.000Z',
      operation: 'Microsoft.DeviceRegistry/namespaces/registryDevices/write',
      status: 'Succeeded',
      resourceId: `${namespace}/registryDevices/another-device`,
    },
  ],
});
let tree;
let storage;
let selectedIdentity;
const Harness = () => {
  storage = useContext(StorageContext);
  return <AzureContextPanel identity={selectedIdentity} />;
};
const content = () => JSON.stringify(tree.toJSON());
const control = id => tree.root.findAllByProps({testID: id})[0];
const press = async id => {
  await act(async () => {
    await control(id).props.onPress();
  });
};
beforeEach(async () => {
  jest.clearAllMocks();
  useTheme.mockReturnValue({dark: false});
  Keychain.setGenericPassword.mockReset().mockResolvedValue(true);
  Keychain.getGenericPassword.mockReset().mockResolvedValue(false);
  Keychain.resetGenericPassword.mockReset().mockResolvedValue(true);
  selectedIdentity = identity;
  await act(async () => {
    tree = renderer.create(
      <StorageProvider>
        <Harness />
      </StorageProvider>,
    );
  });
  await act(async () => {
    await storage.save({credentials});
  });
});
afterEach(async () => {
  await act(async () => {
    tree.unmount();
  });
  expect(global.fetch).not.toHaveBeenCalled();
  expect(global.XMLHttpRequest).not.toHaveBeenCalled();
  expect(global.WebSocket).not.toHaveBeenCalled();
});

async function enter(snapshot = fixture()) {
  await press('azure-context-import-toggle');
  await act(async () => {
    control('azure-context-input').props.onChangeText(JSON.stringify(snapshot));
  });
}

test('imports a matching snapshot, persists it and distinguishes namespace activity from telemetry', async () => {
  await enter();
  await press('azure-context-import');
  expect(storage.azureContext.namespace.name).toBe('context-ns');
  expect(control('azure-context-namespace').props.children).toBe('context-ns');
  expect(content()).toContain(Strings.AzureContext.Source);
  expect(content()).toContain(Strings.AzureContext.Explanation);
  expect(control('azure-context-subscription').props.children).toBe(
    'Context Subscription',
  );
  await press('azure-context-activities');
  expect(content()).toContain('another-device');
  expect(content()).toContain('This is not telemetry history.');
  const saved = JSON.parse(Keychain.setGenericPassword.mock.calls.at(-1)[1]);
  expect(restoreStoredState(saved).azureContext).toEqual(storage.azureContext);
  expect(restoreStoredState(saved).azureContextError).toBe(false);
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  await act(async () => {
    await tree.root
      .findAllByProps({
        accessibilityLabel: `${Strings.AzureContext.Namespace}: ${Strings.AzureContext.Portal}`,
      })[0]
      .props.onPress();
  });
  expect(open).toHaveBeenCalledWith(
    `https://portal.azure.com/#resource${namespace}/overview`,
  );
  open.mockRestore();
});

test('rejects a different device or malformed input without altering saved credentials', async () => {
  const wrong = fixture();
  wrong.binding.deviceId = 'wrong-device';
  await enter(wrong);
  await press('azure-context-import');
  expect(content()).toContain(Strings.AzureContext.WrongDevice);
  expect(storage.azureContext).toBeNull();
  await act(async () => {
    control('azure-context-input').props.onChangeText('SECRET_CANARY');
  });
  await press('azure-context-import');
  expect(control('azure-context-error').props.children).toBe(
    Strings.AzureContext.Invalid,
  );
  expect(storage.credentials).toEqual(credentials);
});

test('hides a stored snapshot when the assigned identity changes or is simulated/unavailable', async () => {
  await act(async () => {
    await storage.save({azureContext: fixture()});
  });
  selectedIdentity = {...identity, deviceId: 'other-device'};
  await act(async () => {
    tree.update(
      <StorageProvider>
        <Harness />
      </StorageProvider>,
    );
  });
  expect(content()).not.toContain('Context Subscription');
  expect(content()).not.toContain('context-ns');
  expect(content()).toContain(Strings.AzureContext.OtherDevice);
  selectedIdentity = null;
  await act(async () => {
    tree.update(
      <StorageProvider>
        <Harness />
      </StorageProvider>,
    );
  });
  expect(content()).toContain(Strings.AzureContext.Unavailable);
  expect(
    tree.root.findAllByProps({testID: 'azure-context-input'}),
  ).toHaveLength(0);
});

test('surfaces a storage failure and keeps the previous snapshot', async () => {
  await act(async () => {
    await storage.save({azureContext: fixture()});
  });
  await enter({
    ...fixture(),
    subscription: {id: subscription, name: 'Replacement'},
  });
  Keychain.setGenericPassword.mockResolvedValueOnce(false);
  await press('azure-context-import');
  expect(content()).toContain(Strings.AzureContext.SaveFailed);
  expect(storage.azureContext.subscription.name).toBe('Context Subscription');
  await press('azure-context-remove');
  expect(storage.azureContext).toBeNull();
  expect(storage.credentials).toEqual(credentials);
});

test('corrupt optional context surfaces an error without preventing credentials from restoring', async () => {
  const restored = restoreStoredState({
    credentials,
    azureContext: {unexpected: 'CANARY'},
  });
  expect(restored.azureContext).toBeNull();
  expect(restored.azureContextError).toBe(true);
  expect(restored.credentials.registrationId).toBe(identity.registrationId);
  Keychain.getGenericPassword.mockResolvedValueOnce({
    password: JSON.stringify({
      credentials,
      azureContext: {unexpected: 'CANARY'},
    }),
  });
  await act(async () => {
    await storage.read();
  });
  expect(content()).toContain(Strings.AzureContext.StoredInvalid);
  expect(content()).not.toContain('CANARY');
});

test('forgetting credentials clears context and rejects a queued import after forgetting', async () => {
  await act(async () => {
    await storage.save({azureContext: fixture()});
  });
  let importResult;
  await act(async () => {
    const forgot = storage.save({credentials: null});
    importResult = storage.save({azureContext: fixture()}).then(
      () => true,
      () => false,
    );
    await forgot;
    expect(await importResult).toBe(false);
  });
  expect(storage.azureContext).toBeNull();
  expect(storage.credentials).toBeNull();
});

test('supports canonical Base64 without accepting corrupted UTF-8 or credential envelopes', () => {
  const data = JSON.stringify(fixture());
  expect(decodeAzureContextInput(Buffer.from(data).toString('base64'))).toEqual(
    fixture(),
  );
  expect(() =>
    decodeAzureContextInput(Buffer.from([0xff]).toString('base64')),
  ).toThrow();
  expect(() => decodeAzureContextInput('x'.repeat(87385))).toThrow();
  expect(() =>
    decodeAzureContextInput(JSON.stringify({deviceKey: 'not-a-snapshot'})),
  ).toThrow();
});

test.each([false, true])(
  'keeps the snapshot recessed, names neutral and disclosed IDs selectable (dark %s)',
  async dark => {
    useTheme.mockReturnValue({dark});
    const snapshot = fixture();
    snapshot.namespace.name = `namespace-${'long-name-'.repeat(5)}end`;
    snapshot.namespace.resourceId = `${scope}/providers/Microsoft.DeviceRegistry/namespaces/${snapshot.namespace.name}`;
    snapshot.activities[0].resourceId = `${snapshot.namespace.resourceId}/registryDevices/another-device`;
    snapshot.activities.push({...snapshot.activities[0], status: 'Failed'});
    await act(async () => {
      await storage.save({azureContext: snapshot});
    });
    const colors = palette(dark);
    const style = node =>
      StyleSheet.flatten(
        typeof node.props.style === 'function'
          ? node.props.style({pressed: false})
          : node.props.style,
      );
    const textNode = content =>
      tree.root
        .findAllByType('Text')
        .find(node => node.props.children === content);
    expect(style(control('azure-context-panel'))).toMatchObject({
      backgroundColor: colors.inset,
      borderRadius: 20,
      paddingHorizontal: 20,
      paddingVertical: 16,
      gap: 12,
    });
    expect(style(control('azure-context-panel')).borderWidth).toBeUndefined();
    const name = control('azure-context-namespace');
    expect(name.props.children).toBe(snapshot.namespace.name);
    expect(name.props.selectable).toBe(true);
    // Exactly one 17/24 section header; the subject line is a 15/22 name.
    expect(style(textNode(Strings.AzureContext.Title))).toMatchObject({
      fontSize: 17,
      lineHeight: 24,
      fontWeight: '600',
      letterSpacing: -0.2,
      color: colors.text,
    });
    expect(style(name)).toMatchObject({
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '600',
      color: colors.text,
    });
    expect(style(name).letterSpacing).toBeUndefined();
    await press('azure-context-toggle');
    const resourceName = control('azure-context-subscription');
    expect(style(resourceName)).toMatchObject({
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '400',
      color: colors.text,
    });
    expect(style(resourceName).fontFamily).toBeUndefined();
    expect(style(resourceName.parent).paddingTop).toBeUndefined();
    const ancestor = (node, match) => {
      let current = node.parent;
      while (current && !match(style(current))) {
        current = current.parent;
      }
      return current;
    };
    const rowOf = node =>
      ancestor(node, found => found?.paddingVertical === 14);
    const groupOf = node =>
      ancestor(rowOf(node), found => found?.borderRadius === 16);
    // The first fact in a group carries no rule; later facts are separated.
    expect(style(rowOf(resourceName))).toMatchObject({
      paddingVertical: 14,
      gap: 4,
    });
    expect(style(rowOf(resourceName)).borderTopWidth).toBeUndefined();
    expect(style(rowOf(control('azure-context-resource-group')))).toMatchObject(
      {
        paddingVertical: 14,
        gap: 4,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border,
      },
    );
    // Facts sit on the brightest surface; the panel itself stays recessed.
    for (const id of [
      'azure-context-subscription',
      'azure-context-region',
      'azure-context-resource-group',
    ]) {
      expect(style(groupOf(control(id)))).toMatchObject({
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 16,
        paddingHorizontal: 16,
      });
    }
    // Small captions label each group without competing with the section
    // header, and stay distinct from the muted field labels below them.
    for (const groupLabel of [
      Strings.AzureContext.Scope,
      Strings.AzureContext.Resources,
      Strings.AzureContext.Activities,
      Strings.AzureContext.Manage,
    ]) {
      const caption = textNode(groupLabel);
      expect(caption.props.accessibilityRole).toBe('header');
      expect(style(caption)).toMatchObject({
        fontSize: 12,
        lineHeight: 16,
        fontWeight: '600',
        letterSpacing: 0.2,
        color: colors.text,
      });
    }
    expect(style(textNode(Strings.AzureContext.Subscription)).color).toBe(
      colors.muted,
    );
    await press('azure-context-ids');
    await press('azure-context-activities');
    for (const resourceId of [
      snapshot.namespace.resourceId,
      snapshot.activities[0].resourceId,
    ]) {
      const node = textNode(resourceId);
      expect(node.props.selectable).toBe(true);
      expect(style(node)).toMatchObject({
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontSize: 14,
        lineHeight: 22,
      });
    }
    expect(style(textNode('Succeeded')).color).toBe(colors.text);
    expect(style(textNode('Failed')).color).toBe(colors.danger);
    expect(content()).toContain(Strings.AzureContext.Source);
    expect(content()).toContain(Strings.AzureContext.ActivityExplanation);
    // The portal affordance repeats once per resource, so it stays a short
    // recessed pill inside the data group and carries the full name only on
    // its accessible label.
    expect(textNode(Strings.AzureContext.Portal)).toBeUndefined();
    expect(textNode(Strings.AzureContext.PortalShort)).toBeDefined();
    const portals = tree.root.findAll(
      node => node.props.onPress && node.props.accessibilityRole === 'link',
    );
    expect(portals.length).toBeGreaterThan(1);
    for (const portal of portals) {
      expect(
        portal.props.accessibilityLabel.endsWith(
          `: ${Strings.AzureContext.Portal}`,
        ),
      ).toBe(true);
      expect(style(portal)).toMatchObject({
        minHeight: 48,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.controlBorder,
      });
      // Painted as a lifted secondary control, whichever ground it sits on.
      expect([
        surfaceColor(dark, {tone: 'secondary'}),
        surfaceColor(dark, {tone: 'raised'}),
      ]).toContain(style(portal).backgroundColor);
    }
    for (const id of [
      'azure-context-toggle',
      'azure-context-ids',
      'azure-context-activities',
    ]) {
      expect(style(control(id)).minHeight).toBe(48);
      expect(style(control(id)).alignSelf).toBe('flex-start');
      expect(style(control(id))).toMatchObject({
        backgroundColor: colors.tints[0],
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.controlBorder,
      });
    }
    // Snapshot management is one grouped row rather than scattered pills.
    for (const id of ['azure-context-import-toggle', 'azure-context-remove']) {
      expect(style(control(id)).alignSelf).toBe('stretch');
    }
    expect(style(control('azure-context-import-toggle'))).toMatchObject({
      minHeight: 48,
      borderRadius: 14,
      backgroundColor: surfaceColor(dark, {tone: 'raised'}),
    });
    expect(style(control('azure-context-remove'))).toMatchObject({
      backgroundColor: colors.dangerSurface,
      borderColor: colors.danger,
    });
    for (const node of tree.root.findAllByType('Text')) {
      expect(node.props.numberOfLines).toBeUndefined();
      expect(node.props.maxFontSizeMultiplier).toBeUndefined();
      expect(node.props.allowFontScaling).not.toBe(false);
    }
  },
);

test('keeps importing controls visibly disabled while saving and reports failure in danger', async () => {
  await act(async () => {
    await storage.save({azureContext: fixture()});
  });
  await press('azure-context-toggle');
  await enter();
  let finish;
  Keychain.setGenericPassword.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  let pending;
  await act(async () => {
    pending = control('azure-context-import').props.onPress();
  });
  const input = control('azure-context-input');
  expect(input.props.editable).toBe(false);
  expect(StyleSheet.flatten(input.props.style)).toMatchObject({
    borderRadius: 14,
    borderColor: palette(false).controlBorder,
    backgroundColor: palette(false).inset,
    opacity: 0.5,
    fontSize: 15,
    lineHeight: 22,
  });
  for (const node of tree.root.findAll(
    node =>
      node.props.onPress &&
      ['button', 'link'].includes(node.props.accessibilityRole),
  )) {
    expect(node.props.disabled).toBe(true);
    expect(node.props.accessibilityState.disabled).toBe(true);
    expect(
      StyleSheet.flatten(
        typeof node.props.style === 'function'
          ? node.props.style({pressed: false})
          : node.props.style,
      ).opacity,
    ).toBe(0.5);
  }
  await act(async () => {
    finish(false);
    await pending;
  });
  expect(control('azure-context-error').props.children).toBe(
    Strings.AzureContext.SaveFailed,
  );
  expect(
    StyleSheet.flatten(control('azure-context-error').props.style),
  ).toMatchObject({
    color: palette(false).danger,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  });
  expect(control('azure-context-input').props.editable).toBe(true);
});

test('groups scope and resource facts, discloses identifiers once and keeps every portal callback working', async () => {
  await act(async () => {
    await storage.save({azureContext: fixture()});
  });
  // Collapsed the section stays a subject line, a caveat and management only.
  expect(content()).not.toContain(Strings.AzureContext.Scope);
  expect(content()).not.toContain('context-rg');
  expect(content()).toContain(Strings.AzureContext.Manage);
  expect(content()).toContain(Strings.AzureContext.Explanation);
  await press('azure-context-toggle');
  for (const label of [
    Strings.AzureContext.Scope,
    Strings.AzureContext.Resources,
    Strings.AzureContext.Activities,
  ]) {
    expect(content()).toContain(label);
  }
  expect(control('azure-context-resource-group').props.children).toBe(
    'context-rg',
  );
  expect(control('azure-context-region').props.children).toBe('testregion');
  expect(content()).toContain(Strings.AzureContext.RegistryMissing);

  const detailed = fixture();
  detailed.dps = {
    name: 'context-dps',
    resourceId: `${scope}/providers/Microsoft.Devices/provisioningServices/context-dps`,
  };
  detailed.registryDevice = {
    name: 'context-registry',
    externalDeviceId: identity.deviceId,
    resourceId: `${namespace}/registryDevices/context-registry`,
  };
  await act(async () => {
    await storage.save({azureContext: detailed});
  });
  expect(content()).not.toContain(Strings.AzureContext.RegistryMissing);
  expect(content()).toContain('context-dps');
  expect(content()).toContain('context-registry');

  // One disclosure reveals every technical identifier, facts and activity
  // alike, and hides them again.
  expect(content()).not.toContain(`/subscriptions/${subscription}`);
  await press('azure-context-activities');
  await press('azure-context-ids');
  expect(content()).toContain(`/subscriptions/${subscription}`);
  expect(content()).toContain(detailed.activities[0].resourceId);
  await press('azure-context-ids');
  expect(content()).not.toContain(detailed.activities[0].resourceId);
  expect(content()).toContain('another-device');

  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  const portal = async label => {
    await act(async () => {
      await tree.root
        .findAllByProps({
          accessibilityLabel: `${label}: ${Strings.AzureContext.Portal}`,
        })[0]
        .props.onPress();
    });
  };
  for (const [label, resourceId] of [
    [Strings.AzureContext.Subscription, `/subscriptions/${subscription}`],
    [Strings.AzureContext.ResourceGroup, scope],
    [Strings.AzureContext.Namespace, namespace],
    [Strings.AzureContext.Hub, detailed.hub.resourceId],
    [Strings.AzureContext.Dps, detailed.dps.resourceId],
    [Strings.AzureContext.Registry, detailed.registryDevice.resourceId],
  ]) {
    await portal(label);
    expect(open).toHaveBeenLastCalledWith(
      `https://portal.azure.com/#resource${resourceId}/overview`,
    );
  }
  open.mockRejectedValueOnce(new Error('no portal'));
  await portal(Strings.AzureContext.Hub);
  expect(control('azure-context-error').props.children).toBe(
    Strings.AzureContext.OpenFailed,
  );
  open.mockRestore();
  expect(storage.credentials).toEqual(credentials);
});

test.each([false, true])(
  'stacks snapshot management as full-width rows with honest local-only copy (dark %s)',
  async dark => {
    useTheme.mockReturnValue({dark});
    const colors = palette(dark);
    const text = Strings.AzureContext;
    await act(async () => {
      await storage.save({azureContext: fixture()});
    });
    const style = node =>
      StyleSheet.flatten(
        typeof node.props.style === 'function'
          ? node.props.style({pressed: false})
          : node.props.style,
      );
    const toggle = () => control('azure-context-import-toggle');
    const remove = () => control('azure-context-remove');
    const caption = tree.root
      .findAllByType('Text')
      .find(node => node.props.children === text.Manage);
    expect(caption.props.accessibilityRole).toBe('header');
    const rows = caption.parent;
    expect(
      rows
        .findAll(
          node =>
            typeof node.type === 'string' &&
            node.props.accessibilityRole === 'button',
        )
        .map(node => node.props.testID),
    ).toEqual(['azure-context-import-toggle', 'azure-context-remove']);
    for (const [row, label, hint] of [
      [toggle(), text.Replace, text.ReplaceDetail],
      [remove(), text.Remove, text.RemoveDetail],
    ]) {
      expect(row.props.accessibilityRole).toBe('button');
      expect(row.props.accessibilityLabel).toBe(label);
      expect(row.props.accessibilityHint).toBe(hint);
      expect(style(row).minHeight).toBeGreaterThanOrEqual(48);
      expect(style(row).height).toBeUndefined();
      expect(style(row)).toMatchObject({
        alignSelf: 'stretch',
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
      });
      expect(content()).toContain(hint);
    }
    expect(style(remove())).toMatchObject({
      backgroundColor: colors.dangerSurface,
      borderColor: colors.danger,
    });
    expect(style(toggle()).backgroundColor).toBe(
      surfaceColor(dark, {tone: 'raised'}),
    );
    expect(toggle().props.accessibilityState).toMatchObject({
      expanded: false,
      disabled: false,
    });
    await press('azure-context-import-toggle');
    expect(toggle().props.accessibilityState.expanded).toBe(true);
    expect(style(toggle()).backgroundColor).toBe(colors.tints[0]);
    expect(control('azure-context-input').props.editable).toBe(true);
    // The editor keeps its own submit pair; the rows above stay unchanged.
    expect(control('azure-context-import').props.accessibilityLabel).toBe(
      text.Import,
    );
    await press('azure-context-import-toggle');
    expect(
      tree.root.findAllByProps({testID: 'azure-context-input'}),
    ).toHaveLength(0);
    expect(text.RemoveDetail).toContain('this phone only');
    expect(text.RemoveDetail).toContain('No Azure resource');
    await press('azure-context-remove');
    expect(storage.azureContext).toBeNull();
    expect(storage.credentials).toEqual(credentials);
    expect(content()).toContain(text.Empty);
  },
);

test('offers import copy and no removal row before a snapshot exists', async () => {
  const text = Strings.AzureContext;
  const toggle = control('azure-context-import-toggle');
  expect(toggle.props.accessibilityLabel).toBe(text.Import);
  expect(toggle.props.accessibilityHint).toBe(text.ImportDetail);
  expect(toggle.findByType('Icon').props.name).toBe('tray-arrow-down');
  expect(
    tree.root.findAllByProps({testID: 'azure-context-remove'}),
  ).toHaveLength(0);
  await enter();
  await press('azure-context-import');
  expect(storage.azureContext.namespace.name).toBe('context-ns');
  const replaced = control('azure-context-import-toggle');
  expect(replaced.props.accessibilityLabel).toBe(text.Replace);
  expect(replaced.props.accessibilityHint).toBe(text.ReplaceDetail);
  expect(replaced.findByType('Icon').props.name).toBe('pencil-outline');
});
