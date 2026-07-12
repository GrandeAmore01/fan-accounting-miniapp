module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  clearMocks: true,
  verbose: true,
  setupFilesAfterEnv: ['<rootDir>/__tests__/setupWx.js']};

