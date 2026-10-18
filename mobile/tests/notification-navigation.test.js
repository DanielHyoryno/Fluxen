import { act, render, waitFor } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";
import { listDevicesApi } from "../src/services/api";
import NotificationNavigation from "../src/components/NotificationNavigation";

jest.mock("expo-notifications", () => ({ getLastNotificationResponseAsync: jest.fn(), addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })) }));
jest.mock("../src/services/api", () => ({ listDevicesApi: jest.fn() }));
const response = { notification: { request: { identifier: "notice-1", content: { data: { deviceCode: "DEVICE-1" } } } } };
beforeEach(() => Notifications.getLastNotificationResponseAsync.mockResolvedValue(response));

test("opens only an owned device from a cold-start notification", async () => {
    const device = { id: 1, device_code: "DEVICE-1" };
    listDevicesApi.mockResolvedValue({ items: [device] });
    const navigationRef = { current: { isReady: () => true, navigate: jest.fn() } };
    const view = render(<NotificationNavigation token="auth" ready navigationRef={navigationRef} />);
    await waitFor(() => expect(navigationRef.current.navigate).toHaveBeenCalledWith("DeviceDashboard", { device }));
    await act(async () => Notifications.addNotificationResponseReceivedListener.mock.calls[0][0](response));
    expect(navigationRef.current.navigate).toHaveBeenCalledTimes(1);
    view.unmount();
});
test("ignores a notification for another account's device", async () => {
    listDevicesApi.mockResolvedValue({ items: [] });
    const navigationRef = { current: { isReady: () => true, navigate: jest.fn() } };
    const view = render(<NotificationNavigation token="other-auth" ready navigationRef={navigationRef} />);
    await waitFor(() => expect(listDevicesApi).toHaveBeenCalled());
    expect(navigationRef.current.navigate).not.toHaveBeenCalled();
    view.unmount();
});
test("waits for login and navigation readiness", async () => {
    const view = render(<NotificationNavigation token={null} ready={false} navigationRef={{ current: null }} />);
    await act(async () => {});
    expect(listDevicesApi).not.toHaveBeenCalled();
    view.unmount();
});
