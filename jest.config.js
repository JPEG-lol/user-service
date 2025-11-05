module.exports = {
  testEnvironment: 'node',
  clearMocks: true,
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  
  // Use ts-jest for all TypeScript files
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },

  // Enable coverage collection
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'], // 'lcov' is for SonarQube

  // Configure reporters for SonarQube
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
  // forceExit has been removed. Tests must exit gracefully.
};