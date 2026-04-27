import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { Calendar } from "react-native-calendars";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import { useAuth } from "../../context/AuthContext";
import { dailyTelemetryApi, listDevicesApi, latestTelemetryApi, usageHistoryApi } from "../../services/api";
import styles from "./styles";

const OFFLINE_THRESHOLD_SEC = 120;

function toLocalDateISO(date = new Date()) {
  const tzOffset = date.getTimezoneOffset() * 60000;
  const local = new Date(date.getTime() - tzOffset);
  return local.toISOString().slice(0, 10);
}

function formatNumber(value, decimals = 2) {
  return Number(value || 0).toFixed(decimals);
}

function formatDateLabel(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`);
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
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

function OverallUsageChart({ series, rangePreset }) {
  if (!series.length) return <Text style={styles.emptyText}>No total usage trend yet.</Text>;

  const maxValue = series.reduce((max, item) => Math.max(max, Number(item.totalLiters || 0)), 0);
  const chartMax = maxValue > 0 ? maxValue : 1;

  return (
    <View style={styles.overallChartWrap}>
      <View style={styles.overallBars}>
        {series.map((item) => {
          const value = Number(item.totalLiters || 0);
          const heightPct = Math.round((value / chartMax) * 100);

          const isDenseRange = rangePreset === "month" || rangePreset === "custom";
          const labelText = isDenseRange ? formatDayOnlyLabel(item.date) : formatDateLabel(item.date);

          return (
            <View key={item.date} style={styles.overallBarCol}>
              <View style={styles.overallBarTrack}>
                <View style={[styles.overallBarFill, { height: `${Math.max(heightPct, value > 0 ? 4 : 0)}%` }]} />
              </View>
              <Text style={styles.overallBarLabel}>{labelText}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function DayHourlyLineChart({ series, chartWidth }) {
  if (!series.length) return <Text style={styles.emptyText}>No hourly usage data yet.</Text>;

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
      <Text style={styles.rangeMeta}>Hourly total usage (all devices)</Text>
    </View>
  );
}

function UsageByDeviceChart({ items }) {
  if (!items.length) return <Text style={styles.emptyText}>No device usage data yet.</Text>;

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
              <View style={[styles.chartFill, { width: `${Math.max(fillPct, item.usageLiters > 0 ? 6 : 0)}%` }]} />
            </View>
            <Text style={styles.chartValue}>{formatNumber(item.usageLiters, 3)} L</Text>
          </View>
        );
      })}
    </View>
  );
}

function UsageByCategoryChart({ items }) {
  if (!items.length) return <Text style={styles.emptyText}>No category usage data yet.</Text>;

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
              <View style={[styles.chartFillCategory, { width: `${Math.max(fillPct, item.totalLiters > 0 ? 6 : 0)}%` }]} />
            </View>
            <Text style={styles.chartValue}>{formatNumber(item.totalLiters, 3)} L</Text>
          </View>
        );
      })}
    </View>
  );
}

function HoverablePressable({ onPress, style, children, disabled, hoverStyle }) {
  const [hovered, setHovered] = useState(false);

  const resolvedHoverStyle = hovered ? hoverStyle : null;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={disabled ? { opacity: 0.7 } : null}
    >
      <View style={[style, resolvedHoverStyle]}>{children}</View>
    </Pressable>
  );
}

export default function HomeScreen({ navigation }) {
  const { token } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [rangePreset, setRangePreset] = useState("week");
  const [range, setRange] = useState(() => getRangeFromPreset("week"));
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState("from");
  const [deviceRows, setDeviceRows] = useState([]);
  const [overallSeries, setOverallSeries] = useState([]);

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
          latestTelemetryApi(token, device.device_code).catch(() => null),
          isDayPreset ? Promise.resolve(null) : usageHistoryApi(token, device.device_code, range.from, range.to).catch(() => ({ items: [] })),
          isDayPreset ? dailyTelemetryApi(token, device.device_code, today).catch(() => ({ items: [] })) : Promise.resolve(null),
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
        setLoading(true);
        try {
          await loadHome();
        } catch (err) {
          if (mounted) setError(err.message || "Failed to load home data");
        } finally {
          if (mounted) setLoading(false);
        }
      }
      run();
      return () => {
        mounted = false;
      };
    }, [loadHome])
  );

  async function onRefresh() {
    setRefreshing(true);
    try {
      await loadHome();
    } catch (err) {
      setError(err.message || "Refresh failed");
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
      Alert.alert("Custom range limited", "Custom range maximum is 1 month.");
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
  const overallAverageLabel = rangePreset === "day" ? "Average / Hour" : "Average / Day";
  const dayChartWidth = useMemo(() => Math.floor(screenWidth - 88), [screenWidth]);

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
      const categoryName = item.category_name || "Uncategorized";
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
        <ActivityIndicator size="large" color="#0f62fe" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Home</Text>
      <Text style={styles.subtitle}>Daily overview of all IoT devices</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Total Usage Today</Text>
          <Text style={styles.kpiValue}>{formatNumber(totalUsage, 3)} L</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Online / Offline</Text>
          <Text style={styles.kpiValue}>
            {onlineCount} / {offlineCount}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Overall Usage Trend</Text>
        <View style={styles.presetRow}>
          {[
            { key: "day", label: "Day" },
            { key: "week", label: "Week" },
            { key: "month", label: "Month" },
            { key: "custom", label: "Custom" },
          ].map((item) => (
            <HoverablePressable
              key={item.key}
              onPress={() => choosePreset(item.key)}
              style={[styles.presetButton, rangePreset === item.key && styles.presetButtonActive]}
              hoverStyle={styles.hoverButtonHighlight}
            >
              <Text style={[styles.presetText, rangePreset === item.key && styles.presetTextActive]}>{item.label}</Text>
            </HoverablePressable>
          ))}
        </View>

        {rangePreset === "custom" ? (
          <View style={styles.customRangeRow}>
            <HoverablePressable
              style={styles.customDateButton}
              onPress={() => openCustomPicker("from")}
              hoverStyle={styles.hoverButtonHighlight}
            >
              <Text style={styles.customDateLabel}>From</Text>
              <Text style={styles.customDateValue}>{range.from}</Text>
            </HoverablePressable>
            <HoverablePressable
              style={styles.customDateButton}
              onPress={() => openCustomPicker("to")}
              hoverStyle={styles.hoverButtonHighlight}
            >
              <Text style={styles.customDateLabel}>To</Text>
              <Text style={styles.customDateValue}>{range.to}</Text>
            </HoverablePressable>
          </View>
        ) : (
          <Text style={styles.rangeMeta}>
            {range.from} to {range.to}
          </Text>
        )}

        <View style={styles.overallKpiRow}>
          <View style={styles.overallKpiCard}>
            <Text style={styles.kpiLabel}>Total</Text>
            <Text style={styles.overallKpiValue}>{formatNumber(overallTotal, 3)} L</Text>
          </View>
          <View style={styles.overallKpiCard}>
            <Text style={styles.kpiLabel}>{overallAverageLabel}</Text>
            <Text style={styles.overallKpiValue}>{formatNumber(overallAverage, 3)} L</Text>
          </View>
        </View>
        {rangePreset === "day" ? (
          <DayHourlyLineChart series={overallSeries} chartWidth={dayChartWidth} />
        ) : (
          <OverallUsageChart series={overallSeries} rangePreset={rangePreset} />
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Usage by Device ({rangePreset === "day" ? "Selected Day" : "Selected Range"})</Text>
        <UsageByDeviceChart items={deviceRows} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Overall Usage by Category ({rangePreset === "day" ? "Selected Day" : "Selected Range"})</Text>
        <UsageByCategoryChart items={categoryRows} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Device Status</Text>
        <View style={styles.filterRow}>
          {[
            { key: "all", label: "All" },
            { key: "online", label: "Online" },
            { key: "offline", label: "Offline" },
          ].map((item) => (
            <Pressable
              key={item.key}
              style={[styles.filterButton, filter === item.key && styles.filterButtonActive]}
              onPress={() => setFilter(item.key)}
            >
              <Text style={[styles.filterButtonText, filter === item.key && styles.filterButtonTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        <FlatList
          data={filteredDevices}
          keyExtractor={(item) => String(item.id)}
          scrollEnabled={false}
          ListEmptyComponent={<Text style={styles.emptyText}>No devices in this filter.</Text>}
          renderItem={({ item }) => (
            <HoverablePressable
              onPress={() => navigation.navigate("DeviceDashboard", { device: item })}
              style={styles.deviceRow}
              hoverStyle={styles.hoverRowHighlight}
            >
              <View style={[styles.statusDot, item.online ? styles.statusOnline : styles.statusOffline]} />
              <View style={styles.deviceInfo}>
                <Text style={styles.deviceName}>{item.device_name}</Text>
                <Text style={styles.deviceMeta}>Code: {item.device_code}</Text>
              </View>
              <Text style={styles.deviceUsage}>{formatNumber(item.usageLiters, 3)} L</Text>
            </HoverablePressable>
          )}
        />
      </View>

      <Modal transparent visible={pickerVisible} animationType="fade" onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Pick {pickerTarget === "from" ? "Start" : "End"} Date</Text>
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
            {Platform.OS === "web" ? <Text style={styles.modalHint}>Click one date to set selected field.</Text> : null}
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCloseButton} onPress={() => setPickerVisible(false)}>
                <Text style={styles.modalCloseText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
