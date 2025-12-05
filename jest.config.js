module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  modulePathIgnorePatterns: ['<rootDir>/.firebase', '<rootDir>/src/package.json'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.jest.json',
    }],
  },
  haste: {
    computeSha1: true,
    throwOnModuleCollision: false,
  },
};
