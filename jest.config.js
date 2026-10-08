const config = {
    preset: 'ts-jest',
    testEnvironment: 'jest-environment-jsdom',
    testMatch: ['<rootDir>/src/**/__tests__/**/*.test.[jt]s?(x)'],
    testPathIgnorePatterns: ['/node_modules/', '/dist/'],
    setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
    moduleNameMapper: {
        // @ant-design/icons (CommonJS build) requires the ESM build of @ant-design/colors; point it at the CommonJS one
        '^@ant-design/colors/es/generate$': '<rootDir>/node_modules/@ant-design/colors/lib/generate'
    },
    transform: {
        '^.+\\.[jt]sx?$': ['ts-jest', {
            tsconfig: '<rootDir>/tsconfig.jest.json'
        }]
    }
};

export default config;
