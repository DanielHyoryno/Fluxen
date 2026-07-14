import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Calendar } from "react-native-calendars";
import { useAuth } from "../../context/AuthContext";
import { estimateBillApi, listCategoriesApi, listDevicesApi } from "../../services/api";
import styles from "./styles";

function toLocalDateISO(date = new Date()) {
    const tzOffset = date.getTimezoneOffset() * 60000;
    const local = new Date(date.getTime() - tzOffset);
    return local.toISOString().slice(0, 10);
}

function getCurrentMonthRange() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
        from: toLocalDateISO(firstDay),
        to: toLocalDateISO(now),
    };
}

function getDateRange(days) {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));
    return {
        from: toLocalDateISO(start),
        to: toLocalDateISO(end),
    };
}

function getCurrentYearRange() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), 0, 1);
    return {
        from: toLocalDateISO(firstDay),
        to: toLocalDateISO(now),
    };
}

function getRangeFromPreset(preset) {
    if (preset === "day") return getDateRange(1);
    if (preset === "month") return getCurrentMonthRange();
    if (preset === "year") return getCurrentYearRange();
    return getCurrentMonthRange();
}

function formatMoney(value) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 2,
    }).format(Number(value || 0));
}

function shiftDateISO(dateISO, deltaDays) {
    const date = new Date(`${dateISO}T00:00:00`);
    date.setDate(date.getDate() + deltaDays);
    return toLocalDateISO(date);
}

function minDateISO(a, b) {
    return a < b ? a : b;
}

function maxDateISO(a, b) {
    return a > b ? a : b;
}

function formatDeviceLabel(name, location) {
    if (location && String(location).trim()) {
        return `${name} - ${location.trim()}`;
    }

    return name;
}

