module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  moduleNameMapper: {
    // Strip .js extensions from relative imports so Jest resolves .ts files.
    // Required because TypeScript with NodeNext module resolution mandates .js
    // extensions in import paths, but ts-jest needs to find the .ts source files.
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
