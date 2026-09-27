import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Keyboard, Platform, TextInput} from 'react-native';
import {CredentialForm, manualCredentials} from '../src/onboarding/manual';
import {
  ProofActivity,
  newProofNonce,
  submitProof,
  validProofNonce,
} from '../src/onboarding/proof';
import {connectionDiagnostics} from '../src/onboarding/diagnostics';
import {StyleSheet} from 'react-native';
import {palette} from '../src/theme/palette';
import {surfaceColor} from '../src/components/surface';
import {ConnectionError} from '../src/connection/errors';
import {PHONE_MODEL_ID} from '../src/connection';
import ThemeProvider from '../src/contexts/theme';

let view;
const render = child => renderer.create(<ThemeProvider>{child}</ThemeProvider>);
const control = id =>
  view.root.findAllByProps({testID: id}).find(node => node.props.onPress);
const status = () =>
  view.root.findAllByProps({testID: 'proof-status'})[0].props.children;
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return {promise, resolve, reject};
};
const client = () => ({
  isConnected: jest.fn(() => true),
  sendTelemetry: jest.fn(async () => ({delivery: 'submitted'})),
  sendProperty: jest.fn(async () => ({delivery: 'submitted'})),
});
afterEach(() => {
  act(() => view?.unmount());
  view = undefined;
  jest.restoreAllMocks();
});

test('individual is the default; controlled fields survive failure and duplicate presses', async () => {
  const dismiss = jest.spyOn(Keyboard, 'dismiss');
  const pending = deferred();
  const submit = jest.fn(() => pending.promise);
  act(() => {
    view = render(
      <CredentialForm
        credentials={null}
        readonly={false}
        loading={false}
        submit={submit}
      />,
    );
  });
  const input = id =>
    view.root
      .findAllByType(TextInput)
      .find(node => node.props.testID === `connection-${id}`);
  act(() => control('connection-methods').props.onPress());
  expect(
    control('connection-mode-individual').props.accessibilityState.selected,
  ).toBe(true);
  act(() => control('connection-mode-individual').props.onPress());
  expect(input('provisioningHost').props.value).toBe(
    'global.azure-devices-provisioning.net',
  );
  expect(input('deviceKey').props.secureTextEntry).toBe(true);
  expect(input('deviceKey').props.autoCorrect).toBe(false);
  expect(input('deviceKey').props.autoComplete).toBe('off');
  expect(input('provisioningHost').props.selectTextOnFocus).toBe(true);
  expect(input('deviceKey').props.selectTextOnFocus).toBe(false);
  for (const field of [
    'registrationId',
    'scopeId',
    'deviceKey',
    'provisioningHost',
  ]) {
    expect(input(field).props.returnKeyType).toBe('done');
    expect(input(field).props.submitBehavior).toBe('blurAndSubmit');
    act(() => input(field).props.onSubmitEditing());
  }
  expect(dismiss).toHaveBeenCalledTimes(4);
  act(() => {
    input('registrationId').props.onChangeText('phone');
    input('scopeId').props.onChangeText('0ne123');
    input('deviceKey').props.onChangeText('invalid-but-preserved');
    input('provisioningHost').props.onChangeText(
      'global-canary.azure-devices-provisioning.net',
    );
  });
  let first;
  act(() => {
    first = control('connection-submit').props.onPress();
    control('connection-submit').props.onPress();
  });
  expect(submit).toHaveBeenCalledTimes(1);
  expect(submit).toHaveBeenCalledWith({
    registrationId: 'phone',
    scopeId: '0ne123',
    deviceKey: 'invalid-but-preserved',
    keyType: 'device',
    provisioningHost: 'global-canary.azure-devices-provisioning.net',
    modelId: PHONE_MODEL_ID,
  });
  await act(async () => {
    pending.resolve();
    await first;
  });
  expect(input('deviceKey').props.value).toBe('invalid-but-preserved');
  act(() => control('connection-methods').props.onPress());
  act(() => control('connection-mode-hub').props.onPress());
  expect(input('connectionString').props.secureTextEntry).toBe(true);
  act(() => control('connection-methods').props.onPress());
  act(() => control('connection-mode-individual').props.onPress());
  expect(input('deviceKey').props.value).toBe('invalid-but-preserved');
});

