import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";
import { AuthProvider, useAuth } from "../src/context/AuthContext";
import { getAccessToken, getAppLocale, clearAccessToken } from "../src/services/storage";
import { meApi } from "../src/services/api";
import { unregisterCurrentPush } from "../src/services/pushNotifications";

jest.mock("../src/services/storage", () => ({ getAccessToken: jest.fn(), getAppLocale: jest.fn(), clearAccessToken: jest.fn(), saveAccessToken: jest.fn(), saveAppLocale: jest.fn() }));
jest.mock("../src/services/api", () => ({ meApi: jest.fn(), loginApi: jest.fn(), registerApi: jest.fn() }));
jest.mock("../src/services/pushNotifications", () => ({ unregisterCurrentPush: jest.fn() }));
let current;
function Harness() {
    current = useAuth();
    return <><Text>{current.isBooting ? "booting" : current.isAuthenticated ? "signed-in" : "signed-out"}</Text>
        <Pressable onPress={() => current.logout().catch(() => {})}><Text>Logout</Text></Pressable></>;
}
beforeEach(() => {
    getAccessToken.mockResolvedValue("auth-token");
    getAppLocale.mockResolvedValue("en");
    clearAccessToken.mockResolvedValue(undefined);
    meApi.mockResolvedValue({ id: 1, full_name: "Test" });
    unregisterCurrentPush.mockResolvedValue(undefined);
});
test("keeps the session until push revocation finishes, without duplicate logout calls", async () => {
    let finish;
    unregisterCurrentPush.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    render(<AuthProvider><Harness /></AuthProvider>);
    await screen.findByText("signed-in");
    fireEvent.press(screen.getByText("Logout"));
    fireEvent.press(screen.getByText("Logout"));
    expect(current.isSigningOut).toBe(true);
    expect(clearAccessToken).not.toHaveBeenCalled();
    expect(unregisterCurrentPush).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    await screen.findByText("signed-out");
});
test("a revocation failure keeps the account signed in for retry", async () => {
    unregisterCurrentPush.mockRejectedValue(new Error("offline"));
    render(<AuthProvider><Harness /></AuthProvider>);
    await screen.findByText("signed-in");
    fireEvent.press(screen.getByText("Logout"));
    await waitFor(() => expect(current.isSigningOut).toBe(false));
    expect(current.isAuthenticated).toBe(true);
    expect(clearAccessToken).not.toHaveBeenCalled();
});
test("temporary restoration failures do not delete a still-subscribed session", async () => {
    meApi.mockRejectedValue(Object.assign(new Error("offline"), { code: "NETWORK_ERROR" }));
    render(<AuthProvider><Harness /></AuthProvider>);
    await screen.findByText("signed-in");
    expect(clearAccessToken).not.toHaveBeenCalled();
});
test("a rejected JWT clears the local session", async () => {
    meApi.mockRejectedValue(Object.assign(new Error("expired"), { status: 401 }));
    render(<AuthProvider><Harness /></AuthProvider>);
    await screen.findByText("signed-out");
    expect(clearAccessToken).toHaveBeenCalled();
});
