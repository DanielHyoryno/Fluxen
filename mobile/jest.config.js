module.exports = {
    preset: "jest-expo",
    setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
    testMatch: ["<rootDir>/tests/**/*.test.js"],
    clearMocks: true,
    restoreMocks: true,
    transformIgnorePatterns: [
        "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|react-native-svg)",
    ],
    collectCoverageFrom: [
        "src/**/*.{js,jsx}",
        "!src/**/styles.js",
        "!src/constants/messages/**",
    ],
};
