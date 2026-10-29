import { t, setLanguage } from "../src/services/i18n";
import { Alert, Animated } from "react-native";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import UsageHistoryScreen from "../src/screens/UsageHistory/UsageHistoryScreen";
import { useAuth } from "../src/context/AuthContext";
import { exportXlsxApi, usageHistoryApi } from "../src/services/api";
import { saveAndShareXlsx } from "../src/services/xlsx-export";

jest.mock("../src/context/AuthContext", () => ({
    useAuth: jest.fn(),
}));

jest.mock("../src/services/api", () => ({
    exportXlsxApi: jest.fn(),
    usageHistoryApi: jest.fn(),
}));

jest.mock("../src/services/xlsx-export", () => ({
    sanitizeXlsxFilename: jest.fn((filename) => filename),
    saveAndShareXlsx: jest.fn(),
}));

jest.mock("@react-navigation/native", () => ({
    useFocusEffect: (callback) => {
        const React = require("react");
        React.useEffect(callback, [callback]);
    },
}));

jest.mock("../src/components/SectionAccordion", () => {
    const React = require("react");
    const { Text, View } = require("react-native");

    return function MockSectionAccordion({ title, children }) {
        return React.createElement(
            View,
            null,
            React.createElement(Text, null, title),
            children
        );
    };
});

jest.mock("react-native-calendars", () => ({
    Calendar: ({ onDayPress }) => {
        const React = require("react");
        const { Pressable, Text, View } = require("react-native");
        return React.createElement(
            View,
            null,
            React.createElement(
                Pressable,
                { testID: "calendar-start", onPress: () => onDayPress({ dateString: "2026-01-01" }) },
                React.createElement(Text, null, "Test start date")
            ),
            React.createElement(
                Pressable,
                { testID: "calendar-over-limit", onPress: () => onDayPress({ dateString: "2026-02-15" }) },
                React.createElement(Text, null, "Test over-limit date")
            ),
            ...[["calendar-mid", "2026-01-15"], ["calendar-thirty", "2026-01-30"]].map(([testID, dateString]) =>
                React.createElement(Pressable, { key: testID, testID, onPress: () => onDayPress({ dateString }) },
                    React.createElement(Text, null, dateString)))
        );
    },
}));

const route = {
    params: {
        device: {
            id: 1,
            device_code: "DEVICE-01",
            device_name: "Kitchen Meter",
        },
    },
};

async function renderHistoryScreen() {
    render(<UsageHistoryScreen route={route} />);
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });
}

async function pressExportButton() {
    const exportButton = screen.getByLabelText("Export XLSX file");
    let pressable = exportButton;
    while (pressable && typeof pressable.props?.onPress !== "function") {
        pressable = pressable.parent;
    }

    if (!pressable) {
        throw new Error("Export button press handler was not found");
    }

    await act(async () => {
        await pressable.props.onPress();
    });
}

