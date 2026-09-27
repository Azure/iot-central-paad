jest.mock('react-native-get-random-values', () => ({}));
jest.mock(
  'react-native-azure-iotcentral-client/node_modules/react-native-paho-mqtt',
  () => ({Client: class {}, Message: class {}}),
);

const {createHash, createCipheriv, createHmac} = require('crypto');
const {
  decodeCredentials,
  validateCredentials,
  validateHost,
  computeKey,
} = require('../src/connection/credentials');
const {PHONE_MODEL_ID} = require('../src/connection/types');
const key = Buffer.alloc(32, 7).toString('base64');
const fixture = {
  deviceId: 'synthetic-phone',
  scopeId: '0ne12345',
  deviceKey: key,
};
const direct = `HostName=synthetic.azure-devices.net;DeviceId=phone;SharedAccessKey=${key}`;
const qr = data => Buffer.from(JSON.stringify(data)).toString('base64');

// Synthetic OpenSSL/CryptoJS-compatible fixture; no undeclared crypto-js import.
function encryptedQr(data, password) {
  const salt = Buffer.from('12345678');
  let material = Buffer.alloc(0);
  let previous = Buffer.alloc(0);
  while (material.length < 48) {
    previous = createHash('md5')
      .update(Buffer.concat([previous, Buffer.from(password), salt]))
      .digest();
    material = Buffer.concat([material, previous]);
  }
  const cipher = createCipheriv(
    'aes-256-cbc',
    material.subarray(0, 32),
    material.subarray(32, 48),
  );
  return Buffer.concat([
    Buffer.from('Salted__'),
    salt,
    cipher.update(qr(data), 'utf8'),
    cipher.final(),
  ]).toString('base64');
}

test('classic base64 JSON and direct connection string QR preserve phone model', () => {
  expect(decodeCredentials(qr(fixture))).toMatchObject({
    ...fixture,
    modelId: PHONE_MODEL_ID,
  });
  expect(decodeCredentials(qr({connectionString: direct}))).toMatchObject({
    connectionString: direct,
    deviceId: 'phone',
    modelId: PHONE_MODEL_ID,
  });
  expect(decodeCredentials(direct).connectionString).toBe(direct);
  expect(decodeCredentials(JSON.stringify(fixture)).deviceId).toBe(
    'synthetic-phone',
  );
});

test('encrypted legacy QR works and wrong password is safely rejected', () => {
  const encrypted = encryptedQr(fixture, 'synthetic-passphrase');
  expect(decodeCredentials(encrypted, 'synthetic-passphrase').deviceKey).toBe(
    key,
  );
  expect(() => decodeCredentials(encrypted, 'wrong')).toThrow(
    'Device credentials are invalid',
  );
  expect(decodeCredentials(qr(fixture), 'unused-passphrase').deviceKey).toBe(
    key,
  );
});

test.each(['plain', 'base64', 'encrypted'])(
  'versioned individual and Hub QR decode through the original %s decoder',
  encoding => {
    const encode = data =>
      encoding === 'plain'
        ? JSON.stringify(data)
        : encoding === 'base64'
        ? qr(data)
        : encryptedQr(data, 'test-passphrase');
    const envelope = {
      schema: 'paad.connection',
      version: 1,
      mode: 'dps',
      credentials: {
        registrationId: 'synthetic-phone',
        scopeId: fixture.scopeId,
        deviceKey: key,
        provisioningHost: 'global-canary.azure-devices-provisioning.net',
      },
    };
    expect(
      decodeCredentials(encode(envelope), 'test-passphrase'),
    ).toMatchObject({
      ...envelope.credentials,
      keyType: 'device',
      modelId: PHONE_MODEL_ID,
    });
    expect(
      decodeCredentials(
        encode({
          schema: 'paad.connection',
          version: 1,
          mode: 'hub',
          credentials: {connectionString: direct},
        }),
        'test-passphrase',
      ),
    ).toMatchObject({deviceId: 'phone', modelId: PHONE_MODEL_ID});
  },
);

