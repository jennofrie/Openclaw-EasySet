export default {
  testEnvironment: 'node',
  transform: {},
  // extensionsToTreatAsEsm not needed - package.json "type": "module" handles this
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  testTimeout: 15000,
};