test('explicit legacy and direct mappings use only existing core credential fields', () => {
  const values = {
    registrationId: 'phone',
    scopeId: '0ne123',
    deviceKey: 'key',
    provisioningHost: 'global.azure-devices-provisioning.net',
    connectionString: 'HostName=value',
  };
  expect(manualCredentials('legacy', values)).toMatchObject({
    authKey: 'key',
    keyType: 'group',
  });
  expect(manualCredentials('legacy', values).deviceKey).toBeUndefined();
  expect(manualCredentials('hub', values)).toEqual({
    connectionString: 'HostName=value',
    modelId: PHONE_MODEL_ID,
  });
});

test('nonce keyboard submission dismisses without publishing a proof', () => {
  const dismiss = jest.spyOn(Keyboard, 'dismiss');
  const device = client();
  act(() => {
    view = render(
      <ProofActivity client={device} connected simulated={false} />,
    );
  });
  const input = view.root.findByType(TextInput);
  expect(input.props.selectTextOnFocus).toBe(true);
  expect(input.props.returnKeyType).toBe('done');
  expect(input.props.submitBehavior).toBe('blurAndSubmit');
  act(() => input.props.onSubmitEditing());
  expect(dismiss).toHaveBeenCalledTimes(1);
  expect(device.sendTelemetry).not.toHaveBeenCalled();
  expect(device.sendProperty).not.toHaveBeenCalled();
});

test('proof requires both local submissions and rejects duplicate presses', async () => {
  const device = client();
  const pending = deferred();
  device.sendTelemetry.mockReturnValue(pending.promise);
  act(() => {
    view = render(
      <ProofActivity client={device} connected simulated={false} />,
    );
  });
  const nonce = view.root.findByType(TextInput).props.value;
  expect(validProofNonce(nonce)).toBe(true);
  let first;
  act(() => {
    first = control('proof-send').props.onPress();
    control('proof-send').props.onPress();
  });
  expect(device.sendTelemetry).toHaveBeenCalledTimes(1);
  expect(device.sendProperty).not.toHaveBeenCalled();
  expect(status()).not.toBe('Submitted locally');
  await act(async () => {
    pending.resolve({delivery: 'submitted'});
    await first;
  });
  expect(device.sendTelemetry).toHaveBeenCalledWith({
    paadProofNonce: nonce,
    paadProofPlatform: Platform.OS,
  });
  expect(device.sendProperty).toHaveBeenCalledWith({
    paadProof: {nonce, platform: Platform.OS},
  });
  expect(status()).toBe('Submitted locally');
  expect(JSON.stringify(view.toJSON())).not.toContain('PUBACK');
});

test.each(['simulated', 'failure', 'disconnect', 'unmount'])(
  'proof cannot pretend success after %s',
  async kind => {
    const device = client();
    const pending = deferred();
    device.sendTelemetry.mockReturnValue(pending.promise);
    act(() => {
      view = render(
        <ProofActivity
          client={device}
          connected
          simulated={kind === 'simulated'}
        />,
      );
    });
    let first;
    act(() => {
      first = control('proof-send').props.onPress();
    });
    if (kind === 'simulated') {
      expect(device.sendTelemetry).not.toHaveBeenCalled();
      expect(status()).not.toBe('Submitted locally');
      return;
    }
    if (kind === 'disconnect') {
      act(() =>
        view.update(
          <ThemeProvider>
            <ProofActivity
              client={device}
              connected={false}
              simulated={false}
            />
          </ThemeProvider>,
        ),
      );
    }
    if (kind === 'unmount') {
      act(() => view.unmount());
      view = undefined;
    }
    await act(async () => {
      if (kind === 'failure') {
        pending.reject(new Error('secret-transport-data'));
      } else {
        pending.resolve({delivery: 'submitted'});
      }
      await first;
    });
    expect(device.sendProperty).not.toHaveBeenCalled();
    if (view) {
      expect(status()).not.toBe('Submitted locally');
      expect(JSON.stringify(view.toJSON())).not.toContain(
        'secret-transport-data',
      );
    }
  },
);

test.each(['simulated', 'acknowledged', undefined])(
  'non-submitted property result %s never succeeds',
  async delivery => {
    const device = client();
    device.sendProperty.mockResolvedValue({delivery});
    expect(await submitProof(device, newProofNonce(), 'ios', () => true)).toBe(
      false,
    );
  },
);

test.each(['short', 'space disallowed nonce', 'a'.repeat(129), 'a'.repeat(15)])(
  'invalid proof nonce never sends %s',
  async nonce => {
    const device = client();
    expect(await submitProof(device, nonce, 'ios', () => true)).toBe(false);
    expect(device.sendTelemetry).not.toHaveBeenCalled();
  },
);

