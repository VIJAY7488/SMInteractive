/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Load env vars before each test suite
  setupFiles: ['<rootDir>/src/__tests__/setup.ts'],

  // Where Jest looks for tests
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],

  // Path aliases (none currently, but ready for future use)
  moduleNameMapper: {},

  // Collect coverage from src (excluding tests themselves)
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/__tests__/**',
    '!src/server.ts',       // Entry point — not unit-testable
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],

  // Show each test name in output
  verbose: true,

  // Increase timeout for async DB operations in integration tests
  testTimeout: 15000,

  // ts-jest options
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        // Relax strict for test files so mocks are easier to write
        strict: false,
      },
    }],
  },
};
