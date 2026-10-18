import { act, render, waitFor } from "@testing-library/react-native";
import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import AlertNotificationWatcher from "../src/components/AlertNotificationWatcher";
import { useAuth } from "../src/context/AuthContext";
import { startPushSession, endPushSession, syncPushRegistration } from "../src/services/pushNotifications";
import { setLanguage } from "../src/services/i18n";

jest.mock("expo-notifications", () => ({
    setNotificationHandler: jest.fn(),
    addPushTokenListener: jest.fn(() => ({ remove: jest.fn() })),
}));
jest.mock("../src/context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../src/services/pushNotifications", () => ({
    startPushSession: jest.fn(), endPushSession: jest.fn(), syncPushRegistration: jest.fn(),
}));

beforeEach(() => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
    setLanguage("en");
    useAuth.mockReturnValue({ token: "user-token", isAuthenticated: true });
    syncPushRegistration.mockResolvedValue(undefined);
});
test("registers for server push instead of scheduling duplicate local alerts", async () => {
    const view = render(<AlertNotificationWatcher />);
    await waitFor(() => expect(syncPushRegistration).toHaveBeenCalledWith("user-token", "en", { requestPermission: true }));
    expect(startPushSession).toHaveBeenCalledWith("user-token");
    view.unmount();
    expect(endPushSession).toHaveBeenCalledWith("user-token");
});
test("rechecks permission and registration when returning from settings", async () => {
    let listener;
    jest.spyOn(AppState, "addEventListener").mockImplementation((_, callback) => {
        listener = callback;
        return { remove: jest.fn() };
    });
    const view = render(<AlertNotificationWatcher />);
    await act(async () => listener("active"));
    expect(syncPushRegistration).toHaveBeenCalledWith("user-token", "en", { requestPermission: false });
    view.unmount();
});
test("does not register a signed-out user", () => {
    useAuth.mockReturnValue({ token: null, isAuthenticated: false });
    const view = render(<AlertNotificationWatcher />);
    expect(syncPushRegistration).not.toHaveBeenCalled();
    view.unmount();
});
test("refreshes registration after native push token rotation", () => {
    const view = render(<AlertNotificationWatcher />);
    act(() => Notifications.addPushTokenListener.mock.calls[0][0]({ data: "native-new-token" }));
    expect(syncPushRegistration).toHaveBeenCalledTimes(2);
    view.unmount();
});
