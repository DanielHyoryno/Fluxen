import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import App from "../App";
import { useAuth } from "../src/context/AuthContext";
import { setLanguage } from "../src/services/i18n";

jest.mock("react-native-gesture-handler", () => ({}));
jest.mock("react-native-safe-area-context", () => ({
    SafeAreaProvider: ({ children }) => children,
    useSafeAreaInsets: () => ({ top: 24, bottom: 24, left: 0, right: 0 }),
}));
jest.mock("../src/context/AuthContext", () => ({ AuthProvider: ({ children }) => children, useAuth: jest.fn() }));
jest.mock("../src/components/AlertNotificationWatcher", () => () => null);
jest.mock("../src/components/TabIcon", () => () => null);
jest.mock("@react-navigation/native", () => ({ NavigationContainer: ({ children }) => children }));
jest.mock("@react-navigation/native-stack", () => ({
    createNativeStackNavigator: () => ({
        Navigator: ({ children }) => require("react").Children.toArray(children)[0],
        Screen: ({ component }) => require("react").createElement(component),
    }),
}));
jest.mock("@react-navigation/bottom-tabs", () => ({
    createBottomTabNavigator: () => ({
        Navigator: ({ children }) => require("react").Children.toArray(children)[0],
        Screen: ({ component }) => require("react").createElement(component),
    }),
}));
jest.mock("@react-navigation/elements", () => ({ PlatformPressable: () => null }));
jest.mock("../src/screens/Home/HomeScreen", () => () => require("react").createElement(require("react-native").Text, null, "Dashboard"));
jest.mock("../src/screens/Login/LoginScreen", () => () => require("react").createElement(require("react-native").Text, null, "Login screen"));
jest.mock("../src/screens/Register/RegisterScreen", () => () => null);
jest.mock("../src/screens/Devices/DevicesScreen", () => () => null);
jest.mock("../src/screens/DeviceDashboard/DeviceDashboardScreen", () => () => null);
jest.mock("../src/screens/DeviceEdit/DeviceEditScreen", () => () => null);
jest.mock("../src/screens/UsageHistory/UsageHistoryScreen", () => () => null);
jest.mock("../src/screens/UsageLimits/UsageLimitsScreen", () => () => null);
jest.mock("../src/screens/ManageCategory/ManageCategoryScreen", () => () => null);
jest.mock("../src/screens/BLEScan/BLEScanScreen", () => () => null);
jest.mock("../src/screens/Profile/ProfileScreen", () => () => null);
jest.mock("../src/screens/BillingEstimation/BillingEstimationScreen", () => () => null);
jest.mock("../src/screens/BillingSettings/BillingSettingsScreen", () => () => null);

beforeEach(() => {
    jest.useFakeTimers();
    setLanguage("en");
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
});

afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
});

test("an authenticated user can enter the dashboard during the first animation frame", async () => {
    useAuth.mockReturnValue({ isBooting: false, isAuthenticated: true });
    render(<App />);
    await act(async () => {});
    expect(screen.getByTestId("fluxen-logo-intro")).toBeTruthy();
    fireEvent.press(screen.getByTestId("start-gate"));
    expect(screen.getByText("Dashboard")).toBeTruthy();
    expect(screen.queryByTestId("start-gate")).toBeNull();
});

test("skipping the splash never bypasses login for an unauthenticated user", async () => {
    useAuth.mockReturnValue({ isBooting: false, isAuthenticated: false });
    render(<App />);
    await act(async () => {});
    fireEvent.press(screen.getByTestId("start-gate"));
    expect(screen.getByText("Login screen")).toBeTruthy();
    expect(screen.queryByText("Dashboard")).toBeNull();
});

test("session restoration is not bypassed when the splash is skipped", async () => {
    useAuth.mockReturnValue({ isBooting: true, isAuthenticated: false });
    render(<App />);
    await act(async () => {});
    fireEvent.press(screen.getByTestId("start-gate"));
    expect(screen.queryByText("Dashboard")).toBeNull();
    expect(screen.queryByText("Login screen")).toBeNull();
    expect(screen.queryByTestId("start-gate")).toBeNull();
});
