jest.mock('expo-modules-core', () => ({
  requireNativeModule: jest.fn(),
}));

const {requireNativeModule} = require('expo-modules-core');
const originalWebSocket = global.WebSocket;
const {SecureWebSocket, secureWebSocket, hasTorch} = require('../src/platform');
const {Buffer} = require('buffer');
const fs = require('fs');
const path = require('path');

const subscribers = new Set();
const native = {
  addListener: jest.fn((name, callback) => {
    expect(name).toBe('socketEvent');
    subscribers.add(callback);
    return {remove: () => subscribers.delete(callback)};
  }),
  connect: jest.fn(),
  send: jest.fn(),
  close: jest.fn(),
  hasTorch: jest.fn(),
};
const url =
  'wss://synthetic.azure-devices.net/$iothub/websocket?iothub-no-client-cert=true';
const tick = () => Promise.resolve();
const emit = (id, type, fields = {}) => {
  [...subscribers].forEach(fn => fn({id, type, ...fields}));
};
const connect = async (protocols = ['mqtt']) => {
  const socket = new SecureWebSocket(url, protocols);
  await tick();
  return {socket, id: native.connect.mock.calls.at(-1)[0]};
};

beforeEach(() => {
  jest.clearAllMocks();
  subscribers.clear();
  requireNativeModule.mockReturnValue(native);
  native.connect.mockReset();
  native.close.mockReset();
  native.send.mockReset();
});

test('import is lazy and never replaces the global WebSocket', () => {
  expect(requireNativeModule).not.toHaveBeenCalled();
  expect(native.hasTorch).not.toHaveBeenCalled();
  expect(global.WebSocket).toBe(originalWebSocket);
  expect(secureWebSocket).toEqual({
    implementation: SecureWebSocket,
    rejectsRedirects: true,
  });
});

test.each([
  'ws://synthetic.azure-devices.net/',
  'wss://example.org/',
  'wss://synthetic.azure-devices.net.evil.org/',
  'wss://synthetic.azure-devices.net:444/',
  'wss://synthetic.azure-devices.net:0443/',
  'wss://user:password@synthetic.azure-devices.net/',
  'wss://synthetic.azure-devices.net/#fragment',
  'wss://synthetic.azure-devices.net./',
  'wss://a.b.azure-devices.net/',
  'wss://synthetic.azure-devices.de/',
  'wss://synthetic%2eazure-devices.net/',
  'wss://synthetic.azure-devices.net\\@evil.org/',
  'wss://synthetic.azure-devices.net/\n',
])('rejects unsafe endpoint %s before native access', value => {
  expect(() => new SecureWebSocket(value, ['mqtt'])).toThrow('Unsafe MQTT');
  expect(native.connect).not.toHaveBeenCalled();
});

test('canonicalizes the vendor default TLS port before the native boundary', async () => {
  const socket = new SecureWebSocket(
    'wss://synthetic.device.azure-devices.net:443/$iothub/websocket',
    'mqtt',
  );
  await tick();
  expect(socket.url).toBe(
    'wss://synthetic.device.azure-devices.net/$iothub/websocket',
  );
  expect(native.connect).toHaveBeenCalledWith(
    expect.any(String),
    socket.url,
    ['mqtt'],
  );
  emit(native.connect.mock.calls[0][0], 'close');
  expect(subscribers.size).toBe(0);
});

test.each(['net', 'cn', 'us'])(
  'accepts matching hub and device hosts in %s',
  async suffix => {
    for (const prefix of ['synthetic', 'synthetic.device']) {
      const socket = new SecureWebSocket(
        `wss://${prefix}.azure-devices.${suffix}/`,
        'mqtt',
      );
      socket.close();
    }
    await tick();
    expect(native.connect).not.toHaveBeenCalled();
  },
);

test.each([
  undefined,
  [],
  ['mqtt', 'mqtt'],
  ['http'],
  ['mqtt\r\nAuthorization: secret'],
])('requires unique MQTT protocols: %j', protocols => {
  expect(() => new SecureWebSocket(url, protocols)).toThrow('MQTT subprotocol');
  expect(native.connect).not.toHaveBeenCalled();
});

test('binary bridge preserves typed-array offsets and arraybuffer receive data', async () => {
  const {socket, id} = await connect(['mqtt', 'mqttv3.1']);
  expect(socket.readyState).toBe(SecureWebSocket.CONNECTING);
  expect(socket.url).toBe(url);
  expect(() => socket.send(new Uint8Array([1]))).toThrow('not open');
  const opened = jest.fn();
  const message = jest.fn();
  socket.onopen = opened;
  socket.onmessage = message;
  emit(id, 'open', {protocol: 'mqtt'});
  expect(socket.readyState).toBe(socket.OPEN);
  expect(socket.protocol).toBe('mqtt');
  expect(opened).toHaveBeenCalledTimes(1);
  const data = new Uint8Array([255, 0, 127, 128, 254]);
  socket.send(data.subarray(1, 4));
  expect(native.send).toHaveBeenLastCalledWith(
    id,
    Buffer.from([0, 127, 128]).toString('base64'),
  );
  socket.send(data.buffer);
  expect(native.send).toHaveBeenLastCalledWith(
    id,
    Buffer.from(data).toString('base64'),
  );
  emit(id, 'message', {data: Buffer.from(data).toString('base64')});
  expect(message.mock.calls[0][0].data).toBeInstanceOf(ArrayBuffer);
  expect([...new Uint8Array(message.mock.calls[0][0].data)]).toEqual([...data]);
  expect(socket.binaryType).toBe('arraybuffer');
  socket.binaryType = 'arraybuffer';
  expect(() => {
    socket.binaryType = 'blob';
  }).toThrow();
  socket.close();
  expect(native.close).toHaveBeenLastCalledWith(id, 1000, '');
  emit(id, 'close', {code: 1000, wasClean: true});
  expect(socket.readyState).toBe(socket.CLOSED);
  expect(subscribers.size).toBe(0);
});