test.each([
  {schema: 'other'},
  {version: 2},
  {version: '1'},
  {mode: 'group'},
  {mode: 'certificate'},
  {adminToken: 'secret'},
  {credentials: {...fixture, keyType: 'group', authKey: key}},
  {
    credentials: {
      registrationId: 'phone',
      scopeId: '0ne123',
      certificate: 'secret',
    },
  },
  {
    credentials: {
      registrationId: 'phone',
      scopeId: '0ne123',
      deviceKey: key,
      modelId: PHONE_MODEL_ID,
    },
  },
])('rejects unsupported versioned QR contract %#', invalid => {
  const input = JSON.stringify({
    schema: 'paad.connection',
    version: 1,
    mode: 'dps',
    credentials: {registrationId: 'phone', scopeId: '0ne123', deviceKey: key},
    ...invalid,
  });
  expect(() => decodeCredentials(input)).toThrow();
});

test('legacy group QR remains compatible without allowing new QR group delivery', () => {
  expect(
    decodeCredentials(
      qr({
        deviceId: 'synthetic-phone',
        scopeId: fixture.scopeId,
        authKey: key,
        keyType: 'group',
      }),
    ),
  ).toMatchObject({keyType: 'group', modelId: PHONE_MODEL_ID});
});

test('computeKey matches HMAC and legacy prederived group credentials are not derived twice', () => {
  const derived = createHmac('sha256', Buffer.from(key, 'base64'))
    .update(fixture.deviceId)
    .digest('base64');
  expect(computeKey(key, fixture.deviceId)).toBe(derived);
  expect(
    validateCredentials({
      ...fixture,
      authKey: key,
      keyType: 'group',
      deviceKey: derived,
    }).deviceKey,
  ).toBe(derived);
  expect(
    validateCredentials({
      deviceId: fixture.deviceId,
      scopeId: fixture.scopeId,
      authKey: key,
      keyType: 'group',
    }).deviceKey,
  ).toBe(derived);
});

test.each([
  null,
  [],
  12,
  {},
  {certificate: 'x509'},
  {...fixture, keyType: 'x509'},
  {...fixture, deviceKey: 'not-base64'},
  {...fixture, unexpected: true},
  {...fixture, deviceId: 'path/escape'},
  {...fixture, provisioningHost: 'evil.example'},
  {...fixture, modelId: 'dtmi:phone;1&credential=secret'},
  {connectionString: `${direct};GatewayHostName=evil.example`},
  {connectionString: `${direct};HostName=other.azure-devices.net`},
  {connectionString: direct, scopeId: '0ne12345'},
  {...fixture, authKey: Buffer.alloc(32, 8).toString('base64')},
])('strictly rejects unsupported or malformed credentials %#', value => {
  expect(() => decodeCredentials(value)).toThrow();
});

test('accessors are not invoked during validation', () => {
  const getter = jest.fn(() => key);
  const value = {...fixture};
  Object.defineProperty(value, 'deviceKey', {get: getter});
  expect(() => validateCredentials(value)).toThrow();
  expect(getter).not.toHaveBeenCalled();
});

test.each([
  ['global-canary.azure-devices-provisioning.net', 'dps'],
  ['global.azure-devices-provisioning.net', 'dps'],
  ['assigned.device.azure-devices.net', 'hub'],
  ['assigned.azure-devices.net', 'hub'],
])('accepts genuine Azure endpoint %s', (host, kind) => {
  expect(validateHost(host, kind)).toBe(host);
});

test.each([
  'evilazure-devices.net',
  'hub.azure-devices.net.evil.example',
  'https://hub.azure-devices.net',
  'hub.azure-devices.net:443',
  'hub.azure-devices.net@evil.example',
  'hub.azure-devices.net.',
  'hub.azure-devices.net/path',
  '127.0.0.1',
  'evil.example',
  'hub.azure-devices.net\n',
  'a.b.azure-devices.net',
])('rejects unsafe endpoint %s', host => {
  expect(() => validateHost(host, 'hub')).toThrow();
});
