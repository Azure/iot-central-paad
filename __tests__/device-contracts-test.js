import {createHmac} from 'crypto';
import {Platform} from 'react-native';
import {
  computeKey,
  DecryptCredentials,
  parseConnectionString,
} from 'react-native-azure-iotcentral-client';
import {defaults} from '../src/contexts/defaults';
import Accelerometer from '../src/sensors/accelerometer';
import {AVAILABLE_SENSORS} from '../src/sensors/internal';
import {
  ENABLE_DISABLE_COMMAND,
  LIGHT_TOGGLE_COMMAND,
  PROPERTY,
  SET_FREQUENCY_COMMAND,
  TELEMETRY,
} from '../src/types';

// Synthetic bytes, never an enrollment/device credential.
const fixtureKey = Buffer.alloc(32, 17).toString('base64');

afterEach(() => jest.restoreAllMocks());

describe('PAAD compatibility contracts', () => {
  it('retains the model, components, commands and production application IDs', () => {
    expect(defaults.modelId).toBe('dtmi:azureiot:PhoneAsADevice;2');
    expect(defaults.packageNameIOS).toBe('com.microsoft.iotpnp');
    expect(defaults.packageNameAndroid).toBe('com.iot_pnp');
    expect([TELEMETRY, PROPERTY]).toEqual(['sensors', 'device_info']);
    expect([
      ENABLE_DISABLE_COMMAND,
      SET_FREQUENCY_COMMAND,
      LIGHT_TOGGLE_COMMAND,
    ]).toEqual(['sensors*enableSensors', 'sensors*changeInterval', 'lightOn']);
    expect(Object.values(AVAILABLE_SENSORS).sort()).toEqual([
      'accelerometer',
      'barometer',
      'battery',
      'geolocation',
      'gyroscope',
      'magnetometer',
    ]);
  });

  it('derives a device key with HMAC-SHA256 over the exact registration ID', () => {
    const registrationId = 'paad-fixture-Device';
    const expected = createHmac('sha256', Buffer.from(fixtureKey, 'base64'))
      .update(registrationId)
      .digest('base64');
    expect(computeKey(fixtureKey, registrationId)).toBe(expected);
    expect(computeKey(fixtureKey, registrationId.toLowerCase())).not.toBe(
      expected,
    );
  });

  it('preserves the existing base64-JSON QR fields and phone model', () => {
    const credentials = {
      deviceId: 'paad-fixture',
      scopeId: 'fixture-scope',
      deviceKey: fixtureKey,
      modelId: defaults.modelId,
    };
    const qr = Buffer.from(JSON.stringify(credentials)).toString('base64');
    expect(DecryptCredentials(qr)).toEqual(credentials);
  });

  it('rejects QR content that cannot be decoded as JSON', () => {
    expect(() => DecryptCredentials('not-a-credential-document')).toThrow();
  });

  it('preserves direct Hub identity and signs the device resource URI', () => {
    const now = 1750000000000;
    jest.spyOn(Date, 'now').mockReturnValue(now);
    const host = 'fixture.azure-devices.net';
    const deviceId = 'paad-fixture';
    const expiry = Math.floor(now / 1000) + 21600;
    const resource = encodeURIComponent(`${host}/devices/${deviceId}`);
    const signature = createHmac('sha256', Buffer.from(fixtureKey, 'base64'))
      .update(`${resource}\n${expiry}`)
      .digest('base64');
    expect(
      parseConnectionString(
        `HostName=${host};DeviceId=${deviceId};SharedAccessKey=${fixtureKey}`,
      ),
    ).toEqual({
      host,
      deviceId,
      password: `SharedAccessSignature sr=${resource}&sig=${encodeURIComponent(
        signature,
      )}&se=${expiry}`,
    });
  });

  it.each([
    ['ios', {x: 9.81, y: -4.905, z: 0}],
    ['android', {x: 9.81, y: -4.905, z: 0}],
  ])('normalizes %s acceleration to m/s2', (platform, expected) => {
    jest.replaceProperty(Platform, 'OS', platform);
    const sensor = new Accelerometer('accelerometer', 5000);
    expect(sensor.getNormalizedData(1, -0.5, 0)).toEqual(expected);
  });
});
