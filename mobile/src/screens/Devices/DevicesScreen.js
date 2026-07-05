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
import { useWindowDimensions } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { createDeviceApi, deleteDeviceApi, listCategoriesApi, listDevicesApi } from "../../services/api";
import ConfirmDialog from "../../components/ConfirmDialog";
import SkeletonBlock from "../../components/SkeletonBlock";
import useScreenEntranceAnimation from "../../hooks/useScreenEntranceAnimation";
import styles from "./styles";

const AUTO_REFRESH_MS = 5000;

function DeviceCard({ item, onRequestDelete, messages, isEmbedded, isLast }) {
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
    <View style={[styles.card, isEmbedded && styles.cardEmbedded, isEmbedded && !isLast && styles.cardEmbeddedWithDivider]}>
      <View style={styles.deviceRowCompact}>
        <View style={styles.deviceRowLeft}>
          <View style={[styles.statusDot, online ? styles.statusOnline : styles.statusOffline]} />
          <View style={styles.deviceTitleBlock}>
            <Text style={styles.deviceName}>{item.device_name}</Text>
            <Text style={styles.deviceMetaInline}>{messages.devices.codeLabel}: {item.device_code}</Text>
            <Text style={styles.deviceMetaInline}>
              {messages.devices.categoryLabel}: {item.category_name || messages.devices.uncategorized}
            </Text>
          </View>
        </View>

        <View style={styles.deviceRowRight}>
          <Text style={[styles.statusTextCompact, online ? styles.statusTextOnline : styles.statusTextOffline]}>
            {online ? messages.devices.online : messages.devices.offline}
          </Text>
          <Pressable
            style={styles.deleteButton}
            onPress={(event) => {
              event?.stopPropagation?.();
              onRequestDelete(item);
            }}
          >
            <Text style={styles.deleteButtonText}>{messages.devices.deleteButton}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function DevicesScreen({ navigation }) {
  const { token, user, messages } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const { animatedStyle } = useScreenEntranceAnimation();
  const isCompactHeader = screenWidth < 430;
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
  const [fieldErrors, setFieldErrors] = useState({});
  const [activeSection, setActiveSection] = useState("list");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState(null);
  const sectionOpacity = useRef(new Animated.Value(1)).current;
  const sectionTranslateY = useRef(new Animated.Value(0)).current;

  function switchSection(nextSection) {
    if (nextSection === activeSection) return;

    Animated.parallel([
      Animated.timing(sectionOpacity, {
        toValue: 0,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(sectionTranslateY, {
        toValue: 8,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setActiveSection(nextSection);
      sectionTranslateY.setValue(-8);
      Animated.parallel([
        Animated.timing(sectionOpacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(sectionTranslateY, {
          toValue: 0,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    });
  }

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
          if (mounted) setError(err.message || messages.devices.loadFailed);
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
      setError(err.message || messages.devices.refreshFailed);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleCreateDevice() {
    const nextFieldErrors = {};
    const trimmedDeviceCode = deviceCode.trim();
    const trimmedDeviceName = deviceName.trim();
    const trimmedLocation = location.trim();

    if (trimmedDeviceCode.length < 3) {
      nextFieldErrors.deviceCode = messages.devices.minDeviceCodeError;
    }

    if (trimmedDeviceName.length < 2) {
      nextFieldErrors.deviceName = messages.devices.minDeviceNameError;
    }

    if (trimmedLocation.length > 150) {
      nextFieldErrors.location = messages.devices.maxLocationError;
    }

    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) {
      return;
    }

    setCreating(true);
    setError("");
    setNewToken("");
    try {
      const data = await createDeviceApi(token, {
        device_code: trimmedDeviceCode,
        device_name: trimmedDeviceName,
        install_location: trimmedLocation || undefined,
        category_id: selectedCategoryId,
      });

      setDeviceCode("");
      setDeviceName("");
      setLocation("");
      setFieldErrors({});
      setSelectedCategoryId(null);
      setNewToken(data.api_token || "");
      setTokenDialogOpen(Boolean(data.api_token));
      await loadDevices();
    } catch (err) {
      if (String(err.message || "").toLowerCase().includes("device_code already used")) {
        setFieldErrors({ deviceCode: messages.devices.duplicateDeviceCodeError });
      }
      setError(err.message || messages.devices.createFailed);
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
      setError(err.message || messages.devices.deleteFailed);
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
    Alert.alert(messages.devices.copiedTitle, messages.devices.copiedMessage);
  }

  const filteredItems = items.filter((item) => {
    const statusMatch =
      statusFilter === "all" ||
      (statusFilter === "online" && item.status === "online") ||
      (statusFilter === "offline" && item.status !== "online");

    const categoryMatch =
      categoryFilter === null
        ? true
        : categoryFilter === "uncategorized"
          ? !item.category_id
          : item.category_id === categoryFilter;

    return statusMatch && categoryMatch;
  });

  return (
    <View style={styles.page}>
      <FlatList
        style={styles.list}
        data={[]}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={(
          <Animated.View style={animatedStyle}>
            <View style={[styles.header, isCompactHeader && styles.headerStacked]}>
              <View style={styles.headerTitleBlock}>
                <Text style={styles.title} numberOfLines={2}>{messages.devices.pageTitle}</Text>
                <Text style={styles.subtitle}>{messages.devices.pageSubtitle}</Text>
              </View>
            </View>

            <View style={styles.scanHeroCard}>
              <View style={styles.scanHeroTextWrap}>
                <Text style={styles.scanHeroTitle}>{messages.devices.prepareDeviceTitle}</Text>
                <Text style={styles.scanHeroSubtitle}>{messages.devices.prepareDeviceSubtitle}</Text>
              </View>
              <Pressable style={styles.scanHeroButton} onPress={() => navigation.navigate("BLEScan")}>
                <Text style={styles.scanHeroButtonText}>{messages.devices.scanBle}</Text>
              </Pressable>
            </View>

            <View style={styles.sectionSwitchWrap}>
              <Pressable
                style={[styles.sectionSwitchButton, activeSection === "list" && styles.sectionSwitchButtonActive]}
                onPress={() => switchSection("list")}
              >
                <Text style={[styles.sectionSwitchText, activeSection === "list" && styles.sectionSwitchTextActive]}>{messages.devices.listTab}</Text>
              </Pressable>
              <Pressable
                style={[styles.sectionSwitchButton, activeSection === "manage" && styles.sectionSwitchButtonActive]}
                onPress={() => switchSection("manage")}
              >
                <Text style={[styles.sectionSwitchText, activeSection === "manage" && styles.sectionSwitchTextActive]}>{messages.devices.manageTab}</Text>
              </Pressable>
            </View>

            <Animated.View
              style={{
                opacity: sectionOpacity,
                transform: [{ translateY: sectionTranslateY }],
              }}
            >
              {activeSection === "list" ? (
                <View style={styles.listSectionCard}>
                  <View style={styles.listStatusCard}>
                  <Text style={styles.createTitle}>{messages.devices.listFilterTitle}</Text>
                    <Text style={styles.filterGroupLabel}>{messages.devices.statusLabel}</Text>
                    <View style={styles.filterChipRowCompact}>
                      {[
                        { key: "all", label: messages.home.all },
                        { key: "online", label: messages.home.online },
                        { key: "offline", label: messages.home.offline },
                      ].map((item) => {
                        const active = statusFilter === item.key;
                        return (
                          <Pressable
                            key={item.key}
                            style={[styles.filterChip, active && styles.filterChipActive]}
                            onPress={() => setStatusFilter(item.key)}
                          >
                            <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{item.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    <Text style={styles.filterGroupLabel}>{messages.devices.categoryFilterLabel}</Text>
                  <FlatList
                    data={[
                        { id: null, name: messages.home.all },
                        { id: "uncategorized", name: messages.devices.uncategorized },
                        ...categories,
                      ]}
                      keyExtractor={(item, index) => String(item.id ?? `all-${index}`)}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.filterChipRowCompact}
                      renderItem={({ item }) => {
                        const active = categoryFilter === item.id;
                        return (
                          <Pressable style={[styles.categoryChip, active && styles.categoryChipActive]} onPress={() => setCategoryFilter(item.id)}>
                            <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>{item.name}</Text>
                          </Pressable>
                        );
                      }}
                    />
                    <View style={styles.listSectionDivider} />

                    {loading ? (
                      <View style={styles.listSkeletonWrap}>
                        <SkeletonBlock width="100%" height={58} />
                        <SkeletonBlock width="100%" height={58} />
                        <SkeletonBlock width="100%" height={58} />
                      </View>
                    ) : null}
                    {!loading && filteredItems.length === 0 ? <Text style={styles.empty}>{messages.devices.noDevicesYet}</Text> : null}

                    {!loading
                      ? filteredItems.map((item, index) => (
                          <Pressable
                            key={String(item.id)}
                            onPress={() => navigation.navigate("DeviceDashboard", { device: item })}
                            style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.985 : 1 }] }]}
                          >
                            <DeviceCard
                              item={item}
                              onRequestDelete={handleRequestDeleteDevice}
                              messages={messages}
                              isEmbedded
                              isLast={index === filteredItems.length - 1}
                            />
                          </Pressable>
                        ))
                      : null}
                  </View>
                </View>
              ) : null}

              {activeSection === "manage" ? (
                <>
                  <View style={styles.categoryBox}>
                    <Text style={styles.createTitle}>{messages.devices.categoryTitle}</Text>
                <Text style={styles.categoryHelpText}>{messages.devices.categoryHelp}</Text>
                    <Pressable style={styles.manageCategoryButton} onPress={() => navigation.navigate("ManageCategory") }>
                      <Text style={styles.manageCategoryButtonText}>{messages.devices.manageCategory}</Text>
                    </Pressable>
                  </View>

                  <View style={styles.createBox}>
                    <Text style={styles.createTitle}>{messages.devices.addDeviceTitle}</Text>
                    <TextInput
                      style={[styles.input, fieldErrors.deviceCode && styles.inputError]}
                      value={deviceCode}
                      onChangeText={(value) => {
                        setDeviceCode(value);
                        if (fieldErrors.deviceCode) {
                          setFieldErrors((prev) => ({ ...prev, deviceCode: undefined }));
                        }
                      }}
                      placeholder={messages.devices.deviceCodePlaceholder}
                      placeholderTextColor="#8aa0b8"
                      autoCapitalize="characters"
                    />
                    {fieldErrors.deviceCode ? <Text style={styles.fieldError}>{fieldErrors.deviceCode}</Text> : null}
                    <TextInput
                      style={[styles.input, fieldErrors.deviceName && styles.inputError]}
                      value={deviceName}
                      onChangeText={(value) => {
                        setDeviceName(value);
                        if (fieldErrors.deviceName) {
                          setFieldErrors((prev) => ({ ...prev, deviceName: undefined }));
                        }
                      }}
                      placeholder={messages.devices.deviceNamePlaceholder}
                      placeholderTextColor="#8aa0b8"
                    />
                    {fieldErrors.deviceName ? <Text style={styles.fieldError}>{fieldErrors.deviceName}</Text> : null}
                    <TextInput
                      style={[styles.input, fieldErrors.location && styles.inputError]}
                      value={location}
                      onChangeText={(value) => {
                        setLocation(value);
                        if (fieldErrors.location) {
                          setFieldErrors((prev) => ({ ...prev, location: undefined }));
                        }
                      }}
                      placeholder={messages.devices.locationPlaceholder}
                      placeholderTextColor="#8aa0b8"
                    />
                    {fieldErrors.location ? <Text style={styles.fieldError}>{fieldErrors.location}</Text> : null}

                    <Text style={styles.categoryLabel}>{messages.devices.assignCategory}</Text>
                    <FlatList
                      data={[{ id: null, name: messages.devices.uncategorized }, ...categories]}
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
                      {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{messages.devices.createDevice}</Text>}
                    </Pressable>
                    {newToken ? <Text style={styles.meta}>{messages.devices.newTokenHint}</Text> : null}
                    {newToken ? (
                      <Pressable style={styles.showTokenButton} onPress={() => setTokenDialogOpen(true)}>
                        <Text style={styles.showTokenButtonText}>{messages.devices.showApiToken}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </>
              ) : null}
            </Animated.View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {activeSection !== "list" && loading ? <ActivityIndicator style={styles.loading} /> : null}
          </Animated.View>
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponentStyle={activeSection === "list" ? undefined : styles.listHeaderManageOnly}
      />

      <Modal transparent visible={tokenDialogOpen} animationType="fade" onRequestClose={() => setTokenDialogOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{messages.devices.tokenTitle}</Text>
            <Text style={styles.modalSubtitle}>{messages.devices.tokenSubtitle}</Text>
            <View style={styles.tokenBox}>
              <Text style={styles.tokenValue} selectable>
                {newToken}
              </Text>
            </View>
            <View style={styles.modalActions}>
              <Pressable style={styles.copyTokenButton} onPress={handleCopyToken}>
                <Text style={styles.copyTokenButtonText}>{messages.auth.copyToken || "Copy Token"}</Text>
              </Pressable>
              <Pressable style={styles.closeDialogButton} onPress={() => setTokenDialogOpen(false)}>
                <Text style={styles.closeDialogButtonText}>{messages.devices.tokenClose}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={Boolean(pendingDeleteDevice)}
        title={messages.devices.deleteDialogTitle}
        message={messages.devices.deleteDialogMessage}
        confirmText={messages.devices.confirmYes}
        cancelText={messages.devices.confirmNo}
        onCancel={() => setPendingDeleteDevice(null)}
        onConfirm={handleConfirmDeleteDevice}
      />
    </View>
  );
}
