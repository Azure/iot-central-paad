jest.mock('expo/fetch', () => ({fetch: jest.fn()}));
jest.mock('react-native-get-random-values', () => ({}));
jest.mock(
  'react-native-azure-iotcentral-client/node_modules/react-native-paho-mqtt',
  () => ({Client: class {}, Message: class {}}),
);
const {upload} = require('../src/connection/upload');
const identity = {
  assignedHub: 'synthetic.azure-devices.net',
  deviceId: 'actual-id',
};
const metadata = {
  hostName: 'synthetic.blob.core.windows.net',
  containerName: 'files',
  blobName: 'actual-id/photo name.jpg',
  correlationId: 'synthetic-correlation',
  sasToken: '?sv=synthetic&sig=synthetic',
};
const response = (status, body) => ({
  status,
  headers: {get: () => null},
  json: async () => body,
});
test('uploads exact decoded bytes only to approved storage and checks notification ACK', async () => {
  const http = jest
    .fn()
    .mockResolvedValueOnce(response(200, metadata))
    .mockResolvedValueOnce(response(201))
    .mockResolvedValueOnce(response(204));
  const result = await upload(
    identity,
    'synthetic-hub-token',
    http,
    new AbortController().signal,
    'photo.jpg',
    'image/jpeg',
    Buffer.from([1, 2, 3]).toString('base64'),
    'base64',
  );
  expect(result).toEqual({status: 201, delivery: 'acknowledged'});
  expect(http.mock.calls[0][0]).toBe(
    'https://synthetic.azure-devices.net/devices/actual-id/files?api-version=2021-04-12',
  );
  expect(http.mock.calls[1][0]).toBe(
    'https://synthetic.blob.core.windows.net/files/actual-id/photo%20name.jpg?sv=synthetic&sig=synthetic',
  );
  expect(Array.from(http.mock.calls[1][1].body)).toEqual([1, 2, 3]);
  expect(http.mock.calls[1][1].headers.Authorization).toBeUndefined();
  expect(http.mock.calls.every(call => call[1].redirect === 'error')).toBe(
    true,
  );
  expect(JSON.parse(http.mock.calls[2][1].body).isSuccess).toBe(true);
  expect(http.mock.calls[2][0]).toBe(
    'https://synthetic.azure-devices.net/devices/actual-id/files/notifications?api-version=2021-04-12',
  );
});
test('rejects storage redirection to an arbitrary server before sending SAS/content', async () => {
  const http = jest.fn(async () =>
    response(200, {...metadata, hostName: 'evil.example'}),
  );
  await expect(
    upload(
      identity,
      'token',
      http,
      new AbortController().signal,
      'photo.jpg',
      'image/jpeg',
      new Uint8Array([1]),
    ),
  ).rejects.toMatchObject({code: 'UNSAFE_ENDPOINT'});
  expect(http).toHaveBeenCalledTimes(1);
});
test('notification failure is not disguised as successful upload', async () => {
  const http = jest
    .fn()
    .mockResolvedValueOnce(response(200, metadata))
    .mockResolvedValueOnce(response(201))
    .mockResolvedValueOnce(response(403, {message: 'synthetic-secret'}));
  const error = await upload(
    identity,
    'token',
    http,
    new AbortController().signal,
    'photo.jpg',
    'image/jpeg',
    new Uint8Array([1]),
  ).catch(e => e);
  expect(error).toMatchObject({code: 'OPERATION_FAILED', status: 403});
  expect(String(error)).not.toContain('synthetic-secret');
});
