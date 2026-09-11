/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  testMatch: [
    '**/src/**/*.test.{ts,tsx}',
    '**/tests/**/*.test.{ts,tsx}',
    // figma-export 도구의 순수 로직 — 앱과 무관하지만 CI 그린 대상에는 포함.
    '**/tools/figma-export/**/*.test.{ts,tsx}',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/web-guest/', '/.claude/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}', '!src/**/*.d.ts'],
  clearMocks: true,
};
