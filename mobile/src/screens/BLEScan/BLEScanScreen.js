import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
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

function getServerBaseUrl() {
  const match = API_BASE_URL.match(/^https?:\/\/[^/]+/i);
  return match ? match[0] : API_BASE_URL;
}

function DeviceItem({ item, onPress, connecting }) {
  return (
    <Pressable style={styles.card} onPress={() => onPress(item)} disabled={connecting}>
      <View style={styles.cardHeader}>
        <Text style={styles.deviceName}>{item.name || "Unknown device"}</Text>
        {connecting ? <ActivityIndicator color="#0f62fe" size="small" /> : null}
      </View>
      <Text style={styles.meta}>ID: {item.id}</Text>
      <Text style={styles.meta}>RSSI: {item.rssi ?? "-"} dBm</Text>
    </Pressable>
  );
}

export default function BLEScanScreen() {
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
  const [apiToken, setApiToken] = useState("");
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
    let mounted = true;

    async function setupPermissions() {
      try {
        const granted = await requestBlePermissions();
        if (!mounted) return;
        setPermissionGranted(granted);
      } catch (error) {
        if (!mounted) return;
        setPermissionGranted(false);
        setScanError(error.message || "Failed to request Bluetooth permissions");
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
      setScanError("Bluetooth permissions are required before scanning");
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
        setScanError(error.message || "Scan failed");
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
      setStatusMessage(`Connected to ${device.name}`);
    } catch (error) {
      setStatusType("error");
      setStatusMessage(error.message || "Failed to connect to BLE device");
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
      setStatusMessage("Configuration sent successfully. Device should connect to WiFi shortly.");
    } catch (error) {
      setStatusType("error");
      setStatusMessage(error.message || "Failed to send configuration");
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
      setStatusMessage("Disconnected from BLE device");
    } catch (error) {
      setStatusType("error");
      setStatusMessage(error.message || "Failed to disconnect");
    }
  }

  return (
    <Animated.ScrollView style={[styles.page, animatedStyle]} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>BLE Provisioning</Text>
        <Text style={styles.subtitle}>Scan and configure nearby WaterMeter ESP32 devices</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Permission</Text>
        {permissionGranted === null ? <ActivityIndicator color="#0f62fe" /> : null}
        {permissionGranted === true ? <Text style={styles.meta}>Bluetooth permission granted.</Text> : null}
        {permissionGranted === false ? (
          <Text style={styles.error}>Bluetooth permissions denied. Enable them in system settings.</Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Scan for Devices</Text>
        <Pressable
          style={[styles.primaryButton, isScanning && styles.primaryButtonDisabled]}
          onPress={handleStartScan}
          disabled={isScanning || !permissionGranted}
        >
          {isScanning ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Scan for Devices</Text>}
        </Pressable>
        {isScanning ? <Text style={styles.meta}>Scanning... auto-stop in 15 seconds.</Text> : null}
        {scanError ? <Text style={styles.error}>{scanError}</Text> : null}

        <FlatList
          data={devices}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <DeviceItem item={item} onPress={handleConnect} connecting={connectingId === item.id} />
          )}
          ListEmptyComponent={<Text style={styles.empty}>No WaterMeter BLE devices found yet.</Text>}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Connection</Text>
        <Text style={styles.meta}>Status: {connectedDevice ? `Connected (${connectedDevice.name || connectedDevice.id})` : "Not connected"}</Text>
        {connectedDevice ? (
          <Pressable style={styles.secondaryButton} onPress={handleDisconnect}>
            <Text style={styles.secondaryText}>Disconnect</Text>
          </Pressable>
        ) : null}
      </View>

      {connectedDevice ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Provisioning</Text>
          <Text style={styles.metaLabel}>Device code</Text>
          <View style={styles.readOnlyBox}>
            <Text style={styles.readOnlyText}>{deviceCode || "Reading..."}</Text>
          </View>

          <Text style={styles.metaLabel}>WiFi SSID</Text>
          <TextInput
            style={styles.input}
            value={wifiSsid}
            onChangeText={setWifiSsid}
            placeholder="Enter WiFi SSID"
            placeholderTextColor="#8aa0b8"
            autoCapitalize="none"
          />

          <Text style={styles.metaLabel}>WiFi Password</Text>
          <TextInput
            style={styles.input}
            value={wifiPassword}
            onChangeText={setWifiPassword}
            placeholder="Enter WiFi password"
            placeholderTextColor="#8aa0b8"
            secureTextEntry
            autoCapitalize="none"
          />

          <Text style={styles.metaLabel}>Server URL</Text>
          <TextInput
            style={styles.input}
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="http://192.168.1.10:8080"
            placeholderTextColor="#8aa0b8"
            autoCapitalize="none"
          />

          <Text style={styles.metaLabel}>API Token</Text>
          <TextInput
            style={styles.input}
            value={apiToken}
            onChangeText={setApiToken}
            placeholder="Paste device API token"
            placeholderTextColor="#8aa0b8"
            autoCapitalize="none"
          />

          <Pressable
            style={[styles.primaryButton, !canSendConfig && styles.primaryButtonDisabled]}
            onPress={handleSendConfiguration}
            disabled={!canSendConfig}
          >
            {sendingConfig ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Send Configuration</Text>}
          </Pressable>
        </View>
      ) : null}

      {statusMessage ? (
        <View style={[styles.feedbackBox, statusType === "success" ? styles.feedbackSuccess : styles.feedbackError]}>
          <Text style={statusType === "success" ? styles.successText : styles.error}>{statusMessage}</Text>
        </View>
      ) : null}
    </Animated.ScrollView>
  );
}
