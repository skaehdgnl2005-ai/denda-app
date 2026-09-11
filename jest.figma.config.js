/**
 * Figma export 전용 Jest 설정 (npm test와 격리).
 * 기본 jest.config.js의 testMatch는 src/**·tests/**만 잡으므로 tools/는 안 걸린다.
 */
/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/tools/figma-export/**/*.spike.tsx', '**/tools/figma-export/**/*.dump.tsx'],
  testPathIgnorePatterns: ['/node_modules/', '/web-guest/', '/.claude/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  clearMocks: true,
};
