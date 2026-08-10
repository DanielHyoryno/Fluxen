jest.setTimeout(10000);

jest.mock("expo-clipboard", () => ({
    setStringAsync: jest.fn(async () => undefined),
}));
