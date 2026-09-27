const {NativeModules} = require('react-native');
global.IS_REACT_ACT_ENVIRONMENT = true;

// The chart imports WebView, whose TurboModule is absent in the JS runner.
NativeModules.RNCWebViewModule = {
  isFileUploadSupported: jest.fn(async () => false),
  shouldStartLoadWithLockIdentifier: jest.fn(),
};
NativeModules.RNMapsAirModule = {};

// Use upstream mocks for native layout, device metadata, and gestures (in config).
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native-device-info', () =>
  require('react-native-device-info/jest/react-native-device-info-mock'),
);

// A fresh install has no secure-storage entry. Never read the host's keychain.
jest.mock('react-native-keychain', () => ({
  getGenericPassword: jest.fn(async () => false),
  setGenericPassword: jest.fn(async () => true),
  resetGenericPassword: jest.fn(async () => true),
}));

// App-store checks are the only expected startup network operation.
jest.mock('react-native-version-check', () => ({
  needUpdate: jest.fn(async () => ({isNeeded: false})),
}));

// Fail closed if startup ever tries HTTP or MQTT outside the update-check stub.
// Assertions also catch attempts swallowed by application error handling.
for (const transport of ['fetch', 'XMLHttpRequest', 'WebSocket']) {
  global[transport] = jest.fn(() => {
    throw new Error(`Unexpected ${transport} call in an offline startup test`);
  });
}
