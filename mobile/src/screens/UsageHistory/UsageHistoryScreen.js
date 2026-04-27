import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
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
import { Calendar } from "react-native-calendars";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import { useFocusEffect } from "@react-navigation/native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useAuth } from "../../context/AuthContext";
import { usageHistoryApi, exportCsvApi } from "../../services/api";
import SectionAccordion from "../../components/SectionAccordion";
import styles from "./styles";

const AUTO_REFRESH_MS = 5000;

function formatNumber(value, decimals = 2) {
  const num = Number(value || 0);
  return num.toFixed(decimals);
}

function toLocalDateISO(date = new Date()) {
  const tzOffset = date.getTimezoneOffset() * 60000;
  const local = new Date(date.getTime() - tzOffset);
  return local.toISOString().slice(0, 10);
}

function parseDateOnly(dateString) {
  if (!dateString) return new Date(NaN);

  if (dateString instanceof Date) {
    return new Date(dateString.getFullYear(), dateString.getMonth(), dateString.getDate());
  }

  const raw = String(dateString).trim();
  if (!raw) return new Date(NaN);

  // If backend already returns full datetime, parse directly.
  if (raw.includes("T") || raw.includes(" ")) {
    return new Date(raw);
  }

  // Otherwise treat as date-only string.
  return new Date(`${raw}T00:00:00`);
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

function toDateKey(input) {
  if (!input) return "";
  const value = String(input).trim();
  if (!value) return "";
  return value.includes("T") ? value.slice(0, 10) : value;
}

function getDateKeysBetween(from, to) {
  const out = [];
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return out;
  }

  const cursor = new Date(start);
  while (cursor <= end) {
    out.push(toLocalDateISO(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return out;
}

function UsageBarChart({ data }) {
  if (!data || data.length === 0) return null;

  const maxUsage = data.reduce((max, item) => Math.max(max, Number(item.total_liters || 0)), 0);
  const chartMax = maxUsage > 0 ? maxUsage * 1.15 : 1;
  const tickIndexes = [0, Math.floor((data.length - 1) / 2), data.length - 1].filter(
    (v, i, arr) => arr.indexOf(v) === i
  );

  return (
    <View style={styles.chartContainer}>
      <View style={styles.chartBars}>
        {data.map((item) => {
          const value = Number(item.total_liters || 0);
          const pct = (value / chartMax) * 100;
          return (
            <View key={item.date} style={styles.chartBarCol}>
              <View style={styles.chartBarTrack}>
                <View style={[styles.chartBar, { height: `${Math.max(pct, 2)}%` }]} />
              </View>
            </View>
          );
        })}
      </View>
      <View style={styles.chartLabels}>
        {tickIndexes.map((idx) => (
          <Text key={`date-tick-${idx}`} style={styles.chartLabel}>
            {parseDateOnly(data[idx].date).toLocaleDateString()}
          </Text>
        ))}
      </View>
      <Text style={styles.chartCaption}>Daily usage (peak {formatNumber(maxUsage, 3)} L)</Text>
    </View>
  );
}

function UsageLineChart({ data, chartWidth }) {
  if (!data || data.length === 0) return null;

  const maxUsage = data.reduce((max, item) => Math.max(max, Number(item.total_liters || 0)), 0);
  const chartMax = maxUsage > 0 ? maxUsage * 1.15 : 1;
  const tickIndexes = [0, Math.floor((data.length - 1) / 2), data.length - 1].filter(
    (v, i, arr) => arr.indexOf(v) === i
  );

  const chartHeight = 110;
  const width = Math.max(220, chartWidth || 300);
  const points = data
    .map((item, idx) => {
      const value = Number(item.total_liters || 0);
      const x = data.length <= 1 ? width / 2 : (idx / (data.length - 1)) * width;
      const y = chartHeight - (value / chartMax) * chartHeight;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <View style={styles.chartContainer}>
      <View style={styles.lineChartBox}>
        <Svg width={width} height={chartHeight}>
          <Line x1="0" y1={chartHeight} x2={width} y2={chartHeight} stroke="#dbe6f5" strokeWidth="1" />
          <Line x1="0" y1="0" x2="0" y2={chartHeight} stroke="#dbe6f5" strokeWidth="1" />
          <Polyline fill="none" stroke="#0f62fe" strokeWidth="2.5" points={points} />
          {data.map((item, idx) => {
            const value = Number(item.total_liters || 0);
            const x = data.length <= 1 ? width / 2 : (idx / (data.length - 1)) * width;
            const y = chartHeight - (value / chartMax) * chartHeight;
            return <Circle key={`pt-${item.date}-${idx}`} cx={x} cy={y} r="3" fill="#0f62fe" />;
          })}
        </Svg>
      </View>
      <View style={styles.chartLabels}>
        {tickIndexes.map((idx) => (
          <Text key={`dot-date-${idx}`} style={styles.chartLabel}>
            {parseDateOnly(data[idx].date).toLocaleDateString()}
          </Text>
        ))}
      </View>
      <Text style={styles.chartCaption}>Line trend (peak {formatNumber(maxUsage, 3)} L)</Text>
    </View>
  );
}

export default function UsageHistoryScreen({ route }) {
  const { device } = route.params;
  const { token } = useAuth();
  const { width: screenWidth } = useWindowDimensions();

  const defaultRange = getDateRange(7);

  const [rangeMode, setRangeMode] = useState("7d");
  const [customFrom, setCustomFrom] = useState(defaultRange.from);
  const [customTo, setCustomTo] = useState(defaultRange.to);
  const [calendarDialogVisible, setCalendarDialogVisible] = useState(false);
  const [draftFrom, setDraftFrom] = useState(defaultRange.from);
  const [draftTo, setDraftTo] = useState(defaultRange.to);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [usageChartType, setUsageChartType] = useState("bar");
  const [showAllDetails, setShowAllDetails] = useState(false);
  const entryOpacity = useRef(new Animated.Value(0)).current;
  const entryTranslateY = useRef(new Animated.Value(12)).current;

  const range = useMemo(() => {
    if (rangeMode === "custom") {
      return { from: customFrom, to: customTo };
    }
    return getDateRange(rangeMode === "30d" ? 30 : 7);
  }, [rangeMode, customFrom, customTo]);

  const chartWidth = useMemo(() => Math.max(220, Math.floor(screenWidth - 80)), [screenWidth]);

  function clampCustomRange(nextFrom, nextTo) {
    let from = nextFrom;
    let to = nextTo;

    const fromDate = new Date(`${from}T00:00:00`);
    const toDate = new Date(`${to}T00:00:00`);
    if (fromDate > toDate) {
      to = from;
    }

    const from2 = new Date(`${from}T00:00:00`);
    const to2 = new Date(`${to}T00:00:00`);
    const diffDays = Math.floor((to2.getTime() - from2.getTime()) / 86400000) + 1;
    if (diffDays > 30) {
      const cappedFrom = new Date(to2);
      cappedFrom.setDate(cappedFrom.getDate() - 29);
      from = toLocalDateISO(cappedFrom);
    }

    return { from, to };
  }

  function openCalendarDialog() {
    setDraftFrom(customFrom);
    setDraftTo(customTo);
    setCalendarDialogVisible(true);
  }

  function closeCalendarDialog() {
    setCalendarDialogVisible(false);
  }

  function applyCalendarRange() {
    const normalized = clampCustomRange(draftFrom, draftTo || draftFrom);
    setCustomFrom(normalized.from);
    setCustomTo(normalized.to);
    setCalendarDialogVisible(false);
  }

  function onCalendarDayPress(day) {
    const date = day?.dateString;
    if (!date) return;

    // Start new selection when range is complete or not initialized
    if (!draftFrom || (draftFrom && draftTo)) {
      setDraftFrom(date);
      setDraftTo("");
      return;
    }

    // Complete range selection
    if (draftFrom && !draftTo) {
      const fromDate = new Date(`${draftFrom}T00:00:00`);
      const tappedDate = new Date(`${date}T00:00:00`);

      if (tappedDate < fromDate) {
        setDraftFrom(date);
        setDraftTo("");
        return;
      }

      const diffDays = Math.floor((tappedDate.getTime() - fromDate.getTime()) / 86400000) + 1;
      if (diffDays > 30) {
        const capped = new Date(fromDate);
        capped.setDate(capped.getDate() + 29);
        const cappedTo = toLocalDateISO(capped);
        setDraftTo(cappedTo);
        Alert.alert("Range limited", "Maximum custom range is 30 days.");
        return;
      }

      setDraftTo(date);
    }
  }

  const markedDates = useMemo(() => {
    if (!draftFrom) return {};

    const marks = {
      [draftFrom]: {
        startingDay: true,
        endingDay: !draftTo,
        color: "#0f62fe",
        textColor: "#fff",
      },
    };

    if (!draftTo) return marks;

    const from = new Date(`${draftFrom}T00:00:00`);
    const to = new Date(`${draftTo}T00:00:00`);
    const cursor = new Date(from);

    while (cursor <= to) {
      const key = toLocalDateISO(cursor);
      if (key === draftFrom) {
        marks[key] = {
          startingDay: true,
          color: "#0f62fe",
          textColor: "#fff",
        };
      } else if (key === draftTo) {
        marks[key] = {
          endingDay: true,
          color: "#0f62fe",
          textColor: "#fff",
        };
      } else {
        marks[key] = {
          color: "#d9e8ff",
          textColor: "#1d3551",
        };
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return marks;
  }, [draftFrom, draftTo]);

  const maxCalendarDate = useMemo(() => toLocalDateISO(new Date()), []);

  const maxSelectableToDate = useMemo(() => {
    if (!draftFrom || draftTo) return "";
    const start = new Date(`${draftFrom}T00:00:00`);
    const maxByRange = new Date(start);
    maxByRange.setDate(maxByRange.getDate() + 29);
    const today = new Date(`${maxCalendarDate}T00:00:00`);
    return toLocalDateISO(maxByRange < today ? maxByRange : today);
  }, [draftFrom, draftTo, maxCalendarDate]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(entryOpacity, {
        toValue: 1,
        duration: 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(entryTranslateY, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [entryOpacity, entryTranslateY]);

  const loadHistory = useCallback(async () => {
    setError("");
    const data = await usageHistoryApi(token, device.device_code, range.from, range.to);
    setItems(data?.items || []);
  }, [device.device_code, range.from, range.to, token]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      async function run() {
        setLoading(true);
        try {
          await loadHistory();
        } catch (err) {
          if (mounted) setError(err.message || "Failed to load usage history");
        } finally {
          if (mounted) setLoading(false);
        }
      }

      run();

      const interval = setInterval(async () => {
        if (!mounted) return;
        try {
          await loadHistory();
        } catch (_) {
          // silent on background refresh failures
        }
      }, AUTO_REFRESH_MS);

      return () => {
        mounted = false;
        clearInterval(interval);
      };
    }, [loadHistory])
  );

  async function onRefresh() {
    setRefreshing(true);
    try {
      await loadHistory();
    } catch (err) {
      setError(err.message || "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleExportCsv() {
    setExporting(true);
    setError("");
    try {
      const csvText = await exportCsvApi(token, device.device_code, range.from, range.to);
      const filename = `${device.device_code}_${range.from}_${range.to}.csv`;

      if (Platform.OS === "web") {
        const blob = new Blob([csvText], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
        return;
      }

      const fileUri = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, csvText, { encoding: FileSystem.EncodingType.UTF8 });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/csv",
          dialogTitle: "Export Water Usage Data",
          UTI: "public.comma-separated-values-text",
        });
      } else {
        Alert.alert("Export Complete", `CSV saved to: ${fileUri}`);
      }
    } catch (err) {
      setError(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  }

  const chartItems = useMemo(() => {
    const dateKeys = getDateKeysBetween(range.from, range.to);
    const byDate = new Map(items.map((item) => [toDateKey(item.date), item]));

    return dateKeys.map((date) => {
      const row = byDate.get(date);
      if (row) return row;
      return {
        date,
        total_liters: 0,
        avg_flow_rate_lpm: 0,
        peak_flow_rate_lpm: 0,
        reading_count: 0,
      };
    });
  }, [items, range.from, range.to]);

  const totalLiters = useMemo(() => {
    return chartItems.reduce((sum, item) => sum + Number(item.total_liters || 0), 0);
  }, [chartItems]);

  const averageDailyUsage = useMemo(() => {
    return chartItems.length > 0 ? totalLiters / chartItems.length : 0;
  }, [chartItems.length, totalLiters]);

  const peakDay = useMemo(() => {
    if (chartItems.length === 0) return null;
    return chartItems.reduce((max, item) => {
      return Number(item.total_liters || 0) > Number(max.total_liters || 0) ? item : max;
    }, chartItems[0]);
  }, [chartItems]);

  const visibleDetailItems = useMemo(() => (showAllDetails ? chartItems : chartItems.slice(0, 10)), [chartItems, showAllDetails]);
  const hasMoreDetailItems = chartItems.length > 10;

  if (loading) {
    return (
      <View style={styles.loadingPage}>
        <ActivityIndicator size="large" color="#0f62fe" />
      </View>
    );
  }

  return (
    <Animated.ScrollView
      style={[
        styles.page,
        {
          opacity: entryOpacity,
          transform: [{ translateY: entryTranslateY }],
        },
      ]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.deviceName}>{device.device_name}</Text>
      <Text style={styles.deviceMeta}>Code: {device.device_code}</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <SectionAccordion title="Date Range" defaultExpanded>
        <View style={styles.cardInner}>
        <View style={styles.rangeRow}>
          <Pressable
            style={({ pressed }) => [
              styles.rangeButton,
              rangeMode === "7d" && styles.rangeButtonActive,
              pressed && styles.rangeButtonPressed,
            ]}
            onPress={() => setRangeMode("7d")}
          >
            <Text style={[styles.rangeButtonText, rangeMode === "7d" && styles.rangeButtonTextActive]}>
              Last 7 days
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.rangeButton,
              rangeMode === "30d" && styles.rangeButtonActive,
              pressed && styles.rangeButtonPressed,
            ]}
            onPress={() => setRangeMode("30d")}
          >
            <Text style={[styles.rangeButtonText, rangeMode === "30d" && styles.rangeButtonTextActive]}>
              Last 30 days
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.rangeButton,
              rangeMode === "custom" && styles.rangeButtonActive,
              pressed && styles.rangeButtonPressed,
            ]}
            onPress={() => setRangeMode("custom")}
          >
            <Text style={[styles.rangeButtonText, rangeMode === "custom" && styles.rangeButtonTextActive]}>
              Custom
            </Text>
          </Pressable>
        </View>
        {rangeMode === "custom" ? (
          <View style={styles.customRangeWrap}>
            <Pressable style={styles.customDateButton} onPress={openCalendarDialog}>
              <Text style={styles.customDateLabel}>From</Text>
              <Text style={styles.customDateValue}>{parseDateOnly(customFrom).toLocaleDateString()}</Text>
            </Pressable>
            <Pressable style={styles.customDateButton} onPress={openCalendarDialog}>
              <Text style={styles.customDateLabel}>To</Text>
              <Text style={styles.customDateValue}>{parseDateOnly(customTo).toLocaleDateString()}</Text>
            </Pressable>
          </View>
        ) : null}
        <Text style={styles.meta}>
          {parseDateOnly(range.from).toLocaleDateString()} - {parseDateOnly(range.to).toLocaleDateString()}
        </Text>
        <Text style={styles.meta}>Custom range maximum: 30 days</Text>
        </View>
      </SectionAccordion>

      <Modal transparent visible={calendarDialogVisible} animationType="fade" onRequestClose={closeCalendarDialog}>
        <View style={styles.modalBackdrop}>
          <View style={styles.calendarDialogCard}>
            <Text style={styles.modalTitle}>Select Date Range</Text>
            <Calendar
              markingType="period"
              onDayPress={onCalendarDayPress}
              markedDates={markedDates}
              minDate={draftFrom && !draftTo ? draftFrom : undefined}
              maxDate={draftFrom && !draftTo ? maxSelectableToDate : maxCalendarDate}
              theme={{
                todayTextColor: "#0f62fe",
                arrowColor: "#0f62fe",
                selectedDayBackgroundColor: "#0f62fe",
                selectedDayTextColor: "#ffffff",
                textDayFontWeight: "500",
                textMonthFontWeight: "700",
                textDisabledColor: "#b9c7d8",
              }}
            />
            <Text style={styles.calendarHint}>
              Tap start date, then end date (max 30 days). Tap again to start a new selection.
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalSecondaryButton} onPress={closeCalendarDialog}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalPrimaryButton} onPress={applyCalendarRange}>
                <Text style={styles.modalPrimaryText}>Apply</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <SectionAccordion title="Summary" defaultExpanded>
        <View style={styles.cardInner}>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryLabel}>Total Usage</Text>
              <Text style={styles.metric}>{formatNumber(totalLiters, 3)} L</Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryLabel}>Daily Average</Text>
              <Text style={styles.summaryTileValue}>{formatNumber(averageDailyUsage, 3)} L/day</Text>
            </View>
          </View>
          <View style={styles.peakDayCard}>
            <Text style={styles.summaryLabel}>Peak Day</Text>
            <Text style={styles.summaryTileValue}>
              {peakDay ? parseDateOnly(peakDay.date).toLocaleDateString() : "-"}
            </Text>
            <Text style={styles.meta}>{formatNumber(peakDay?.total_liters, 3)} L</Text>
          </View>
        </View>
      </SectionAccordion>

      <SectionAccordion title="Daily Usage Chart" defaultExpanded>
        <View style={styles.cardInner}>
        <View style={styles.chartTypeRow}>
          <Pressable
            style={[styles.chartTypeButton, usageChartType === "bar" && styles.chartTypeButtonActive]}
            onPress={() => setUsageChartType("bar")}
          >
            <Text style={[styles.chartTypeText, usageChartType === "bar" && styles.chartTypeTextActive]}>
              Bars
            </Text>
          </Pressable>
          <Pressable
            style={[styles.chartTypeButton, usageChartType === "line" && styles.chartTypeButtonActive]}
            onPress={() => setUsageChartType("line")}
          >
            <Text style={[styles.chartTypeText, usageChartType === "line" && styles.chartTypeTextActive]}>
              Line
            </Text>
          </Pressable>
        </View>
        {chartItems.length === 0 ? (
          <Text style={styles.meta}>No usage data in this range</Text>
        ) : (
          <>
            {usageChartType === "bar" ? (
              <UsageBarChart data={chartItems} />
            ) : (
              <UsageLineChart data={chartItems} chartWidth={chartWidth} />
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dailyTotalsStrip}>
              {chartItems.map((row) => (
                <View key={`total-${row.date}`} style={styles.dailyTotalChip}>
                  <Text style={styles.dailyTotalDate}>{parseDateOnly(row.date).toLocaleDateString()}</Text>
                  <Text style={styles.dailyTotalValue}>{formatNumber(row.total_liters, 3)} L</Text>
                </View>
              ))}
            </ScrollView>
          </>
        )}
        </View>
      </SectionAccordion>

      <SectionAccordion title="Daily Details" defaultExpanded>
        <View style={styles.cardInner}>
        {chartItems.length === 0 ? (
          <Text style={styles.meta}>No rows to show</Text>
        ) : (
          <>
            <FlatList
              data={visibleDetailItems}
              keyExtractor={(item) => item.date}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <View style={styles.detailCard}>
                  <Text style={styles.detailDate}>{parseDateOnly(item.date).toLocaleDateString()}</Text>
                  <View style={styles.detailMetricRow}>
                    <View style={styles.detailMetricItem}>
                      <Text style={styles.detailMetricLabel}>Total</Text>
                      <Text style={styles.detailMetricValue}>{formatNumber(item.total_liters, 3)} L</Text>
                    </View>
                    <View style={styles.detailMetricItem}>
                      <Text style={styles.detailMetricLabel}>Avg</Text>
                      <Text style={styles.detailMetricValue}>{formatNumber(item.avg_flow_rate_lpm, 2)} L/min</Text>
                    </View>
                    <View style={styles.detailMetricItem}>
                      <Text style={styles.detailMetricLabel}>Peak</Text>
                      <Text style={styles.detailMetricValue}>{formatNumber(item.peak_flow_rate_lpm, 2)} L/min</Text>
                    </View>
                  </View>
                </View>
              )}
            />
            {hasMoreDetailItems ? (
              <Pressable style={styles.viewMoreButton} onPress={() => setShowAllDetails((prev) => !prev)}>
                <Text style={styles.viewMoreText}>{showAllDetails ? "View Less" : `View More (${chartItems.length - 10} more)`}</Text>
              </Pressable>
            ) : null}
          </>
        )}
        </View>
      </SectionAccordion>

      <Pressable
        style={({ pressed }) => [
          styles.exportButton,
          pressed && styles.exportButtonPressed,
          exporting && styles.exportButtonDisabled,
        ]}
        onPress={handleExportCsv}
        disabled={exporting}
      >
        {exporting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.exportButtonText}>Export CSV</Text>
        )}
      </Pressable>
    </Animated.ScrollView>
  );
}