describe("UsageHistoryScreen XLSX export", () => {
    beforeEach(() => {
        useAuth.mockReturnValue({ token: "user-token" });
        usageHistoryApi.mockResolvedValue({ items: [] });
        exportXlsxApi.mockReset();
        saveAndShareXlsx.mockReset();
        jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
        jest.spyOn(global, "setInterval").mockImplementation(() => 0);
        jest.spyOn(global, "clearInterval").mockImplementation(() => undefined);
        jest.spyOn(Animated, "parallel").mockReturnValue({
            start: jest.fn((callback) => callback?.()),
            stop: jest.fn(),
        });
    });

    test("shows a visible success message after the native share flow", async () => {
        const arrayBuffer = new Uint8Array([80, 75, 3, 4]).buffer;
        exportXlsxApi.mockResolvedValue({
            arrayBuffer,
            contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            contentDisposition: 'attachment; filename="DEVICE-01_2026-08.xlsx"',
        });
        saveAndShareXlsx.mockResolvedValue({
            fileUri: "file:///cache/DEVICE-01_2026-08.xlsx",
            shared: true,
        });

        await renderHistoryScreen();
        await pressExportButton();

        await waitFor(() => {
            expect(exportXlsxApi).toHaveBeenCalledWith(
                "user-token",
                "DEVICE-01",
                expect.stringMatching(/^\d{4}-\d{2}-01$/),
                expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
            );
            expect(saveAndShareXlsx).toHaveBeenCalledWith(
                expect.objectContaining({ arrayBuffer, filename: "DEVICE-01_2026-08.xlsx" })
            );
            expect(Alert.alert).toHaveBeenCalledWith(
                t("reportReady"),
                t("The XLSX file is ready to save or share.")
            );
        });
    }, 30000);

    test("shows a visible failure message when export cannot be completed", async () => {
        exportXlsxApi.mockRejectedValue(new Error("Unable to reach the server"));

        await renderHistoryScreen();
        await pressExportButton();

        await waitFor(() => {
            expect(screen.getByText("Unable to reach the server")).toBeTruthy();
            expect(screen.getByText(t("Export failed"))).toBeTruthy();
        });
    }, 30000);

    test("loads the selected 30-day history period", async () => {
        await renderHistoryScreen();
        usageHistoryApi.mockClear();

        fireEvent.press(screen.getByText("30 days"));

        await waitFor(() => expect(usageHistoryApi).toHaveBeenCalled());
        const [, , from, to] = usageHistoryApi.mock.calls.at(-1);
        const inclusiveDays = Math.floor((new Date(to) - new Date(from)) / 86400000) + 1;
        expect(inclusiveDays).toBe(30);
    });

    test("retrying a failed export repeats the export without reloading history", async () => {
        exportXlsxApi.mockRejectedValueOnce(new Error("Connection lost")).mockResolvedValue({
            arrayBuffer: new Uint8Array([80, 75, 3, 4]).buffer,
            contentDisposition: 'attachment; filename="usage.xlsx"',
        });
        saveAndShareXlsx.mockResolvedValue({ shared: true });
        await renderHistoryScreen();
        await pressExportButton();
        const historyCalls = usageHistoryApi.mock.calls.length;
        fireEvent.press(screen.getByText("Try again"));
        await waitFor(() => expect(exportXlsxApi).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(saveAndShareXlsx).toHaveBeenCalled());
        expect(exportXlsxApi).toHaveBeenCalledTimes(2);
        expect(usageHistoryApi).toHaveBeenCalledTimes(historyCalls);
        expect(screen.queryByText("Connection lost")).toBeNull();
    });

    test("Indonesian labels show the export period independently of chart selection", async () => {
        await renderHistoryScreen();
        act(() => setLanguage("id"));
        expect(screen.getByText("Bulan")).toBeTruthy();
        expect(screen.getByText("Tahun")).toBeTruthy();
        expect(screen.queryByText("Tahun berjalan saja")).toBeNull();
        expect(screen.queryByText("Laporan mengikuti periode ini, terpisah dari grafik.")).toBeNull();
        expect(screen.getByText(/Periode laporan:/)).toBeTruthy();
        act(() => setLanguage("en"));
    });

    test("warns and caps a custom range longer than 30 days", async () => {
        await renderHistoryScreen();

        fireEvent.press(screen.getByText("Custom"));
        fireEvent.press(screen.getByText("From"));
        fireEvent.press(screen.getByTestId("calendar-start"));
        fireEvent.press(screen.getByTestId("calendar-over-limit"));

        expect(Alert.alert).toHaveBeenCalledWith(t("Range limited"), t("Maximum custom range is 30 days."));
    });

    test.each([
        ["BB-HIS-003", "calendar-mid", "2026-01-15"],
        ["BB-HIS-004", "calendar-thirty", "2026-01-30"],
        ["BB-HIS-005", "calendar-start", "2026-01-01"],
    ])("%s | apply custom range ending at %s", async (id, endButton, expectedEnd) => {
        await renderHistoryScreen();
        fireEvent.press(screen.getByText("Custom"));
        fireEvent.press(screen.getByText("From"));
        fireEvent.press(screen.getByTestId("calendar-start"));
        fireEvent.press(screen.getByTestId(endButton));
        usageHistoryApi.mockClear();
        fireEvent.press(screen.getByText(t("Apply")));
        await waitFor(() => expect(usageHistoryApi).toHaveBeenCalledWith("user-token", "DEVICE-01", "2026-01-01", expectedEnd));
        expect(Alert.alert).not.toHaveBeenCalled();
    });

    test("BB-HIS-006 | cancelling the calendar preserves the previous range", async () => {
        await renderHistoryScreen();
        fireEvent.press(screen.getByText("Custom"));
        const prior = usageHistoryApi.mock.calls.at(-1)?.slice(2);
        fireEvent.press(screen.getByText("From"));
        fireEvent.press(screen.getByTestId("calendar-start"));
        fireEvent.press(screen.getByText(t("Cancel")));
        expect(usageHistoryApi.mock.calls.at(-1)?.slice(2)).toEqual(prior);
    });

    test("BB-EXP-003 | All uses the full current year independently of history", async () => {
        exportXlsxApi.mockResolvedValue({ arrayBuffer: new Uint8Array([80, 75]).buffer });
        saveAndShareXlsx.mockResolvedValue({ shared: true });
        await renderHistoryScreen();
        fireEvent.press(screen.getByText(t("Month")));
        fireEvent.press(screen.getByText(t("All")));
        await pressExportButton();
        const year = new Date().getFullYear();
        expect(exportXlsxApi).toHaveBeenCalledWith("user-token", "DEVICE-01", `${year}-01-01`, `${year}-12-31`);
    });

    test("BB-HIS-007 | bars and line switch on the history screen", async () => {
        await renderHistoryScreen();
        expect(screen.getByTestId("usage-chart")).toBeTruthy();
        fireEvent.press(screen.getByText(t("Line")));
        expect(screen.queryByTestId("usage-chart")).toBeNull();
        fireEvent.press(screen.getByText(t("Bars")));
        expect(screen.getByTestId("usage-chart")).toBeTruthy();
    });
});
