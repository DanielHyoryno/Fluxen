import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { registerPushTokenApi, unregisterPushTokenApi } from "../src/services/api";
import { getPushToken, savePushToken, clearPushToken } from "../src/services/storage";
import { startPushSession, endPushSession, syncPushRegistration, unregisterCurrentPush } from "../src/services/pushNotifications";

jest.mock("expo-constants", () => ({ expoConfig: { extra: { eas: { projectId: "test-project" } } } }));
jest.mock("expo-notifications", () => ({
    AndroidImportance: { HIGH: 4 }, setNotificationChannelAsync: jest.fn(), getPermissionsAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(), getExpoPushTokenAsync: jest.fn(),
}));
jest.mock("../src/services/api", () => ({ registerPushTokenApi: jest.fn(), unregisterPushTokenApi: jest.fn() }));
jest.mock("../src/services/storage", () => ({ getPushToken: jest.fn(), savePushToken: jest.fn(), clearPushToken: jest.fn() }));
let saved;
beforeEach(() => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
    saved = null;
    getPushToken.mockImplementation(async () => saved);
    savePushToken.mockImplementation(async token => { saved = token; });
    clearPushToken.mockImplementation(async () => { saved = null; });
    registerPushTokenApi.mockResolvedValue({ registered: true });
    unregisterPushTokenApi.mockResolvedValue({ registered: false });
    Notifications.getPermissionsAsync.mockResolvedValue({ granted: true });
    Notifications.getExpoPushTokenAsync.mockResolvedValue({ data: "ExpoPushToken[phone12345678]" });
    startPushSession("auth-a");
});
afterEach(() => endPushSession("auth-a"));

test("registers the phone and locale with an authenticated backend request", async () => {
    await syncPushRegistration("auth-a", "id");
    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: "test-project" });
    expect(registerPushTokenApi).toHaveBeenCalledWith("auth-a", "ExpoPushToken[phone12345678]", "id");
});
test("denied permission does not request an Expo token", async () => {
    Notifications.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });
    await syncPushRegistration("auth-a", "en", { requestPermission: true });
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(registerPushTokenApi).not.toHaveBeenCalled();
});
test("permission revoked in settings detaches the old subscription", async () => {
    saved = "old-token";
    Notifications.getPermissionsAsync.mockResolvedValue({ granted: false });
    await syncPushRegistration("auth-a", "en");
    expect(unregisterPushTokenApi).toHaveBeenCalledWith("auth-a", "old-token");
    expect(saved).toBeNull();
});
test("an operation cancelled before starting cannot register after logout", async () => {
    const registration = syncPushRegistration("auth-a", "en");
    await unregisterCurrentPush("auth-a");
    await registration;
    expect(registerPushTokenApi).not.toHaveBeenCalled();
});
test("logout waits for an in-flight registration, then removes it", async () => {
    let release;
    registerPushTokenApi.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const registration = syncPushRegistration("auth-a", "en");
    for (let i = 0; i < 15 && !release; i++) await Promise.resolve();
    expect(release).toBeDefined();
    const logout = unregisterCurrentPush("auth-a");
    release({ registered: true });
    await Promise.all([registration, logout]);
    expect(unregisterPushTokenApi).toHaveBeenCalledWith("auth-a", "ExpoPushToken[phone12345678]");
    expect(saved).toBeNull();
});
test("logout failure retains the token for a retry instead of silently abandoning it", async () => {
    saved = "old-token";
    unregisterPushTokenApi.mockRejectedValueOnce(new Error("offline"));
    await expect(unregisterCurrentPush("auth-a")).rejects.toThrow("offline");
    expect(saved).toBe("old-token");
    await unregisterCurrentPush("auth-a");
    expect(saved).toBeNull();
});
test("older backends without push routes do not lock users into the app", async () => {
    saved = "unregistered-token";
    unregisterPushTokenApi.mockRejectedValueOnce(Object.assign(new Error("not found"), { status: 404 }));
    await unregisterCurrentPush("auth-a");
    expect(saved).toBeNull();
});
