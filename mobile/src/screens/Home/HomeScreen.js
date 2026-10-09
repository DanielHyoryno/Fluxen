import { formatValue, getLanguageTag, t, useLocale } from "../../services/i18n";
import FailureNotice from "../../components/FailureNotice";
import { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    Alert,
    FlatList,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    useWindowDimensions,
    View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Calendar from "../../components/LocalizedCalendar";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import { useAuth } from "../../context/AuthContext";
import {
    billingSettingsApi,
    dailyTelemetryApi,
    estimateBillApi,
    listDevicesApi,
    latestTelemetryApi,
    usageHistoryApi,
} from "../../services/api";
import SkeletonBlock from "../../components/SkeletonBlock";
import useScreenEntranceAnimation from "../../hooks/useScreenEntranceAnimation";
import styles from "./styles";
import MetricGrid from "../../components/MetricGrid";
import StatusBadge from "../../components/StatusBadge";
import PeriodSelector from "../../components/PeriodSelector";
import usePageInsets from "../../hooks/usePageInsets";

const OFFLINE_THRESHOLD_SEC = 120;

function toLocalDateISO(date = new Date()) {
    const tzOffset = date.getTimezoneOffset() * 60000;
    const local = new Date(date.getTime() - tzOffset);
    return local.toISOString().slice(0, 10);
}

function formatNumber(value, decimals = 2) {
    return formatValue(value, decimals);
}

function formatDayOnlyLabel(dateKey) {
    const date = new Date(`${dateKey}T00:00:00`);
    return String(date.getDate());
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

function getRangeFromPreset(preset) {
    if (preset === "month") {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        return {
            from: toLocalDateISO(firstDay),
            to: toLocalDateISO(now),
        };
    }

    const map = {
        day: 1,
        week: 7,
    };

    const days = map[preset] || 7;
    return getDateRange(days);
}

function diffDaysInclusive(from, to) {
    const start = new Date(`${from}T00:00:00`).getTime();
    const end = new Date(`${to}T00:00:00`).getTime();
    const diff = Math.floor((end - start) / (24 * 60 * 60 * 1000));
    return diff + 1;
}

function getDateKeysBetween(from, to) {
    const out = [];
    const start = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T00:00:00`);
    const cursor = new Date(start);

    while (cursor <= end) {
        out.push(toLocalDateISO(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }

    return out;
}

function shiftDateISO(dateISO, deltaDays) {
    const date = new Date(`${dateISO}T00:00:00`);
    date.setDate(date.getDate() + deltaDays);
    return toLocalDateISO(date);
}

function maxDateISO(a, b) {
    return a > b ? a : b;
}

function minDateISO(a, b) {
    return a < b ? a : b;
}

function formatRupiah(value) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 2,
    }).format(Number(value || 0));
}

export function OverallUsageChart({ series, messages, chartWidth }) {
    const { fontScale, width: screenWidth } = useWindowDimensions();
    if (!series.length) return <Text style={styles.emptyText}>{messages.home.emptyTotalTrend}</Text>;

    const viewportWidth = Number.isFinite(chartWidth) && chartWidth > 0
        ? chartWidth
        : Math.max(1, screenWidth - 64);
    const trackHeight = 120;
    const maxValue = series.reduce((max, item) => Math.max(max, Number(item.totalLiters || 0)), 0);
    const chartMax = maxValue > 0 ? maxValue : 1;
    const minSlotWidth = Math.ceil(30 * fontScale);
    const interBarGap = 6;
    const requiredWidth = series.length * minSlotWidth + Math.max(0, series.length - 1) * interBarGap;
    const shouldScroll = requiredWidth > viewportWidth;
    const contentWidth = Math.max(requiredWidth, viewportWidth);
    const slotWidth = (contentWidth - (series.length - 1) * interBarGap) / series.length;
    const labelHeight = (series.length > 10 ? 20 : 36) * fontScale;
    const contentHeight = trackHeight + 6 + labelHeight;
    const rowStyle = { flexDirection: "row", gap: interBarGap, width: contentWidth, height: contentHeight, alignItems: "flex-start" };

    const bars = series.map((item) => {
        const value = Number(item.totalLiters || 0);
        const fillHeight = value > 0 ? Math.max((value / chartMax) * trackHeight, 3) : 0;
        const date = new Date(`${item.date}T00:00:00`);
        const labelText = series.length > 10 ? formatDayOnlyLabel(item.date)
            : `${date.getDate()}\n${date.toLocaleDateString(getLanguageTag(), { month: "short" })}`;

        return (
            <View
                key={item.date}
                testID={`usage-bar-${item.date}`}
                style={{ width: slotWidth, height: contentHeight, flexShrink: 0, alignItems: "center" }}
            >
                <View
                    testID={`usage-track-${item.date}`}
                    style={[styles.overallBarTrack, { width: slotWidth, height: trackHeight }]}
                >
                    <View testID={`usage-fill-${item.date}`} style={[styles.overallBarFill, { height: fillHeight }]} />
                </View>
                <Text numberOfLines={series.length > 10 ? 1 : 2} style={[styles.overallBarLabel, { height: labelHeight }]}>{labelText}</Text>
            </View>
        );
    });

    return (
        <View testID="usage-chart" style={[styles.overallChartWrap, { height: contentHeight, flexShrink: 0 }]}>
            {shouldScroll ? (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    testID="usage-bars-scroll"
                    style={{ width: viewportWidth, height: contentHeight, flexGrow: 0, flexShrink: 0 }}
                    contentContainerStyle={rowStyle}
                >
                    {bars}
                </ScrollView>
            ) : (
                <View style={rowStyle}>{bars}</View>
            )}
        </View>
    );
}

function DayHourlyLineChart({ series, chartWidth, messages }) {
    if (!series.length) return <Text style={styles.emptyText}>{messages.home.emptyHourlyUsage}</Text>;

    const width = Math.max(220, chartWidth);
    const height = 150;
    const maxValue = series.reduce((max, item) => Math.max(max, Number(item.totalLiters || 0)), 0);
    const chartMax = maxValue > 0 ? maxValue : 1;

    const points = series
        .map((item, idx) => {
            const x = series.length <= 1 ? width / 2 : (idx / (series.length - 1)) * width;
            const y = height - (Number(item.totalLiters || 0) / chartMax) * height;
            return `${x},${y}`;
        })
        .join(" ");

    const labelIndexes = [0, 6, 12, 18, 23];

    return (
        <View style={styles.overallChartWrap}>
            <View style={styles.dayLineChartBox}>
                <Svg width={width} height={height}>
                    <Line x1="0" y1={height} x2={width} y2={height} stroke="#dbe6f5" strokeWidth="1" />
                    <Line x1="0" y1="0" x2="0" y2={height} stroke="#dbe6f5" strokeWidth="1" />
                    <Polyline fill="none" stroke="#0f62fe" strokeWidth="2.5" points={points} />
                    {series.map((item, idx) => {
                        const x = series.length <= 1 ? width / 2 : (idx / (series.length - 1)) * width;
                        const y = height - (Number(item.totalLiters || 0) / chartMax) * height;
                        return <Circle key={`hour-pt-${item.hour}`} cx={x} cy={y} r="2.8" fill="#0f62fe" />;
                    })}
                </Svg>
            </View>
            <View style={styles.dayLineLabels}>
                {labelIndexes.map((idx) => (
                    <Text key={`hour-label-${idx}`} style={styles.dayLineLabel}>
                        {String(idx).padStart(2, "0")}:00
                    </Text>
                ))}
            </View>
            <Text style={styles.rangeMeta}>{messages.home.hourlyTotalUsage}</Text>
        </View>
    );
}

function UsageByDeviceChart({ items, messages }) {
    if (!items.length) return <Text style={styles.emptyText}>{messages.home.noDevicesInFilter}</Text>;

    const maxValue = items.reduce((max, item) => Math.max(max, item.usageLiters), 0);
    const chartMax = maxValue > 0 ? maxValue : 1;

    return (
        <View style={styles.chartWrap}>
            {items.map((item) => {
                const fillPct = Math.round((item.usageLiters / chartMax) * 100);
                return (
                    <View key={item.id} style={styles.chartRow}>
                        <Text numberOfLines={1} style={styles.chartLabel}>
                            {item.device_name}
                        </Text>
                        <View style={styles.chartTrack}>
                            <View
                                style={[
                                    styles.chartFill,
                                    { width: `${Math.max(fillPct, item.usageLiters > 0 ? 6 : 0)}%` },
                                ]}
                            />
                        </View>
                        <Text style={styles.chartValue}>{formatNumber(item.usageLiters, 3)} L</Text>
                    </View>
                );
            })}
        </View>
    );
}

function UsageByCategoryChart({ items, messages }) {
    if (!items.length) return <Text style={styles.emptyText}>{messages.home.noDevicesInFilter}</Text>;

    const maxValue = items.reduce((max, item) => Math.max(max, item.totalLiters), 0);
    const chartMax = maxValue > 0 ? maxValue : 1;

    return (
        <View style={styles.chartWrap}>
            {items.map((item) => {
                const fillPct = Math.round((item.totalLiters / chartMax) * 100);
                return (
                    <View key={item.categoryName} style={styles.chartRow}>
                        <Text numberOfLines={1} style={styles.chartLabel}>
                            {item.categoryName}
                        </Text>
                        <View style={styles.chartTrack}>
                            <View
                                style={[
                                    styles.chartFillCategory,
                                    { width: `${Math.max(fillPct, item.totalLiters > 0 ? 6 : 0)}%` },
                                ]}
                            />
                        </View>
                        <Text style={styles.chartValue}>{formatNumber(item.totalLiters, 3)} L</Text>
                    </View>
                );
            })}
        </View>
    );
}

function HoverablePressable({ onPress, style, children, disabled, hoverStyle, containerStyle }) {
    const [hovered, setHovered] = useState(false);

    const resolvedHoverStyle = hovered ? hoverStyle : null;

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            onHoverIn={() => setHovered(true)}
            onHoverOut={() => setHovered(false)}
            accessibilityRole="button"
            style={({ pressed }) => [containerStyle, (disabled || pressed) && { opacity: 0.7 }]}
        >
            <View style={[style, resolvedHoverStyle]}>{children}</View>
        </Pressable>
    );
}

export default function HomeScreen({ navigation }) {
    useLocale();
    const { token, messages } = useAuth();
    const { width: screenWidth } = useWindowDimensions();
    const pageInsets = usePageInsets();
    const [trendWidth, setTrendWidth] = useState(Math.max(220, screenWidth - 62));
    const { animatedStyle } = useScreenEntranceAnimation();
    const [loading, setLoading] = useState(true);
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [filter, setFilter] = useState("all");
    const [rangePreset, setRangePreset] = useState("week");
    const [range, setRange] = useState(() => getRangeFromPreset("week"));
    const [pickerVisible, setPickerVisible] = useState(false);
    const [pickerTarget, setPickerTarget] = useState("from");
    const [deviceRows, setDeviceRows] = useState([]);
    const [overallSeries, setOverallSeries] = useState([]);
    const [billingPreview, setBillingPreview] = useState(null);

    const loadHome = useCallback(async () => {
        setError("");
        const today = toLocalDateISO();
        const dateKeys = getDateKeysBetween(range.from, range.to);
        const devicesResp = await listDevicesApi(token);
        const devices = Array.isArray(devicesResp) ? devicesResp : devicesResp?.items || [];
        const isDayPreset = rangePreset === "day";

        const aggregateByDate = dateKeys.reduce((acc, key) => {
            acc[key] = 0;
            return acc;
        }, {});
        const aggregateByHour = Array.from({ length: 24 }, () => 0);

        const rows = await Promise.all(
            devices.map(async (device) => {
                const [latest, usageResp, dailyResp] = await Promise.all([
                    latestTelemetryApi(token, device.device_code).catch((err) => { if (err.code === "NOT_FOUND") return null; throw err; }),
                    isDayPreset
                        ? Promise.resolve(null)
                        : usageHistoryApi(token, device.device_code, range.from, range.to),
                    isDayPreset
                        ? dailyTelemetryApi(token, device.device_code, today)
                        : Promise.resolve(null),
                ]);

                let usageLiters = 0;

                if (isDayPreset) {
                    const dailyItems = Array.isArray(dailyResp) ? dailyResp : dailyResp?.items || [];
                    for (const item of dailyItems) {
                        const delta = Number(item.volume_delta_l || 0);
                        usageLiters += delta;
                        const measuredAt = item.measured_at ? new Date(item.measured_at) : null;
                        if (measuredAt && !Number.isNaN(measuredAt.getTime())) {
                            const hour = measuredAt.getHours();
                            aggregateByHour[hour] = Number(aggregateByHour[hour] || 0) + delta;
                        }
                    }
                } else {
                    const usageItems = Array.isArray(usageResp) ? usageResp : usageResp?.items || [];
                    const usageByDate = usageItems.reduce((map, item) => {
                        const dateKey = String(item.date || "").slice(0, 10);
                        if (!dateKey) return map;
                        map[dateKey] = Number(map[dateKey] || 0) + Number(item.total_liters || 0);
                        return map;
                    }, {});

                    for (const key of dateKeys) {
                        aggregateByDate[key] = Number(aggregateByDate[key] || 0) + Number(usageByDate[key] || 0);
                    }

                    usageLiters = dateKeys.reduce((sum, key) => sum + Number(usageByDate[key] || 0), 0);
                }

                const latestAt = latest?.measured_at ? new Date(latest.measured_at).getTime() : null;
                const ageSec = latestAt ? Math.floor((Date.now() - latestAt) / 1000) : Number.POSITIVE_INFINITY;
                const onlineByTelemetry = ageSec <= OFFLINE_THRESHOLD_SEC;
                const statusLabel = String(device.status || device.device_status || "").toLowerCase();
                const online = statusLabel === "online" || onlineByTelemetry;

                return {
                    ...device,
                    usageLiters,
                    online,
                    latestAt: latest?.measured_at || null,
                };
            })
        );

        setDeviceRows(rows);

        const currentMonthRange = getRangeFromPreset("month");
        const ownedDeviceIds = rows.map((item) => item.id);

        if (ownedDeviceIds.length > 0) {
            const settings = await billingSettingsApi(token).catch((err) => { if (err.code === "BILLING_SETTINGS_NOT_FOUND") return null; throw err; });

            if (settings?.price_per_liter !== null && settings?.price_per_liter !== undefined) {
                const preview = await estimateBillApi(token, {
                    from: currentMonthRange.from,
                    to: currentMonthRange.to,
                    category_id: null,
                    device_ids: ownedDeviceIds,
                });

                setBillingPreview(preview);
            } else {
                setBillingPreview(null);
            }
        } else {
            setBillingPreview(null);
        }

        if (isDayPreset) {
            setOverallSeries(
                aggregateByHour.map((totalLiters, hour) => ({
                    hour,
                    totalLiters: Number(totalLiters || 0),
                }))
            );
            return;
        }

        setOverallSeries(dateKeys.map((date) => ({ date, totalLiters: Number(aggregateByDate[date] || 0) })));
    }, [range.from, range.to, rangePreset, token]);

    useFocusEffect(
        useCallback(() => {
            let mounted = true;
            async function run() {
                if (!hasLoadedOnce) {
                    setLoading(true);
                }
                try {
                    await loadHome();
                } catch (err) {
                    if (mounted) setError(err.message || messages.home.loadFailed);
                } finally {
                    if (mounted) {
                        setLoading(false);
                        setHasLoadedOnce(true);
                    }
                }
            }
            run();
            return () => {
                mounted = false;
            };
        }, [hasLoadedOnce, loadHome, messages.home.loadFailed])
    );

    async function onRefresh() {
        setRefreshing(true);
        try {
            await loadHome();
        } catch (err) {
            setError(err.message || messages.home.refreshFailed);
        } finally {
            setRefreshing(false);
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
        let exceeded = false;

        setRange((prev) => {
            let nextRange;

            if (pickerTarget === "from") {
                const nextTo = dateString > prev.to ? dateString : prev.to;
                nextRange = { from: dateString, to: nextTo };
            } else {
                const nextFrom = dateString < prev.from ? dateString : prev.from;
                nextRange = { from: nextFrom, to: dateString };
            }

            if (diffDaysInclusive(nextRange.from, nextRange.to) > 31) {
                exceeded = true;
                return prev;
            }

            return nextRange;
        });

        if (exceeded) {
            Alert.alert(messages.home.customRangeLimitedTitle, messages.home.customRangeLimitedMessage);
            return;
        }

        setPickerVisible(false);
    }

    const totalUsage = useMemo(() => deviceRows.reduce((sum, item) => sum + item.usageLiters, 0), [deviceRows]);
    const onlineCount = useMemo(() => deviceRows.filter((item) => item.online).length, [deviceRows]);
    const offlineCount = useMemo(() => deviceRows.filter((item) => !item.online).length, [deviceRows]);
    const overallTotal = useMemo(
        () => overallSeries.reduce((sum, item) => sum + Number(item.totalLiters || 0), 0),
        [overallSeries]
    );
    const overallAverage = useMemo(
        () => (overallSeries.length > 0 ? overallTotal / overallSeries.length : 0),
        [overallSeries.length, overallTotal]
    );
    const dayChartWidth = Math.max(180, trendWidth - 18);

    const pickerMinDate = useMemo(() => {
        if (pickerTarget === "from") {
            return shiftDateISO(range.to, -30);
        }
        return range.from;
    }, [pickerTarget, range.from, range.to]);

    const pickerMaxDate = useMemo(() => {
        const today = toLocalDateISO();
        if (pickerTarget === "from") {
            return minDateISO(range.to, today);
        }
        return minDateISO(shiftDateISO(range.from, 30), today);
    }, [pickerTarget, range.from, range.to]);

    const pickerEffectiveMinDate = useMemo(() => maxDateISO(pickerMinDate, "2000-01-01"), [pickerMinDate]);
    const pickerEffectiveMaxDate = useMemo(
        () => (pickerMaxDate < pickerEffectiveMinDate ? pickerEffectiveMinDate : pickerMaxDate),
        [pickerMaxDate, pickerEffectiveMinDate]
    );

    const filteredDevices = useMemo(() => {
        if (filter === "online") return deviceRows.filter((item) => item.online);
        if (filter === "offline") return deviceRows.filter((item) => !item.online);
        return deviceRows;
    }, [deviceRows, filter]);

    const categoryRows = useMemo(() => {
        const aggregate = deviceRows.reduce((acc, item) => {
            const categoryName = item.category_name || t("Uncategorized");
            acc[categoryName] = Number(acc[categoryName] || 0) + Number(item.usageLiters || 0);
            return acc;
        }, {});

        return Object.entries(aggregate)
            .map(([categoryName, totalLiters]) => ({ categoryName, totalLiters: Number(totalLiters || 0) }))
            .sort((a, b) => b.totalLiters - a.totalLiters);
    }, [deviceRows]);

    if (loading) {
        return (
            <View style={styles.loadingPage}>
                <View style={styles.skeletonPage}>
                    <SkeletonBlock width="42%" height={28} />
                    <SkeletonBlock width="64%" height={18} style={{ marginTop: 10, marginBottom: 18 }} />
                    <View style={styles.skeletonKpiRow}>
                        <SkeletonBlock width="48%" height={126} />
                        <SkeletonBlock width="48%" height={126} />
                    </View>
                    <SkeletonBlock width="100%" height={96} style={{ marginBottom: 12 }} />
                    <SkeletonBlock width="100%" height={340} />
                </View>
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.page}
            contentContainerStyle={[styles.content, pageInsets]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            <Animated.View style={animatedStyle}>
                <View style={styles.header}>
                    <Text style={styles.title} numberOfLines={2}>
                        {messages.home.pageTitle}
                    </Text>
                    <Text style={styles.subtitle}>{messages.home.subtitle}</Text>
                </View>

                <FailureNotice error={error} onRetry={onRefresh} />

                <MetricGrid accent items={[
                    { label: rangePreset === "day" ? messages.home.totalUsageToday : messages.home.totalUsage, value: `${formatNumber(totalUsage, 3)} L` },
                    { label: messages.home.onlineOffline, value: `${onlineCount} / ${offlineCount}` },
                ]} />

                <HoverablePressable
                    onPress={() => navigation.navigate("BillingEstimation")}
                    style={styles.kpiWideCard}
                    hoverStyle={styles.hoverRowHighlight}
                >
                    <View style={styles.billingPreviewHeader}>
                        <Text style={styles.billingPreviewLabel}>{messages.home.billingEstimateThisMonth}</Text>
                        <Text style={styles.billingPreviewArrow}>›</Text>
                    </View>
                    <Text style={styles.billingPreviewValue}>
                        {billingPreview ? formatRupiah(billingPreview.summary?.estimated_cost) : "--"}
                    </Text>
                </HoverablePressable>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>{messages.home.overallUsageTrend}</Text>
                    <PeriodSelector value={rangePreset} onChange={choosePreset} options={[
                            { key: "day", label: messages.home.day },
                            { key: "week", label: messages.home.week },
                            { key: "month", label: messages.home.month },
                            { key: "custom", label: messages.home.custom },
                    ]} />

                    {rangePreset === "custom" ? (
                        <View style={styles.customRangeRow}>
                            <HoverablePressable
                                containerStyle={{ flex: 1, minWidth: 0 }}
                                style={styles.customDateButton}
                                onPress={() => openCustomPicker("from")}
                                hoverStyle={styles.hoverButtonHighlight}
                            >
                                <Text style={styles.customDateLabel}>{messages.home.from}</Text>
                                <Text style={styles.customDateValue}>{range.from}</Text>
                            </HoverablePressable>
                            <HoverablePressable
                                containerStyle={{ flex: 1, minWidth: 0 }}
                                style={styles.customDateButton}
                                onPress={() => openCustomPicker("to")}
                                hoverStyle={styles.hoverButtonHighlight}
                            >
                                <Text style={styles.customDateLabel}>{messages.home.to}</Text>
                                <Text style={styles.customDateValue}>{range.to}</Text>
                            </HoverablePressable>
                        </View>
                    ) : null}

                    <MetricGrid muted items={[
                        { label: messages.home.total, value: `${formatNumber(overallTotal, 3)} L` },
                        { label: rangePreset === "day" ? messages.home.averagePerHour : messages.home.averagePerDay, value: `${formatNumber(overallAverage, 3)} L` },
                    ]} />
                    <View onLayout={(event) => setTrendWidth(event.nativeEvent.layout.width)}>
                    {rangePreset === "day" ? (
                        <DayHourlyLineChart series={overallSeries} chartWidth={dayChartWidth} messages={messages} />
                    ) : (
                        <OverallUsageChart
                            series={overallSeries}
                            messages={messages}
                            chartWidth={trendWidth}
                        />
                    )}
                    </View>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>{messages.home.usageByDevice}</Text>
                    <UsageByDeviceChart items={deviceRows} messages={messages} />
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>{messages.home.usageByCategory}</Text>
                    <UsageByCategoryChart items={categoryRows} messages={messages} />
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>{messages.home.deviceStatus}</Text>
                    <View style={styles.filterRow}>
                        {[
                            { key: "all", label: messages.home.all },
                            { key: "online", label: messages.home.online },
                            { key: "offline", label: messages.home.offline },
                        ].map((item) => (
                            <Pressable
                                key={item.key}
                                style={[styles.filterButton, filter === item.key && styles.filterButtonActive]}
                                onPress={() => setFilter(item.key)}
                            >
                                <Text
                                    style={[
                                        styles.filterButtonText,
                                        filter === item.key && styles.filterButtonTextActive,
                                    ]}
                                >
                                    {item.label}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    <FlatList
                        data={filteredDevices}
                        keyExtractor={(item) => String(item.id)}
                        scrollEnabled={false}
                        ListEmptyComponent={<Text style={styles.emptyText}>{messages.home.noDevicesInFilter}</Text>}
                        renderItem={({ item }) => (
                            <HoverablePressable
                                onPress={() => navigation.navigate("DeviceDashboard", { device: item })}
                                style={styles.deviceRow}
                                hoverStyle={styles.hoverRowHighlight}
                            >
                                <View style={styles.deviceInfo}>
                                    <Text style={styles.deviceName}>{item.device_name}</Text>
                                    <Text style={styles.deviceMeta}>{t("Code:")} {item.device_code}</Text>
                                    <View style={{ marginTop: 6 }}><StatusBadge online={item.online} /></View>
                                </View>
                                <Text style={styles.deviceUsage}>{formatNumber(item.usageLiters, 3)} L</Text>
                            </HoverablePressable>
                        )}
                    />
                </View>
            </Animated.View>

            <Modal
                transparent
                visible={pickerVisible}
                animationType="fade"
                onRequestClose={() => setPickerVisible(false)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>
                            {pickerTarget === "from" ? messages.home.pickStartDate : messages.home.pickEndDate}
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
                            <Text style={styles.modalHint}>{messages.home.webDateHint}</Text>
                        ) : null}
                        <View style={styles.modalActions}>
                            <Pressable style={styles.modalCloseButton} onPress={() => setPickerVisible(false)}>
                                <Text style={styles.modalCloseText}>{messages.home.close}</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}
