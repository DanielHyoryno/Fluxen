import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Alert,
  Easing,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../../context/AuthContext";
import { createDeviceApi, deleteDeviceApi, listCategoriesApi, listDevicesApi } from "../../services/api";
import ConfirmDialog from "../../components/ConfirmDialog";
import styles from "./styles";

const AUTO_REFRESH_MS = 5000;

function DeviceCard({ item, onRequestDelete }) {
  const online = item.status === "online";
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!online) {
      pulse.stopAnimation();
      pulse.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.72,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [online, pulse]);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.deviceName}>{item.device_name}</Text>
        <View style={styles.statusWrap}>
          {online ? <Animated.View style={[styles.liveDot, { opacity: pulse }]} /> : null}
          <Text style={[styles.statusBadge, online ? styles.statusOnline : styles.statusOffline]}>
            {online ? "ONLINE" : "OFFLINE"}
          </Text>
        </View>
      </View>
      <Text style={styles.meta}>Code: {item.device_code}</Text>
      <Text style={styles.meta}>Category: {item.category_name || "Uncategorized"}</Text>
      <Text style={styles.meta}>Location: {item.install_location || "-"}</Text>
      <Text style={styles.meta}>Firmware: {item.firmware_version || "-"}</Text>
      <Pressable
        style={styles.deleteButton}
        onPress={(event) => {
          event?.stopPropagation?.();
          onRequestDelete(item);
        }}
      >
        <Text style={styles.deleteButtonText}>Delete</Text>
      </Pressable>
    </View>
  );
}

