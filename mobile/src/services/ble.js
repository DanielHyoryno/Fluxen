import { PermissionsAndroid, Platform } from "react-native";

const BLE_UNSUPPORTED_ERROR = "BLE is not supported on web runtime";
let bleManagerInstance = null;

function isWebRuntime() {
    return Platform.OS === "web";
}

function getBleManager() {
    if (isWebRuntime()) {
        return null;
    }

    if (!bleManagerInstance) {
        const { BleManager } = require("react-native-ble-plx");
        bleManagerInstance = new BleManager();
    }

    return bleManagerInstance;
}

export const BLE_SERVICE_UUID = "12345678-1234-5678-1234-56789abcdef0";
export const BLE_WIFI_SSID_CHAR_UUID = "12345678-1234-5678-1234-56789abcdef1";
export const BLE_WIFI_PASSWORD_CHAR_UUID = "12345678-1234-5678-1234-56789abcdef2";
export const BLE_SERVER_URL_CHAR_UUID = "12345678-1234-5678-1234-56789abcdef3";
export const BLE_API_TOKEN_CHAR_UUID = "12345678-1234-5678-1234-56789abcdef4";
export const BLE_DEVICE_CODE_CHAR_UUID = "12345678-1234-5678-1234-56789abcdef5";
export const BLE_DEVICE_NAME_PREFIX = "WaterMeter-";

const base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function utf8Encode(value) {
    const text = String(value ?? "");
    const bytes = [];

    for (let i = 0; i < text.length; i += 1) {
        let codePoint = text.charCodeAt(i);

        if (codePoint >= 0xd800 && codePoint <= 0xdbff && i + 1 < text.length) {
            const next = text.charCodeAt(i + 1);
            if (next >= 0xdc00 && next <= 0xdfff) {
                codePoint = ((codePoint - 0xd800) << 10) + (next - 0xdc00) + 0x10000;
                i += 1;
            }
        }

        if (codePoint <= 0x7f) {
            bytes.push(codePoint);
        } else if (codePoint <= 0x7ff) {
            bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
        } else if (codePoint <= 0xffff) {
            bytes.push(0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
        } else {
            bytes.push(
                0xf0 | (codePoint >> 18),
                0x80 | ((codePoint >> 12) & 0x3f),
                0x80 | ((codePoint >> 6) & 0x3f),
                0x80 | (codePoint & 0x3f)
            );
        }
    }

    return bytes;
}

function utf8Decode(bytes) {
    let result = "";

    for (let i = 0; i < bytes.length; ) {
        const byte1 = bytes[i];

        if (byte1 < 0x80) {
            result += String.fromCharCode(byte1);
            i += 1;
            continue;
        }

        if ((byte1 & 0xe0) === 0xc0) {
            const byte2 = bytes[i + 1] ?? 0;
            const codePoint = ((byte1 & 0x1f) << 6) | (byte2 & 0x3f);
            result += String.fromCharCode(codePoint);
            i += 2;
            continue;
        }

        if ((byte1 & 0xf0) === 0xe0) {
            const byte2 = bytes[i + 1] ?? 0;
            const byte3 = bytes[i + 2] ?? 0;
            const codePoint = ((byte1 & 0x0f) << 12) | ((byte2 & 0x3f) << 6) | (byte3 & 0x3f);
            result += String.fromCharCode(codePoint);
            i += 3;
            continue;
        }

        const byte2 = bytes[i + 1] ?? 0;
        const byte3 = bytes[i + 2] ?? 0;
        const byte4 = bytes[i + 3] ?? 0;
        const codePoint = ((byte1 & 0x07) << 18) | ((byte2 & 0x3f) << 12) | ((byte3 & 0x3f) << 6) | (byte4 & 0x3f);
        const cp = codePoint - 0x10000;
        result += String.fromCharCode((cp >> 10) + 0xd800, (cp & 0x3ff) + 0xdc00);
        i += 4;
    }

    return result;
}

function encodeBase64(value) {
    const bytes = utf8Encode(value);
    let output = "";

    for (let i = 0; i < bytes.length; i += 3) {
        const byte1 = bytes[i];
        const byte2 = bytes[i + 1];
        const byte3 = bytes[i + 2];

        const triplet = (byte1 << 16) | ((byte2 ?? 0) << 8) | (byte3 ?? 0);

        output += base64Chars[(triplet >> 18) & 0x3f];
        output += base64Chars[(triplet >> 12) & 0x3f];
        output += byte2 === undefined ? "=" : base64Chars[(triplet >> 6) & 0x3f];
        output += byte3 === undefined ? "=" : base64Chars[triplet & 0x3f];
    }

    return output;
}

function decodeBase64(value) {
    const input = String(value || "").replace(/\s/g, "");
    if (!input) return "";

    let buffer = 0;
    let bits = 0;
    const bytes = [];

    for (let i = 0; i < input.length; i += 1) {
        const char = input[i];
        if (char === "=") break;

        const index = base64Chars.indexOf(char);
        if (index === -1) continue;

        buffer = (buffer << 6) | index;
        bits += 6;

        if (bits >= 8) {
            bits -= 8;
            bytes.push((buffer >> bits) & 0xff);
        }
    }

    return utf8Decode(bytes);
}

export const bleManager = getBleManager();

export async function requestBlePermissions() {
    const manager = getBleManager();
    if (!manager) {
        return false;
    }

    if (Platform.OS !== "android") {
        const state = await manager.state();
        return state === "PoweredOn";
    }

    if (Platform.Version >= 31) {
        const result = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);

        return (
            result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
            result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED
        );
    }

    const locationStatus = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    return locationStatus === PermissionsAndroid.RESULTS.GRANTED;
}

export function startScan(onDeviceFound, onError) {
    const manager = getBleManager();
    if (!manager) {
        if (onError) onError(new Error(BLE_UNSUPPORTED_ERROR));
        return;
    }

    stopScan();

    manager.startDeviceScan(null, null, (error, device) => {
        if (error) {
            if (onError) onError(error);
            return;
        }

        if (!device?.name || !device.name.startsWith(BLE_DEVICE_NAME_PREFIX)) {
            return;
        }

        if (onDeviceFound) {
            onDeviceFound(device);
        }
    });
}

export function stopScan() {
    const manager = getBleManager();
    if (!manager) {
        return;
    }

    manager.stopDeviceScan();
}

export async function connectAndDiscover(deviceId) {
    const manager = getBleManager();
    if (!manager) {
        throw new Error(BLE_UNSUPPORTED_ERROR);
    }

    stopScan();
    const knownDevices = await manager.devices([deviceId]);
    const knownDevice = knownDevices[0];
    const device = knownDevice
        ? await knownDevice.connect({ timeout: 10000 })
        : await manager.connectToDevice(deviceId, { timeout: 10000 });

    return device.discoverAllServicesAndCharacteristics();
}

export async function readCharacteristic(device, charUUID) {
    const characteristic = await device.readCharacteristicForService(BLE_SERVICE_UUID, charUUID);
    return decodeBase64(characteristic?.value || "");
}

export async function writeCharacteristic(device, charUUID, stringValue) {
    const base64Value = encodeBase64(stringValue);
    return device.writeCharacteristicWithResponseForService(BLE_SERVICE_UUID, charUUID, base64Value);
}

export async function disconnectDevice(deviceId) {
    const manager = getBleManager();
    if (!manager) {
        return;
    }

    const connected = await manager.isDeviceConnected(deviceId);
    if (connected) {
        await manager.cancelDeviceConnection(deviceId);
    }
}
