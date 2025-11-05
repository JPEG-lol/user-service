module.exports = {
  testEnvironment: 'node',
  clearMocks: true,
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.jsx?$': 'babel-jest',
  },

  transformIgnorePatterns: [
    '/node_modules/(?!(express-request-id|uuid))',
  ],

  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],

  reporters: [
    'default',
    ['jest-sonar', {
      outputDirectory: '.',
      outputName: 'test-report.xml',
      relativeRootDir: './'
    }],
  ],

  testTimeout: 30000,
  verbose: true,

  globalSetup: './jest.global-setup.js',
};