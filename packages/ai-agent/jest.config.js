/** @type {import('jest').Config} */
module.exports = {
  displayName: 'ai-agent',
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  // Map workspace packages to TypeScript source to avoid requiring a prior build.
  moduleNameMapper: {
    '^@finwiz/allowance-engine$':
      '<rootDir>/../allowance-engine/src/index.ts',
    '^@finwiz/obsidian-client$':
      '<rootDir>/../obsidian-client/src/index.ts',
    '^@finwiz/self-transfer-detector$':
      '<rootDir>/../self-transfer-detector/src/index.ts',
    '^@finwiz/notification-parser$':
      '<rootDir>/../notification-parser/src/index.ts',
  },
};