test('instance isolation, deduplicated listeners and removal', async () => {
  const first = await connect();
  const second = await connect();
  expect(first.id).not.toBe(second.id);
  const listener = jest.fn();
  first.socket.addEventListener('open', listener);
  first.socket.addEventListener('open', listener);
  emit(second.id, 'open', {protocol: 'mqtt'});
  expect(listener).not.toHaveBeenCalled();
  emit(first.id, 'open', {protocol: 'mqtt'});
  expect(listener).toHaveBeenCalledTimes(1);
  first.socket.addEventListener('close', listener);
  first.socket.removeEventListener('close', listener);
  emit(first.id, 'close');
  emit(second.id, 'close');
  expect(listener).toHaveBeenCalledTimes(1);
  expect(subscribers.size).toBe(0);
});

test.each([undefined, 'http', 'mqttv3.1'])(
  'refuses missing or unrequested negotiated protocol %s',
  async protocol => {
    const {socket, id} = await connect();
    const events = [];
    socket.onerror = event => events.push(event.type);
    socket.onclose = event => events.push(event.type);
    emit(id, 'open', {protocol});
    expect(events).toEqual(['error', 'close']);
    expect(native.close).toHaveBeenCalledWith(id, 1000, '');
    expect(socket.readyState).toBe(socket.CLOSED);
    expect(subscribers.size).toBe(0);
  },
);

test('closing before deferred connection avoids opening a native socket', async () => {
  const socket = new SecureWebSocket(url, 'mqtt');
  const closed = jest.fn();
  socket.onclose = closed;
  socket.close();
  expect(socket.readyState).toBe(socket.CLOSING);
  await tick();
  expect(native.connect).not.toHaveBeenCalled();
  expect(closed).toHaveBeenCalledTimes(1);
});

test('closing a connecting native socket and duplicate terminal events clean up once', async () => {
  const {socket, id} = await connect();
  const closed = jest.fn();
  socket.onclose = closed;
  socket.close();
  socket.close();
  expect(native.close).toHaveBeenCalledTimes(1);
  emit(id, 'open', {protocol: 'mqtt'});
  expect(socket.readyState).toBe(socket.CLOSING);
  emit(id, 'close');
  emit(id, 'error');
  emit(id, 'close');
  expect(closed).toHaveBeenCalledTimes(1);
  expect(subscribers.size).toBe(0);
});

test('native setup and transport errors are redacted and terminal', async () => {
  native.connect.mockImplementationOnce(() => {
    throw new Error('private token and query');
  });
  const socket = new SecureWebSocket(url, 'mqtt');
  const error = jest.fn();
  const closed = jest.fn();
  socket.onerror = error;
  socket.onclose = closed;
  await tick();
  expect(error.mock.calls[0][0].message).toBe('Secure MQTT connection failed');
  expect(closed).toHaveBeenCalledTimes(1);
  expect(subscribers.size).toBe(0);
  const second = await connect();
  second.socket.onerror = error;
  emit(second.id, 'error', {message: 'private token'});
  expect(error).toHaveBeenCalledTimes(2);
  expect(second.socket.readyState).toBe(second.socket.CLOSED);
});

test('validates close codes and UTF-8 reason length', async () => {
  const {socket, id} = await connect();
  expect(() => socket.close(1006)).toThrow();
  expect(() => socket.close(3000, 'é'.repeat(62))).toThrow();
  socket.close(3000, 'done');
  expect(native.close).toHaveBeenCalledWith(id, 3000, 'done');
  emit(id, 'close');
});

test('torch queries are lazy and fail closed', async () => {
  native.hasTorch
    .mockResolvedValueOnce(true)
    .mockRejectedValueOnce(new Error('Unavailable'));
  expect(await hasTorch()).toBe(true);
  await expect(hasTorch()).rejects.toThrow('Unavailable');
});

test('native sources enforce redirects and default TLS independently of JS', () => {
  const root = path.join(__dirname, '../modules/paad-device');
  const kotlin = fs.readFileSync(
    path.join(
      root,
      'android/src/main/java/expo/modules/paaddevice/PaadDeviceModule.kt',
    ),
    'utf8',
  );
  const swift = fs.readFileSync(
    path.join(root, 'ios/PaadDeviceModule.swift'),
    'utf8',
  );
  expect(kotlin).toContain('.followRedirects(false)');
  expect(kotlin).toContain('.followSslRedirects(false)');
  expect(kotlin).not.toMatch(
    /\.(sslSocketFactory|hostnameVerifier|addInterceptor)\(/,
  );
  expect(swift).toContain('willPerformHTTPRedirection');
  expect(swift).toContain('completionHandler(nil)');
  expect(swift).not.toContain('didReceive challenge');
  expect(kotlin).toContain('OnDestroy');
  expect(swift).toContain('OnDestroy');
});
