/** @type {import('jest').Config} */
module.exports = {
  displayName: 'mobile',
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  moduleNameMapper: {
    '^@finwiz/allowance-engine$': '<rootDir>/../../packages/allowance-engine/src/index.ts',
    '^@finwiz/obsidian-client$': '<rootDir>/../../packages/obsidian-client/src/index.ts',
    '^@finwiz/self-transfer-detector$':
      '<rootDir>/../../packages/self-transfer-detector/src/index.ts',
    '^@finwiz/notification-parser$':
      '<rootDir>/../../packages/notification-parser/src/index.ts',
    '^@finwiz/ai-agent$': '<rootDir>/../../packages/ai-agent/src/index.ts',
    '^@finwiz/notification-listener-android$':
      '<rootDir>/../../packages/notification-listener-android/src/index.ts',
    // Stub native modules that aren't available in the test environment.
    '^expo-modules-core$': '<rootDir>/__mocks__/expo-modules-core.ts',
    '^expo-secure-store$': '<rootDir>/__mocks__/expo-secure-store.ts',
  },
};