export default function BillingEstimationScreen({ navigation }) {
    const { token, messages } = useAuth();
    const [loading, setLoading] = useState(true);
    const [estimating, setEstimating] = useState(false);
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

    const [rangePreset, setRangePreset] = useState("month");
    const [range, setRange] = useState(() => getCurrentMonthRange());
    const [pickerVisible, setPickerVisible] = useState(false);
    const [pickerTarget, setPickerTarget] = useState("from");
    const [categories, setCategories] = useState([]);
    const [devices, setDevices] = useState([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState(null);
    const [selectedDeviceIds, setSelectedDeviceIds] = useState([]);
    const [estimate, setEstimate] = useState(null);

    useEffect(() => {
        let mounted = true;

        async function load() {
            try {
                const [categoriesResp, devicesResp] = await Promise.all([
                    listCategoriesApi(token),
                    listDevicesApi(token),
                ]);

                if (!mounted) return;

                const categoryItems = Array.isArray(categoriesResp) ? categoriesResp : categoriesResp?.items || [];
                const deviceItems = Array.isArray(devicesResp) ? devicesResp : devicesResp?.items || [];

                setCategories(categoryItems);
                setDevices(deviceItems);
                setSelectedDeviceIds(deviceItems.map((item) => item.id));

                if (deviceItems.length > 0) {
                    const initialRange = getCurrentMonthRange();
                    const initialEstimate = await estimateBillApi(token, {
                        from: initialRange.from,
                        to: initialRange.to,
                        category_id: null,
                        device_ids: deviceItems.map((item) => item.id),
                    }).catch(() => null);

                    if (mounted && initialEstimate) {
                        setEstimate(initialEstimate);
                    }
                }
            } catch (err) {
                if (mounted) setError(err.message || messages.billing.loadFailed);
            } finally {
                if (mounted) setLoading(false);
            }
        }

        load();
        return () => {
            mounted = false;
        };
    }, [token]);

    const filteredDevices = useMemo(() => {
        if (!selectedCategoryId) return devices;
        return devices.filter((item) => item.category_id === selectedCategoryId);
    }, [devices, selectedCategoryId]);

    const pickerMinDate = useMemo(() => {
        if (pickerTarget === "from") {
            return "2000-01-01";
        }
        return range.from;
    }, [pickerTarget, range.from]);

    const pickerMaxDate = useMemo(() => {
        const today = toLocalDateISO();
        if (pickerTarget === "from") {
            return minDateISO(range.to, today);
        }
        return today;
    }, [pickerTarget, range.to]);

    const pickerEffectiveMinDate = useMemo(() => maxDateISO(pickerMinDate, "2000-01-01"), [pickerMinDate]);
    const pickerEffectiveMaxDate = useMemo(
        () => (pickerMaxDate < pickerEffectiveMinDate ? pickerEffectiveMinDate : pickerMaxDate),
        [pickerEffectiveMinDate, pickerMaxDate]
    );

    function toggleDevice(deviceId) {
        setSelectedDeviceIds((current) =>
            current.includes(deviceId) ? current.filter((id) => id !== deviceId) : [...current, deviceId]
        );
    }

    async function handleApply() {
        setError("");
        setSuccessMsg("");
        setEstimating(true);
        try {
            const result = await estimateBillApi(token, {
                from: range.from,
                to: range.to,
                category_id: selectedCategoryId,
                device_ids: selectedDeviceIds,
            });
            setEstimate(result);
        } catch (err) {
            setEstimate(null);
            setError(err.message || messages.billing.calcFailed);
        } finally {
            setEstimating(false);
        }
    }

    function choosePreset(preset) {
        setRangePreset(preset);
        if (preset === "custom") return;
        setRange(getRangeFromPreset(preset));
    }

    function openCustomPicker(target) {
        setRangePreset("custom");
        setPickerTarget(target);
        setPickerVisible(true);
    }

    function applyPickedDate(dateString) {
        setRange((prev) => {
            if (pickerTarget === "from") {
                const nextTo = dateString > prev.to ? dateString : prev.to;
                return { from: dateString, to: nextTo };
            }

            const nextFrom = dateString < prev.from ? dateString : prev.from;
            return { from: nextFrom, to: dateString };
        });

        setPickerVisible(false);
    }

    if (loading) {
        return (
            <View style={styles.loadingPage}>
                <ActivityIndicator size="large" color="#0f62fe" />
            </View>
        );
    }

    return (
        <ScrollView style={styles.page} contentContainerStyle={styles.content}>
            <Text style={styles.title}>{messages.billing.pageTitle}</Text>
            <Text style={styles.subtitle}>{messages.billing.subtitle}</Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {successMsg ? <Text style={styles.success}>{successMsg}</Text> : null}

            <View style={styles.heroCard}>
                <View style={styles.heroHeader}>
                    <Text style={styles.heroEyebrow}>{messages.billing.currentEstimate}</Text>
                    <Pressable style={styles.heroHeaderAction} onPress={() => navigation.navigate("BillingSettings")}>
                        <Text style={styles.heroHeaderActionText}>{messages.billing.manageWaterPrice}</Text>
                    </Pressable>
                </View>
                <Text style={styles.heroValue}>{formatMoney(estimate?.summary?.estimated_cost)}</Text>
                <View style={styles.heroRangeBlock}>
                    <View style={styles.presetRow}>
                        {[
                            { key: "day", label: messages.billing.day },
                            { key: "month", label: messages.billing.month },
                            { key: "year", label: messages.billing.year },
                            { key: "custom", label: messages.billing.custom },
                        ].map((item) => (
                            <Pressable
                                key={item.key}
                                style={[styles.presetButton, rangePreset === item.key && styles.presetButtonActive]}
                                onPress={() => choosePreset(item.key)}
                            >
                                <Text
                                    style={[
                                        styles.presetButtonText,
                                        rangePreset === item.key && styles.presetButtonTextActive,
                                    ]}
                                >
                                    {item.label}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    {rangePreset === "custom" ? (
                        <View style={styles.row}>
                            <Pressable style={styles.customDateButton} onPress={() => openCustomPicker("from")}>
                                <Text style={styles.customDateLabel}>{messages.billing.from}</Text>
                                <Text style={styles.customDateValue}>{range.from}</Text>
                            </Pressable>
                            <Pressable style={styles.customDateButton} onPress={() => openCustomPicker("to")}>
                                <Text style={styles.customDateLabel}>{messages.billing.to}</Text>
                                <Text style={styles.customDateValue}>{range.to}</Text>
                            </Pressable>
                        </View>
                    ) : (
                        <Text style={styles.rangeText}>
                            {range.from} to {range.to}
                        </Text>
                    )}
                </View>
                <View style={styles.heroStats}>
                    <View style={styles.heroStatBox}>
                        <Text style={styles.heroStatLabel}>{messages.billing.usage}</Text>
                        <Text style={styles.heroStatValue}>
                            {Number(estimate?.summary?.total_liters || 0).toFixed(3)} L
                        </Text>
                    </View>
                    <View style={styles.heroStatBox}>
                        <Text style={styles.heroStatLabel}>{messages.billing.devices}</Text>
                        <Text style={styles.heroStatValue}>{estimate?.summary?.device_count || 0}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>{messages.billing.categoryFilter}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    <Pressable
                        style={[styles.chip, selectedCategoryId === null && styles.chipActive]}
                        onPress={() => setSelectedCategoryId(null)}
                    >
                        <Text style={[styles.chipText, selectedCategoryId === null && styles.chipTextActive]}>
                            {messages.billing.showAll}
                        </Text>
                    </Pressable>
                    {categories.map((category) => (
                        <Pressable
                            key={category.id}
                            style={[styles.chip, selectedCategoryId === category.id && styles.chipActive]}
                            onPress={() => setSelectedCategoryId(category.id)}
                        >
                            <Text
                                style={[styles.chipText, selectedCategoryId === category.id && styles.chipTextActive]}
                            >
                                {category.name}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>{messages.billing.selectDevices}</Text>
                {filteredDevices.map((device) => {
                    const checked = selectedDeviceIds.includes(device.id);
                    return (
                        <Pressable
                            key={device.id}
                            style={[styles.deviceRow, checked && styles.deviceRowChecked]}
                            onPress={() => toggleDevice(device.id)}
                        >
                            <View style={[styles.checkbox, checked && styles.checkboxChecked]} />
                            <View style={styles.deviceInfo}>
                                <Text style={styles.deviceName}>
                                    {formatDeviceLabel(device.device_name, device.install_location)}
                                </Text>
                                <Text style={styles.deviceMeta}>{device.category_name || "Uncategorized"}</Text>
                            </View>
                        </Pressable>
                    );
                })}

                <Pressable
                    style={[styles.button, estimating && styles.buttonDisabled]}
                    onPress={handleApply}
                    disabled={estimating}
                >
                    {estimating ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>{messages.billing.apply}</Text>
                    )}
                </Pressable>
            </View>

            {estimate ? (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>{messages.billing.estimateByDevice}</Text>
                    <View style={styles.resultList}>
                        {(estimate.items || []).map((item) => (
                            <View key={item.device_id} style={styles.resultRow}>
                                <View style={styles.deviceInfo}>
                                    <Text style={styles.deviceName}>
                                        {formatDeviceLabel(item.device_name, item.install_location)}
                                    </Text>
                                    <Text style={styles.deviceMeta}>{Number(item.total_liters || 0).toFixed(3)} L</Text>
                                </View>
                                <Text style={styles.resultCost}>{formatMoney(item.estimated_cost)}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            ) : null}

            <Modal
                transparent
                visible={pickerVisible}
                animationType="fade"
                onRequestClose={() => setPickerVisible(false)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>
                            {pickerTarget === "from" ? messages.billing.pickStartDate : messages.billing.pickEndDate}
                        </Text>
                        <Calendar
                            minDate={pickerEffectiveMinDate}
                            maxDate={pickerEffectiveMaxDate}
                            disableAllTouchEventsForDisabledDays
                            markedDates={{
                                [range.from]: {
                                    selected: true,
                                    selectedColor: "#0f62fe",
                                },
                                ...(range.to !== range.from
                                    ? {
                                          [range.to]: {
                                              selected: true,
                                              selectedColor: "#0f62fe",
                                          },
                                      }
                                    : {}),
                            }}
                            onDayPress={(day) => applyPickedDate(day.dateString)}
                        />
                        {Platform.OS === "web" ? (
                            <Text style={styles.helperText}>{messages.billing.webDateHint}</Text>
                        ) : null}
                        <View style={styles.modalActions}>
                            <Pressable style={styles.modalCloseButton} onPress={() => setPickerVisible(false)}>
                                <Text style={styles.modalCloseText}>{messages.billing.close}</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}