test('diagnostic DTO allowlists identity and safe errors, never credentials or helper registry confirmation', () => {
  const identity = {
    assignedHub: 'assigned.azure-devices.net',
    deviceId: 'assigned-phone',
    modelId: PHONE_MODEL_ID,
    registrationId: 'registration-phone',
    operationId: 'operation-1',
    deviceKey: 'DO-NOT-EXPORT',
    connectionString: 'DO-NOT-EXPORT',
    registryDeviceExternalId: 'DO-NOT-EXPORT',
    native: {secret: 'DO-NOT-EXPORT'},
  };
  const error = new ConnectionError('PROVISIONING_FAILED', {
    serviceCode: 403000,
    operationId: 'operation-2',
  });
  error.secret = 'DO-NOT-EXPORT';
  const dto = connectionDiagnostics(identity, 'error', false, false, error);
  expect(dto).toMatchObject({
    registryStatus: 'Not checked',
    errorCode: 'PROVISIONING_FAILED',
    serviceCode: 403000,
  });
  expect(JSON.stringify(dto)).not.toContain('DO-NOT-EXPORT');
  expect(
    connectionDiagnostics(identity, 'connected', true, true, null).deviceId,
  ).toBeUndefined();
});

test('manual-disconnect diagnostics retain the state without an error code', () => {
  expect(
    connectionDiagnostics(null, 'disconnected', false, false, null),
  ).toEqual({
    schema: 'paad.diagnostics',
    version: 1,
    connection: 'disconnected',
    stage: 'disconnected',
    registryStatus: 'Not checked',
  });
});

test('credential controls follow one hierarchy and keep the method choices radios', () => {
  const colors = palette(false);
  act(() => {
    view = render(
      <CredentialForm
        credentials={null}
        readonly={false}
        loading={false}
        submit={jest.fn()}
      />,
    );
  });
  const style = node => StyleSheet.flatten(node.props.style);

  // Primary: the single commitment, with a solid forest fill.
  const connect = control('connection-submit');
  expect(connect.props.accessibilityRole).toBe('button');
  expect(style(connect).backgroundColor).toBe(
    surfaceColor(false, {tone: 'primary'}),
  );
  expect(style(connect).minHeight).toBeGreaterThanOrEqual(48);
  expect(style(connect).alignSelf).toBe('stretch');
  expect(style(connect).opacity).toBeUndefined();

  // Quiet: the method disclosure stays unpainted and keeps its expanded state.
  const methods = control('connection-methods');
  expect(style(methods).backgroundColor).toBe('transparent');
  expect(style(methods).borderWidth).toBe(0);
  expect(style(methods).minHeight).toBeGreaterThanOrEqual(48);
  expect(methods.props.accessibilityState).toMatchObject({expanded: false});
  act(() => methods.props.onPress());
  expect(control('connection-methods').props.accessibilityState.expanded).toBe(
    true,
  );

  // Choices stay radios with a selected affordance, not solid buttons.
  const choice = control('connection-mode-individual');
  expect(choice.props.accessibilityRole).toBe('radio');
  expect(choice.props.accessibilityState.selected).toBe(true);
  const chosen = StyleSheet.flatten(choice.props.style({pressed: false}));
  expect(chosen.backgroundColor).toBe(colors.inset);
  expect(chosen.borderColor).toBe(colors.primary);
  expect(chosen.minHeight).toBeGreaterThanOrEqual(48);
  const other = StyleSheet.flatten(
    control('connection-mode-hub').props.style({pressed: false}),
  );
  expect(other.backgroundColor).toBe(colors.surface);
  expect(other.backgroundColor).not.toBe(
    surfaceColor(false, {tone: 'primary'}),
  );
  // A pressed row steps its background rather than dimming the label.
  const held = StyleSheet.flatten(
    control('connection-mode-hub').props.style({pressed: true}),
  );
  expect(held.backgroundColor).toBe(colors.inset);
  expect(held.opacity).toBeUndefined();
});

test('a connection in flight leaves the credential controls honest', () => {
  act(() => {
    view = render(
      <CredentialForm
        credentials={null}
        readonly={false}
        loading
        submit={jest.fn()}
      />,
    );
  });
  for (const id of ['connection-submit', 'connection-methods']) {
    expect(control(id).props.disabled).toBe(true);
    expect(control(id).props.accessibilityState.disabled).toBe(true);
  }
});
