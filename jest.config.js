module.exports = {
  preset: 'jest-expo',
  cacheDirectory: '<rootDir>/node_modules/.cache/jest',
  setupFiles: ['react-native-gesture-handler/jestSetup'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // These RN libraries (and uuid's browser entry) ship uncompiled ESM/Flow/TS.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native(?:-[^/]+)?|@react-native(?:-community|-masked-view)?|@react-navigation|@rneui|expo(?:-[^/]+)?|@expo(?:/[^/]+)?|uuid)/)',
  ],
  moduleNameMapper: {
    '\\.svg$': '<rootDir>/test-support/svgMock.js',
    '^react-native-permissions$':
      '<rootDir>/node_modules/react-native-permissions/mock.js',
  },
};
