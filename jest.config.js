/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/client/src/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@server/(.*)$': '<rootDir>/server/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        jsx: 'react-jsx',
      },
    }],
  },
  testMatch: [
    '<rootDir>/client/src/**/__tests__/**/*.(ts|tsx)',
    '<rootDir>/client/src/**/?(*.)(test|spec).(ts|tsx)',
    '<rootDir>/server/**/__tests__/**/*.(ts|tsx)',
    '<rootDir>/server/**/?(*.)(test|spec).(ts|tsx)',
    '<rootDir>/shared/**/__tests__/**/*.(ts|tsx)',
    '<rootDir>/shared/**/?(*.)(test|spec).(ts|tsx)',
  ],
  collectCoverageFrom: [
    'client/src/**/*.{ts,tsx}',
    'server/**/*.{ts,tsx}',
    'shared/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/*.config.*',
    '!client/src/main.tsx',
    '!client/src/vite-env.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  testTimeout: 10000,
  maxWorkers: '50%',
  globals: {
    'ts-jest': {
      useESM: true,
    },
  },
};