import { Alert, Animated } from "react-native";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import DeviceDashboardScreen from "../src/screens/DeviceDashboard/DeviceDashboardScreen";
import { FlowBarChart, FlowLineChart, HourlyUsageLineChart } from "../src/components/deviceDashboard/charts";
import { getMessages } from "../src/constants/messages";
import { setLanguage } from "../src/services/i18n";
import { useAuth } from "../src/context/AuthContext";
import * as api from "../src/services/api";

jest.mock("../src/context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../src/services/api", () => ({ getDeviceApi: jest.fn(), latestTelemetryApi: jest.fn(), dailyTelemetryApi: jest.fn(), usageAlertsApi: jest.fn(), usageLimitsApi: jest.fn(), dismissAlertApi: jest.fn() }));
jest.mock("@react-navigation/native", () => ({ useFocusEffect: callback => require("react").useEffect(callback, [callback]) }));
const messages = getMessages("en");
const device = { id: 1, device_code: "TEST-DASHBOARD", device_name: "Test Meter" };
const now = new Date("2026-10-29T12:00:00+07:00").getTime();
const realSetInterval = global.setInterval;
const rows = Array.from({ length: 13 }, (_, hour) => ({ hour,
    measured_at: new Date(`2026-10-29T${String(hour).padStart(2, "0")}:00:00+07:00`).toISOString(),
    flow_rate_lpm: 2, avg_flow_rate_lpm: 2, peak_flow_rate_lpm: 3, volume_delta_l: 1,
}));
const alert = { id: 99, alert_type: "USAGE_LIMIT_DAILY", meta: { period_key: "2026-10-29", consumed_l: 13, limit_l: 10 } };
beforeEach(() => {
    Object.values(api).filter(jest.isMockFunction).forEach(mock => mock.mockReset());
    act(() => setLanguage("en"));
    jest.spyOn(Date, "now").mockReturnValue(now);
    // Suppress only the screen's polling timers, not Testing Library's retry timer.
    jest.spyOn(global, "setInterval").mockImplementation((callback, delay, ...args) =>
        delay === 1000 || delay === 4000 ? 0 : realSetInterval(callback, delay, ...args));
    // Settle entrance animations rather than leaving every card at opacity 0.
    jest.spyOn(Animated, "timing").mockImplementation((value, config) => ({
        start: callback => { value.setValue(config.toValue); callback?.({ finished: true }); }, stop: jest.fn(),
    }));
    jest.spyOn(Animated, "parallel").mockImplementation(animations => ({
        start: callback => { animations.forEach(animation => animation.start()); callback?.({ finished: true }); }, stop: jest.fn(),
    }));
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    useAuth.mockReturnValue({ token: "synthetic-token", messages });
    api.getDeviceApi.mockResolvedValue(device);
    api.latestTelemetryApi.mockResolvedValue({ measured_at: new Date(now).toISOString(), flow_rate_lpm: 1.25 });
    api.dailyTelemetryApi.mockResolvedValue({ items: rows });
    api.usageAlertsApi.mockResolvedValue({ items: [] });
    api.usageLimitsApi.mockResolvedValue({ daily_usage_limit_l: 10, monthly_usage_limit_l: 100 });
});
async function dashboard() {
    const navigation = { navigate: jest.fn(), setParams: jest.fn() };
    render(<DeviceDashboardScreen route={{ params: { device } }} navigation={navigation} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await screen.findByText("Test Meter"); return navigation;
}
function liveDashboard(initialDevice = device) {
    const navigate = jest.fn();
    function DetailHarness() {
        const React = require("react");
        const [activeDevice, setActiveDevice] = React.useState(initialDevice);
        const navigation = React.useMemo(() => ({
            navigate,
            setParams: ({ device: updated }) => setActiveDevice(updated),
        }), []);
        return <DeviceDashboardScreen route={{ params: { device: activeDevice } }} navigation={navigation} />;
    }
    render(<DetailHarness />);
    return navigate;
}
test("BB-DAS-001 | online summary from synthetic readings", async () => {
    await dashboard();
    expect(screen.getByText("Online")).toBeTruthy();
    expect(screen.getByText("1.25 L/min")).toBeTruthy();
    expect(screen.getByText("13.000 L")).toBeTruthy();
    expect(screen.getByText("2.00 L/min")).toBeTruthy();
    expect(screen.getByText("3.00 L/min")).toBeTruthy();
});
test("BB-DAS-002 | offline summary zeroes only the current flow", async () => {
    api.latestTelemetryApi.mockResolvedValue({ measured_at: new Date(now - 300000).toISOString(), flow_rate_lpm: 9 });
    await dashboard();
    expect(screen.getByText("Offline")).toBeTruthy();
    expect(screen.getByText("0.00 L/min")).toBeTruthy();
    expect(screen.getByText("13.000 L")).toBeTruthy();
});
test("BB-DAS-003 | no readings is handled without inventing usage", async () => {
    api.latestTelemetryApi.mockResolvedValue(null); api.dailyTelemetryApi.mockResolvedValue({ items: [] });
    await dashboard();
    expect(screen.getByText("No readings yet")).toBeTruthy();
    expect(screen.getByText("0.000 L")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: messages.dashboard.telemetryDetails }));
    expect(screen.getByText(messages.dashboard.noChartData)).toBeTruthy();
    expect(screen.getByText(messages.dashboard.noTelemetryToday)).toBeTruthy();
});
test("BB-DAS-004 | accordion exposes real bar and line chart components", async () => {
    await dashboard();
    expect(screen.queryByText(messages.dashboard.flowRateChart)).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: messages.dashboard.telemetryDetails }));
    expect(screen.UNSAFE_getByType(FlowBarChart)).toBeTruthy();
    expect(screen.UNSAFE_getByType(HourlyUsageLineChart)).toBeTruthy();
    fireEvent.press(screen.getByText(messages.dashboard.line));
    expect(screen.UNSAFE_getByType(FlowLineChart)).toBeTruthy();
    expect(screen.UNSAFE_queryByType(FlowBarChart)).toBeNull();
    fireEvent.press(screen.getByText(messages.dashboard.bars));
    expect(screen.UNSAFE_getByType(FlowBarChart)).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: messages.dashboard.telemetryDetails }));
    expect(screen.queryByText(messages.dashboard.flowRateChart)).toBeNull();
});
test("BB-DAS-005 | hourly readings expand and collapse", async () => {
    await dashboard();
    fireEvent.press(screen.getByRole("button", { name: messages.dashboard.telemetryDetails }));
    fireEvent.press(screen.getByText("Show 3 more"));
    expect(screen.getByText(messages.dashboard.viewLess)).toBeTruthy();
    fireEvent.press(screen.getByText(messages.dashboard.viewLess));
    expect(screen.getByText("Show 3 more")).toBeTruthy();
    expect(screen.UNSAFE_getByType(HourlyUsageLineChart).props.hourlySeries).toHaveLength(24);
    expect(screen.UNSAFE_getByType(HourlyUsageLineChart).props.hourlySeries.reduce((sum, row) => sum + row.totalLiters, 0)).toBe(13);
});
test("BB-DAS-006 | device-specific history edit and limits navigation", async () => {
    const navigation = await dashboard();
    fireEvent.press(screen.getByText(messages.dashboard.viewMoreDetailIoT));
    expect(navigation.navigate).toHaveBeenCalledWith("UsageHistory", { device });
    fireEvent.press(screen.getAllByText(messages.dashboard.edit)[0]);
    expect(navigation.navigate).toHaveBeenCalledWith("DeviceEdit", { device });
    fireEvent.press(screen.getAllByText(messages.dashboard.edit)[1]);
    expect(navigation.navigate).toHaveBeenCalledWith("UsageLimits", { device });
});
test("BB-NTF-001 | active usage alert can be dismissed in the UI", async () => {
    api.usageAlertsApi.mockResolvedValue({ items: [alert] }); api.dismissAlertApi.mockResolvedValue({});
    await dashboard();
    expect(screen.queryByText(messages.dashboard.noActiveAlerts)).toBeNull();
    fireEvent.press(screen.getByText(messages.dashboard.dismiss));
    await waitFor(() => expect(api.dismissAlertApi).toHaveBeenCalledWith("synthetic-token", 99));
    expect(await screen.findByText(messages.dashboard.noActiveAlerts)).toBeTruthy();
});

