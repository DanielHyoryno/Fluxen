import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import BLEScanScreen from "../src/screens/BLEScan/BLEScanScreen";
import { setLanguage, t } from "../src/services/i18n";
import * as ble from "../src/services/ble";

jest.mock("../src/hooks/useScreenEntranceAnimation", () => () => ({ animatedStyle: {} }));
jest.mock("../src/hooks/usePageInsets", () => () => ({ paddingTop: 16, paddingBottom: 90 }));
jest.mock("../src/services/ble", () => ({
    BLE_DEVICE_CODE_CHAR_UUID: "code", BLE_WIFI_SSID_CHAR_UUID: "ssid",
    BLE_WIFI_PASSWORD_CHAR_UUID: "password", BLE_SERVER_URL_CHAR_UUID: "server", BLE_API_TOKEN_CHAR_UUID: "token",
    requestBlePermissions: jest.fn(), startScan: jest.fn(), stopScan: jest.fn(),
    connectAndDiscover: jest.fn(), readCharacteristic: jest.fn(),
    writeCharacteristic: jest.fn(), disconnectDevice: jest.fn(),
}));

const meter = { id: "test-meter", name: "WaterMeter-ESP32", rssi: -45 };

beforeEach(() => {
    jest.clearAllMocks();
    setLanguage("en");
    ble.requestBlePermissions.mockResolvedValue(true);
    ble.startScan.mockImplementation((onDevice) => onDevice(meter));
    ble.connectAndDiscover.mockResolvedValue(meter);
    ble.readCharacteristic.mockResolvedValue("BV-ESP32-01");
    ble.writeCharacteristic.mockResolvedValue(undefined);
    ble.disconnectDevice.mockResolvedValue(undefined);
});

test("shared panels retain scan, connection, token prefill, Wi-Fi transmission and disconnect", async () => {
    const view = render(<BLEScanScreen route={{ params: { apiToken: "registered-meter-token" } }} />);
    await screen.findByText(t("Bluetooth permission granted."));
    fireEvent.press(screen.getAllByText(t("Scan for Devices"))[1]);
    fireEvent.press(await screen.findByText(meter.name));
    await screen.findByText("BV-ESP32-01");
    expect(ble.connectAndDiscover).toHaveBeenCalledWith(meter.id);
    expect(ble.readCharacteristic).toHaveBeenCalledWith(meter, "code");
    expect(screen.getByPlaceholderText(t("Paste device API token")).props.value).toBe("registered-meter-token");
    fireEvent.changeText(screen.getByPlaceholderText(t("Enter WiFi SSID")), " Home Wi-Fi ");
    fireEvent.changeText(screen.getByPlaceholderText(t("Enter WiFi password")), "wifi-password");
    fireEvent.changeText(screen.getByPlaceholderText("http://192.168.1.10:8080"), " https://fluxen.onrender.com ");
    fireEvent.press(screen.getByText(t("Send Configuration")));
    await waitFor(() => expect(ble.writeCharacteristic).toHaveBeenCalledTimes(4));
    expect(ble.writeCharacteristic.mock.calls).toEqual([
        [meter, "ssid", "Home Wi-Fi"], [meter, "password", "wifi-password"],
        [meter, "server", "https://fluxen.onrender.com"], [meter, "token", "registered-meter-token"],
    ]);
    await screen.findByText(t("Configuration sent successfully. Device should connect to WiFi shortly."));
    await act(async () => fireEvent.press(screen.getByText(t("Disconnect"))));
    expect(ble.disconnectDevice).toHaveBeenCalledWith(meter.id);
    expect(screen.queryByText("BV-ESP32-01")).toBeNull();
    await act(async () => view.unmount());
});

test("denied permission cannot start scanning", async () => {
    ble.requestBlePermissions.mockResolvedValue(false);
    render(<BLEScanScreen />);
    await screen.findByText(t("Bluetooth permissions denied. Enable them in system settings."));
    fireEvent.press(screen.getAllByText(t("Scan for Devices"))[1]);
    expect(ble.startScan).not.toHaveBeenCalled();
});
