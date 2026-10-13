import { bleErrorCopy } from "../../common/bleErrorCopy";
import { t, useLocale } from "../../services/i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, FlatList, Text, View } from "react-native";
import { BleConnectionCard, BleDeviceItem, BleProvisionForm, BleScanPanel } from "../../components/DeviceSetupPanels";
import { API_BASE_URL } from "../../config/api";
import {
    BLE_API_TOKEN_CHAR_UUID,
    BLE_DEVICE_CODE_CHAR_UUID,
    BLE_SERVER_URL_CHAR_UUID,
    BLE_WIFI_PASSWORD_CHAR_UUID,
    BLE_WIFI_SSID_CHAR_UUID,
    connectAndDiscover,
    disconnectDevice,
    readCharacteristic,
    requestBlePermissions,
    startScan,
    stopScan,
    writeCharacteristic,
} from "../../services/ble";
import useScreenEntranceAnimation from "../../hooks/useScreenEntranceAnimation";
import styles from "./styles";
import usePageInsets from "../../hooks/usePageInsets";

function getServerBaseUrl() {
    const match = API_BASE_URL.match(/^https?:\/\/[^/]+/i);
    return match ? match[0] : API_BASE_URL;
}

export default function BLEScanScreen({ route }) {
    const pageInsets = usePageInsets();
    useLocale();
    const { animatedStyle } = useScreenEntranceAnimation();
    const [permissionGranted, setPermissionGranted] = useState(null);
    const [devices, setDevices] = useState([]);
    const [isScanning, setIsScanning] = useState(false);
    const [scanError, setScanError] = useState("");
    const [connectedDevice, setConnectedDevice] = useState(null);
    const [connectingId, setConnectingId] = useState("");
    const [deviceCode, setDeviceCode] = useState("");
    const [wifiSsid, setWifiSsid] = useState("");
    const [wifiPassword, setWifiPassword] = useState("");
    const [serverUrl, setServerUrl] = useState(getServerBaseUrl());
    const [apiToken, setApiToken] = useState(() => String(route?.params?.apiToken || ""));
    const [statusMessage, setStatusMessage] = useState("");
    const [statusType, setStatusType] = useState("idle");
    const [sendingConfig, setSendingConfig] = useState(false);

    const scanTimeoutRef = useRef(null);
    const connectedDeviceIdRef = useRef(null);

    const canSendConfig = useMemo(() => {
        return !!connectedDevice && !!wifiSsid.trim() && !!serverUrl.trim() && !!apiToken.trim() && !sendingConfig;
    }, [connectedDevice, wifiSsid, serverUrl, apiToken, sendingConfig]);

    useEffect(() => {
        connectedDeviceIdRef.current = connectedDevice?.id || null;
    }, [connectedDevice?.id]);

    useEffect(() => {
        const incomingToken = String(route?.params?.apiToken || "").trim();
        if (incomingToken) {
            setApiToken(incomingToken);
        }
    }, [route?.params?.apiToken]);

    useEffect(() => {
        let mounted = true;

        async function setupPermissions() {
            try {
                const granted = await requestBlePermissions();
                if (!mounted) return;
                setPermissionGranted(granted);
            } catch (error) {
                if (!mounted) return;
                setPermissionGranted(false);
                setScanError(bleErrorCopy(error, "Failed to request Bluetooth permissions"));
            }
        }

        setupPermissions();

        return () => {
            mounted = false;
            stopScan();
            if (scanTimeoutRef.current) {
                clearTimeout(scanTimeoutRef.current);
            }
            if (connectedDeviceIdRef.current) {
                disconnectDevice(connectedDeviceIdRef.current).catch(() => null);
            }
        };
    }, []);

    function handleStopScan() {
        stopScan();
        setIsScanning(false);
        if (scanTimeoutRef.current) {
            clearTimeout(scanTimeoutRef.current);
            scanTimeoutRef.current = null;
        }
    }

    function handleStartScan() {
        if (!permissionGranted) {
            setScanError(t("Bluetooth permissions are required before scanning"));
            return;
        }

        setDevices([]);
        setScanError("");
        setStatusMessage("");
        setStatusType("idle");
        setIsScanning(true);

        startScan(
            (device) => {
                setDevices((prev) => {
                    const existing = prev.find((item) => item.id === device.id);
                    if (existing) {
                        return prev
                            .map((item) => (item.id === device.id ? device : item))
                            .sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999));
                    }

                    return [...prev, device].sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999));
                });
            },
            (error) => {
                setScanError(bleErrorCopy(error, "Scan failed"));
                setIsScanning(false);
            }
        );

        scanTimeoutRef.current = setTimeout(() => {
            handleStopScan();
        }, 15000);
    }

    async function handleConnect(device) {
        setConnectingId(device.id);
        setStatusMessage("");
        setStatusType("idle");
        setScanError("");

        try {
            const discoveredDevice = await connectAndDiscover(device.id);
            setConnectedDevice(discoveredDevice);
            const code = await readCharacteristic(discoveredDevice, BLE_DEVICE_CODE_CHAR_UUID);
            setDeviceCode(code || "-");
            setStatusType("success");
            setStatusMessage(t("connectedDevice", { name: device.name || t("Unknown device") }));
        } catch (error) {
            setStatusType("error");
            setStatusMessage(bleErrorCopy(error, "Failed to connect to BLE device"));
            setConnectedDevice(null);
            setDeviceCode("");
        } finally {
            setConnectingId("");
        }
    }

    async function handleSendConfiguration() {
        if (!connectedDevice) return;

        setSendingConfig(true);
        setStatusType("idle");
        setStatusMessage("");

        try {
            await writeCharacteristic(connectedDevice, BLE_WIFI_SSID_CHAR_UUID, wifiSsid.trim());
            await writeCharacteristic(connectedDevice, BLE_WIFI_PASSWORD_CHAR_UUID, wifiPassword);
            await writeCharacteristic(connectedDevice, BLE_SERVER_URL_CHAR_UUID, serverUrl.trim());
            await writeCharacteristic(connectedDevice, BLE_API_TOKEN_CHAR_UUID, apiToken.trim());

            setStatusType("success");
            setStatusMessage(t("Configuration sent successfully. Device should connect to WiFi shortly."));
        } catch (error) {
            setStatusType("error");
            setStatusMessage(bleErrorCopy(error, "Failed to send configuration"));
        } finally {
            setSendingConfig(false);
        }
    }

    async function handleDisconnect() {
        if (!connectedDevice?.id) return;

        try {
            await disconnectDevice(connectedDevice.id);
            setConnectedDevice(null);
            setConnectingId("");
            setDeviceCode("");
            setStatusType("idle");
            setStatusMessage(t("Disconnected from BLE device"));
        } catch (error) {
            setStatusType("error");
            setStatusMessage(bleErrorCopy(error, "Failed to disconnect"));
        }
    }

    return (
        <Animated.ScrollView
            style={[styles.page, { paddingTop: pageInsets.paddingTop }, animatedStyle]}
            contentContainerStyle={[styles.content, { paddingBottom: pageInsets.paddingBottom }]}
            keyboardShouldPersistTaps="handled"
        >
            <View style={styles.header}>
                <Text style={styles.title}>{t("BLE Provisioning")}</Text>
                <Text style={styles.subtitle}>{t("Scan and configure nearby WaterMeter ESP32 devices")}</Text>
            </View>

            <View style={styles.card}>
                <Text style={styles.sectionTitle}>{t("Permission")}</Text>
                {permissionGranted === null ? <ActivityIndicator color="#0f62fe" /> : null}
                {permissionGranted === true ? <Text style={styles.meta}>{t("Bluetooth permission granted.")}</Text> : null}
                {permissionGranted === false ? (
                    <Text style={styles.error}>{t("Bluetooth permissions denied. Enable them in system settings.")}</Text>
                ) : null}
            </View>

            <BleScanPanel isScanning={isScanning} permissionGranted={permissionGranted}
                scanError={scanError} onScan={handleStartScan}>
                <FlatList
                    data={devices}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                    renderItem={({ item }) => (
                        <BleDeviceItem item={item} onPress={handleConnect} connecting={connectingId === item.id} />
                    )}
                    ListEmptyComponent={<Text style={styles.empty}>{t("No WaterMeter BLE devices found yet.")}</Text>}
                />
            </BleScanPanel>

            <BleConnectionCard connectedDevice={connectedDevice} onDisconnect={handleDisconnect} />

            {connectedDevice ? (
                <BleProvisionForm deviceCode={deviceCode} wifiSsid={wifiSsid} wifiPassword={wifiPassword}
                    serverUrl={serverUrl} apiToken={apiToken} canSendConfig={canSendConfig} sendingConfig={sendingConfig}
                    onSsidChange={setWifiSsid} onPasswordChange={setWifiPassword}
                    onServerChange={setServerUrl} onTokenChange={setApiToken} onSend={handleSendConfiguration} />
            ) : null}

            {statusMessage ? (
                <View
                    style={[
                        styles.feedbackBox,
                        statusType === "success" ? styles.feedbackSuccess : styles.feedbackError,
                    ]}
                >
                    <Text style={statusType === "success" ? styles.successText : styles.error}>{statusMessage}</Text>
                </View>
            ) : null}
        </Animated.ScrollView>
    );
}