test("BB-DEV-009 | refreshes all device metadata when detail becomes active", async () => {
    const currentDevice = { ...device, device_name: "Renamed Meter", install_location: "Room B", category_id: 2, category_name: "Garden" };
    api.getDeviceApi.mockResolvedValue(currentDevice);
    const navigate = liveDashboard();
    expect(await screen.findByText("Renamed Meter")).toBeTruthy();
    expect(screen.queryByText("Test Meter")).toBeNull();
    fireEvent.press(screen.getAllByText(messages.dashboard.edit)[0]);
    expect(navigate).toHaveBeenCalledWith("DeviceEdit", { device: currentDevice });
    fireEvent.press(screen.getByText(messages.dashboard.viewMoreDetailIoT));
    expect(navigate).toHaveBeenCalledWith("UsageHistory", { device: currentDevice });
    fireEvent.press(screen.getAllByText(messages.dashboard.edit)[1]);
    expect(navigate).toHaveBeenCalledWith("UsageLimits", { device: currentDevice });
    expect(api.getDeviceApi).toHaveBeenCalledTimes(1);
    expect(api.getDeviceApi).toHaveBeenCalledWith("synthetic-token", 1);
});

test("BB-DEV-009 | cleared location and category do not reappear from old params", async () => {
    const currentDevice = { ...device, device_name: "Renamed Meter", install_location: null, category_id: null, category_name: null };
    api.getDeviceApi.mockResolvedValue(currentDevice);
    const navigate = liveDashboard({ ...device, install_location: "Old location", category_id: 1, category_name: "Kitchen" });
    await screen.findByText("Renamed Meter");
    fireEvent.press(screen.getAllByText(messages.dashboard.edit)[0]);
    expect(navigate).toHaveBeenCalledWith("DeviceEdit", { device: currentDevice });
});

test("device identity is not fetched on each telemetry polling tick", async () => {
    await dashboard();
    const poll = global.setInterval.mock.calls.find(([, delay]) => delay === 4000)[0];
    await act(async () => { await poll(); });
    expect(api.latestTelemetryApi).toHaveBeenCalledTimes(2);
    expect(api.getDeviceApi).toHaveBeenCalledTimes(1);
});

test("failed identity refresh preserves existing telemetry and reports the error", async () => {
    api.getDeviceApi.mockRejectedValue(new Error("Device metadata unavailable"));
    await dashboard();
    expect(await screen.findByText("Device metadata unavailable")).toBeTruthy();
    expect(screen.getByText("13.000 L")).toBeTruthy();
});