export default function DevicesScreen({ navigation }) {
  const { token, user, logout } = useAuth();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [deviceCode, setDeviceCode] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [location, setLocation] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState("");
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [pendingDeleteDevice, setPendingDeleteDevice] = useState(null);
  const entryOpacity = useRef(new Animated.Value(0)).current;
  const entryTranslateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(entryOpacity, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(entryTranslateY, {
        toValue: 0,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [entryOpacity, entryTranslateY]);

  const loadDevices = useCallback(async () => {
    setError("");
    const data = await listDevicesApi(token);
    setItems(data.items || []);
  }, [token]);

  const loadCategories = useCallback(async () => {
    try {
      const data = await listCategoriesApi(token);
      setCategories(data.items || []);
    } catch (err) {
      if (String(err.message || "").toLowerCase().includes("category schema is not ready")) {
        setCategories([]);
        return;
      }
      throw err;
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      async function run() {
        setLoading(true);
        try {
          await Promise.all([loadDevices(), loadCategories()]);
        } catch (err) {
          if (mounted) setError(err.message || "Failed to load devices");
        } finally {
          if (mounted) setLoading(false);
        }
      }
      run();

      const interval = setInterval(async () => {
        if (!mounted) return;
        try {
          await loadDevices();
        } catch (_) {
          // silent on background refresh failures
        }
      }, AUTO_REFRESH_MS);

      return () => {
        mounted = false;
        clearInterval(interval);
      };
    }, [loadCategories, loadDevices])
  );

  async function onRefresh() {
    setRefreshing(true);
    setError("");
    try {
      await loadDevices();
    } catch (err) {
      setError(err.message || "Failed to refresh devices");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleCreateDevice() {
    setCreating(true);
    setError("");
    setNewToken("");
    try {
      const data = await createDeviceApi(token, {
        device_code: deviceCode.trim(),
        device_name: deviceName.trim(),
        install_location: location.trim() || undefined,
        category_id: selectedCategoryId,
      });

      setDeviceCode("");
      setDeviceName("");
      setLocation("");
      setSelectedCategoryId(null);
      setNewToken(data.api_token || "");
      setTokenDialogOpen(Boolean(data.api_token));
      await loadDevices();
    } catch (err) {
      setError(err.message || "Failed to create device");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteDevice(deviceId) {
    setError("");
    try {
      await deleteDeviceApi(token, deviceId);
      await loadDevices();
    } catch (err) {
      setError(err.message || "Failed to delete device");
    }
  }

  function handleRequestDeleteDevice(item) {
    setPendingDeleteDevice(item);
  }

  async function handleConfirmDeleteDevice() {
    const current = pendingDeleteDevice;
    setPendingDeleteDevice(null);
    if (!current) return;
    await handleDeleteDevice(current.id);
  }

  async function handleCopyToken() {
    if (!newToken) return;
    await Clipboard.setStringAsync(newToken);
    Alert.alert("Copied", "API token copied to clipboard");
  }

  return (
    <Animated.View
      style={[
        styles.page,
        {
          opacity: entryOpacity,
          transform: [{ translateY: entryTranslateY }],
        },
      ]}
    >
      <FlatList
        style={styles.list}
        data={loading ? [] : items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate("DeviceDashboard", { device: item })}
            style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.985 : 1 }] }]}
          >
            <DeviceCard item={item} onRequestDelete={handleRequestDeleteDevice} />
          </Pressable>
        )}
        ListHeaderComponent={(
          <>
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>My Devices</Text>
                <Text style={styles.subtitle}>{user?.full_name || "User"}</Text>
              </View>
              <View style={styles.headerActions}>
                <Pressable style={styles.scanButton} onPress={() => navigation.navigate("BLEScan")}>
                  <Text style={styles.scanText}>Scan BLE</Text>
                </Pressable>
                <Pressable style={styles.logoutButton} onPress={logout}>
                  <Text style={styles.logoutText}>Logout</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.categoryBox}>
              <Text style={styles.createTitle}>Category</Text>
              <Text style={styles.categoryHelpText}>Manage IoT categories in a dedicated page.</Text>
              <Pressable style={styles.manageCategoryButton} onPress={() => navigation.navigate("ManageCategory")}>
                <Text style={styles.manageCategoryButtonText}>Manage Category</Text>
              </Pressable>
            </View>

            <View style={styles.createBox}>
              <Text style={styles.createTitle}>Add Device</Text>
              <TextInput
                style={styles.input}
                value={deviceCode}
                onChangeText={setDeviceCode}
                placeholder="Device code (e.g. BV-ESP32-01)"
                placeholderTextColor="#8aa0b8"
                autoCapitalize="characters"
              />
              <TextInput
                style={styles.input}
                value={deviceName}
                onChangeText={setDeviceName}
                placeholder="Device name"
                placeholderTextColor="#8aa0b8"
              />
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="Location (optional)"
                placeholderTextColor="#8aa0b8"
              />

              <Text style={styles.categoryLabel}>Assign Category</Text>
              <FlatList
                data={[{ id: null, name: "Uncategorized" }, ...categories]}
                keyExtractor={(item, index) => String(item.id ?? `uncat-${index}`)}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryChipRow}
                renderItem={({ item }) => {
                  const active = selectedCategoryId === item.id;
                  return (
                    <Pressable style={[styles.categoryChip, active && styles.categoryChipActive]} onPress={() => setSelectedCategoryId(item.id)}>
                      <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>{item.name}</Text>
                    </Pressable>
                  );
                }}
              />

              <Pressable style={styles.primaryButton} onPress={handleCreateDevice} disabled={creating}>
                {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Create Device</Text>}
              </Pressable>
              {newToken ? <Text style={styles.meta}>New token created. Open dialog to copy.</Text> : null}
              {newToken ? (
                <Pressable style={styles.showTokenButton} onPress={() => setTokenDialogOpen(true)}>
                  <Text style={styles.showTokenButtonText}>Show API Token</Text>
                </Pressable>
              ) : null}
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {loading ? <ActivityIndicator style={styles.loading} /> : null}
          </>
        )}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No devices yet</Text> : null}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />

      <Modal transparent visible={tokenDialogOpen} animationType="fade" onRequestClose={() => setTokenDialogOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New API Token</Text>
            <Text style={styles.modalSubtitle}>Save this token and use it in BLE provisioning.</Text>
            <View style={styles.tokenBox}>
              <Text style={styles.tokenValue} selectable>
                {newToken}
              </Text>
            </View>
            <View style={styles.modalActions}>
              <Pressable style={styles.copyTokenButton} onPress={handleCopyToken}>
                <Text style={styles.copyTokenButtonText}>Copy Token</Text>
              </Pressable>
              <Pressable style={styles.closeDialogButton} onPress={() => setTokenDialogOpen(false)}>
                <Text style={styles.closeDialogButtonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={Boolean(pendingDeleteDevice)}
        title="Delete Device"
        message="Are you sure you want to delete this device? All telemetry data will be lost."
        confirmText="Delete"
        cancelText="Cancel"
        onCancel={() => setPendingDeleteDevice(null)}
        onConfirm={handleConfirmDeleteDevice}
      />
    </Animated.View>
  );
}
