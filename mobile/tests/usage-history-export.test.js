import { Alert, Animated } from "react-native";
import { act, render, screen, waitFor } from "@testing-library/react-native";
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
        const callbackRef = React.useRef(callback);
        React.useEffect(() => callbackRef.current(), []);
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
    Calendar: () => null,
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
                "Export Complete",
                "The XLSX file is ready to save or share."
            );
        });
    }, 30000);

    test("shows a visible failure message when export cannot be completed", async () => {
        exportXlsxApi.mockRejectedValue(new Error("Unable to reach the server"));

        await renderHistoryScreen();
        await pressExportButton();

        await waitFor(() => {
            expect(Alert.alert).toHaveBeenCalledWith("Export Failed", "Unable to reach the server");
        });
    }, 30000);
});
