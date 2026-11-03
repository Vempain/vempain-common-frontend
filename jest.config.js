const config = {
    preset: 'ts-jest',
    testEnvironment: 'jest-environment-jsdom',
    testMatch: ['<rootDir>/src/**/__tests__/**/*.test.[jt]s?(x)'],
    testPathIgnorePatterns: ['/node_modules/', '/dist/'],
    setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
    moduleNameMapper: {
        // @ant-design/icons (CommonJS build) requires the ESM build of @ant-design/colors; point it at the CommonJS one
        '^@ant-design/colors/es/generate$': '<rootDir>/node_modules/@ant-design/colors/lib/generate',
        // react-leaflet ships an ESM-only build; the map tests run against the stand-in of src/testUtils/reactLeafletMock.tsx
        '^react-leaflet$': '<rootDir>/src/testUtils/reactLeafletMock.tsx'
    },
    transform: {
        '^.+\\.[jt]sx?$': ['ts-jest', {
            tsconfig: '<rootDir>/tsconfig.jest.json'
        }]
    }
};

export default config;
