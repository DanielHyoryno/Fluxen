import { Alert, Animated } from "react-native";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import DevicesScreen from "../src/screens/Devices/DevicesScreen";
import { getMessages } from "../src/constants/messages";
import { useAuth } from "../src/context/AuthContext";
import {
    createDeviceApi,
    deleteDeviceApi,
    listCategoriesApi,
    listDevicesApi,
} from "../src/services/api";

jest.mock("../src/context/AuthContext", () => ({
    useAuth: jest.fn(),
}));

jest.mock("../src/services/api", () => ({
    createDeviceApi: jest.fn(),
    deleteDeviceApi: jest.fn(),
    listCategoriesApi: jest.fn(),
    listDevicesApi: jest.fn(),
}));

jest.mock("../src/hooks/useScreenEntranceAnimation", () => () => ({ animatedStyle: {} }));

jest.mock("@react-navigation/native", () => ({
    useFocusEffect: (callback) => {
        const React = require("react");
        React.useEffect(callback, [callback]);
    },
}));

const messages = getMessages("en");
const categories = [
    { id: 10, name: "Home" },
    { id: 20, name: "Garden" },
];
const devices = [
    {
        id: 1,
        device_code: "TEST-ONLINE",
        device_name: "Kitchen Meter",
        status: "online",
        category_id: 10,
        category_name: "Home",
    },
    {
        id: 2,
        device_code: "TEST-OFFLINE",
        device_name: "Garden Meter",
        status: "offline",
        category_id: 20,
        category_name: "Garden",
    },
];

function renderDevices() {
    const navigation = { navigate: jest.fn() };
    useAuth.mockReturnValue({
        token: "user-token",
        user: { id: 1, full_name: "Test User" },
        messages,
    });
    listDevicesApi.mockResolvedValue({ items: devices });
    listCategoriesApi.mockResolvedValue({ items: categories });
    render(<DevicesScreen navigation={navigation} />);
    return navigation;
}

describe("DevicesScreen", () => {
    beforeEach(() => {
        createDeviceApi.mockReset();
        deleteDeviceApi.mockReset();
        listCategoriesApi.mockReset();
        listDevicesApi.mockReset();
        jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
        jest.spyOn(Animated, "loop").mockReturnValue({
            start: jest.fn(),
            stop: jest.fn(),
        });
        jest.spyOn(console, "warn").mockImplementation(() => undefined);
    });

    test("loads devices and filters them by online status", async () => {
        renderDevices();

        expect(await screen.findByText("Kitchen Meter")).toBeTruthy();
        expect(screen.getByText("Garden Meter")).toBeTruthy();

        fireEvent.press(screen.getByText(messages.home.online));

        expect(screen.getByText("Kitchen Meter")).toBeTruthy();
        expect(screen.queryByText("Garden Meter")).toBeNull();
    });

    test("filters devices by category", async () => {
        renderDevices();
        expect(await screen.findByText("Kitchen Meter")).toBeTruthy();

        fireEvent.press(screen.getAllByText("Garden")[0]);

        expect(screen.queryByText("Kitchen Meter")).toBeNull();
        expect(screen.getByText("Garden Meter")).toBeTruthy();
    });

    test("validates device code and name before creating", async () => {
        renderDevices();
        await screen.findByText("Kitchen Meter");

        fireEvent.press(screen.getByText(messages.devices.manageTab));
        await screen.findByText(messages.devices.addDeviceTitle);
        fireEvent.press(screen.getByText(messages.devices.createDevice));

        expect(screen.getByText(messages.devices.minDeviceCodeError)).toBeTruthy();
        expect(screen.getByText(messages.devices.minDeviceNameError)).toBeTruthy();
        expect(createDeviceApi).not.toHaveBeenCalled();
    });

    test("carries a newly created device token into BLE provisioning", async () => {
        createDeviceApi.mockResolvedValue({ api_token: "new-device-token" });
        const navigation = renderDevices();
        await screen.findByText("Kitchen Meter");

        fireEvent.press(screen.getByText(messages.devices.manageTab));
        await screen.findByText(messages.devices.addDeviceTitle);
        fireEvent.changeText(screen.getByPlaceholderText(messages.devices.deviceCodePlaceholder), "BV-ESP32-01");
        fireEvent.changeText(screen.getByPlaceholderText(messages.devices.deviceNamePlaceholder), "Water Meter");
        fireEvent.press(screen.getByText(messages.devices.createDevice));

        expect(await screen.findByText(messages.devices.tokenTitle)).toBeTruthy();
        fireEvent.press(screen.getByText(messages.devices.provisionViaBle));

        expect(navigation.navigate).toHaveBeenCalledWith("BLEScan", {
            apiToken: "new-device-token",
            deviceCode: "BV-ESP32-01",
        });
    });

    test("confirms deletion and queues the remote reset", async () => {
        deleteDeviceApi.mockResolvedValue({ pending_reset: true });
        renderDevices();
        await screen.findByText("Kitchen Meter");

        fireEvent.press(screen.getAllByText(messages.devices.deleteButton)[0]);
        expect(screen.getByText(messages.devices.deleteDialogTitle)).toBeTruthy();
        fireEvent.press(screen.getByText(messages.devices.confirmYes));

        await waitFor(() => {
            expect(deleteDeviceApi).toHaveBeenCalledWith("user-token", 1);
            expect(Alert.alert).toHaveBeenCalledWith(
                messages.devices.deleteQueuedTitle,
                messages.devices.deleteQueuedMessage
            );
        });
    });
});
