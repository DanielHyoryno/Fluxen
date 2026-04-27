import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, FlatList, Pressable, RefreshControl, Text, useWindowDimensions, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../../context/AuthContext";
import SectionAccordion from "../../components/SectionAccordion";
import { dailyTelemetryApi, latestTelemetryApi, usageAlertsApi, usageLimitsApi, dismissAlertApi } from "../../services/api";
import styles from "./styles";
import { AUTO_REFRESH_MS, OFFLINE_THRESHOLD_SEC } from "../../constants/deviceDashboard";
import { formatDateLabel, formatNumber, formatRelativeAge, toLocalDateISO } from "../../common/deviceDashboard/formatters";
import { FlowBarChart, FlowLineChart, HourlyUsageLineChart } from "../../components/deviceDashboard/charts";
import { StaggerCard, StaggerRow } from "../../components/deviceDashboard/motion";

function formatAlertSummary(alert) {
  const periodKey = alert?.meta?.period_key || alert?.meta?.periodKey;
  const consumedLiters = Number(alert?.meta?.consumed_l ?? alert?.meta?.consumedLiters ?? 0);

  if (periodKey) {
    if (alert?.alert_type === "USAGE_LIMIT_MONTHLY") {
      const monthDate = new Date(`${periodKey}-01T00:00:00`);
      return `${monthDate.toLocaleDateString([], { month: "long", year: "numeric" })} - ${formatNumber(consumedLiters, 3)} L`;
    }

    return `${new Date(`${periodKey}T00:00:00`).toLocaleDateString()} - ${formatNumber(consumedLiters, 3)} L`;
  }

  return alert?.message || "Usage alert";
}

export default function DeviceDashboardScreen({ route, navigation }) {
  const { device } = route.params;
  const { token } = useAuth();
  const { width: screenWidth } = useWindowDimensions();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [latest, setLatest] = useState(null);
  const [dailyItems, setDailyItems] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [limits, setLimits] = useState(null);
  const [flowChartType, setFlowChartType] = useState("bar");
  const [clockTick, setClockTick] = useState(0);
  const [showAllTodayHistory, setShowAllTodayHistory] = useState(false);
  const entryOpacity = useRef(new Animated.Value(0)).current;
  const entryTranslateY = useRef(new Animated.Value(14)).current;
  const livePulse = useRef(new Animated.Value(1)).current;

  const today = toLocalDateISO();
  const chartWidth = useMemo(() => Math.max(220, Math.floor(screenWidth - 120)), [screenWidth]);
  const isWideLayout = screenWidth >= 980;

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

  useEffect(() => {
    const timer = setInterval(() => setClockTick((v) => (v + 1) % 100000), 1000);
    return () => clearInterval(timer);
  }, []);

  const latestAgeSec = useMemo(() => {
    if (!latest?.measured_at) return null;
    return Math.max(0, Math.floor((Date.now() - new Date(latest.measured_at).getTime()) / 1000));
  }, [latest?.measured_at, clockTick]);

  const isDeviceOnline = latestAgeSec !== null && latestAgeSec <= OFFLINE_THRESHOLD_SEC;
  const displayFlowRate = isDeviceOnline ? Number(latest?.flow_rate_lpm || 0) : 0;

  useEffect(() => {
    if (!isDeviceOnline) {
      livePulse.stopAnimation();
      livePulse.setValue(0.45);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, {
          toValue: 0.6,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(livePulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isDeviceOnline, livePulse]);

  const lastSeenText = useMemo(() => {
    if (!latest?.measured_at) return "No telemetry yet";
    const diffSec = latestAgeSec ?? 0;
    const relative = formatRelativeAge(diffSec);
    return `${isDeviceOnline ? "Updated" : "Last seen"} ${relative} ago`;
  }, [latest?.measured_at, latestAgeSec, isDeviceOnline]);

  const totalTodayLiters = useMemo(() => dailyItems.reduce((sum, item) => sum + Number(item.volume_delta_l || 0), 0), [dailyItems]);

  const avgFlowToday = useMemo(() => {
    if (dailyItems.length === 0) return 0;
    const sum = dailyItems.reduce((acc, item) => acc + Number(item.flow_rate_lpm || 0), 0);
    return sum / dailyItems.length;
  }, [dailyItems]);

  const highestFlow = useMemo(() => {
    if (dailyItems.length === 0) return 0;
    return dailyItems.reduce((max, item) => Math.max(max, Number(item.flow_rate_lpm || 0)), 0);
  }, [dailyItems]);

  const hourlyUsageSeries = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, hour) => ({ hour, totalLiters: 0 }));

    for (const item of dailyItems) {
      const measuredAt = item.measured_at ? new Date(item.measured_at) : null;
      if (!measuredAt || Number.isNaN(measuredAt.getTime())) continue;
      const hour = measuredAt.getHours();
      buckets[hour].totalLiters += Number(item.volume_delta_l || 0);
    }

    return buckets;
  }, [dailyItems]);

  const hourlyGuide = useMemo(() => {
    const dailyLimit = Number(limits?.daily_usage_limit_l || 0);
    if (dailyLimit <= 0) return 0;
    return dailyLimit / 24;
  }, [limits?.daily_usage_limit_l]);

  const visibleTodayHistoryItems = useMemo(() => (showAllTodayHistory ? dailyItems.slice().reverse() : dailyItems.slice(-10).reverse()), [dailyItems, showAllTodayHistory]);
  const hasMoreTodayHistory = dailyItems.length > 10;

  const loadAll = useCallback(async () => {
    setError("");
    const [latestData, dailyData, alertData, limitData] = await Promise.all([
      latestTelemetryApi(token, device.device_code).catch(() => null),
      dailyTelemetryApi(token, device.device_code, today),
      usageAlertsApi(token, device.device_code, "active", 20).catch(() => ({ items: [] })),
      usageLimitsApi(token, device.device_code).catch(() => null),
    ]);

    setLatest(latestData);
    setDailyItems(dailyData?.items || []);
    setAlerts(alertData?.items || []);
    setLimits(limitData);
  }, [device.device_code, token, today]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      async function run() {
        setLoading(true);
        try {
          await loadAll();
        } catch (err) {
          if (mounted) setError(err.message || "Failed to load dashboard");
        } finally {
          if (mounted) setLoading(false);
        }
      }

      run();

      const interval = setInterval(async () => {
        if (!mounted) return;
        try {
          await loadAll();
        } catch (_) {
          // silent on auto-refresh failures
        }
      }, AUTO_REFRESH_MS);

      return () => {
        mounted = false;
        clearInterval(interval);
      };
    }, [loadAll])
  );

  async function onRefresh() {
    setRefreshing(true);
    try {
      await loadAll();
    } catch (err) {
      setError(err.message || "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleDismissAlert(alertId) {
    try {
      await dismissAlertApi(token, alertId);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (err) {
      setError(err.message || "Failed to dismiss alert");
    }
  }

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
      <View style={styles.deviceHeader}>
        <View style={styles.deviceHeaderLeft}>
          <Text style={styles.deviceName}>{device.device_name}</Text>
          <Text style={styles.deviceMeta}>Code: {device.device_code}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.editDeviceButton, pressed && styles.editDeviceButtonPressed]}
          onPress={() => navigation.navigate("DeviceEdit", { device })}
        >
          <Text style={styles.editDeviceButtonText}>Edit</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={[styles.topSectionWrap, isWideLayout && styles.topSectionWrapWide]}>
        <View style={[styles.topSectionItem, isWideLayout && styles.topSectionItemWide]}>
          <SectionAccordion title="Overview" defaultExpanded>
            <StaggerCard index={0} style={styles.card}>
              <View style={styles.liveHeader}>
                <Text style={styles.cardTitle}>Current Status</Text>
                <View style={[styles.liveChip, !isDeviceOnline && styles.liveChipOffline]}>
                  <Animated.View style={[styles.liveDot, !isDeviceOnline && styles.liveDotOffline, { opacity: livePulse }]} />
                  <Text style={[styles.liveText, !isDeviceOnline && styles.liveTextOffline]}>{isDeviceOnline ? "ONLINE" : "OFFLINE"}</Text>
                </View>
              </View>
              <Text style={styles.mainMetric}>{formatNumber(displayFlowRate, 2)} L/min</Text>
              <Text style={styles.meta}>Latest at: {latest?.measured_at ? new Date(latest.measured_at).toLocaleString() : "-"}</Text>
              <Text style={styles.metaStrong}>{lastSeenText}</Text>
              <Pressable
                style={({ pressed }) => [styles.overviewDetailButton, pressed && styles.overviewDetailButtonPressed]}
                onPress={() => navigation.navigate("UsageHistory", { device })}
              >
                <Text style={styles.overviewDetailButtonText}>View More Detail IoT</Text>
              </Pressable>
            </StaggerCard>

            <StaggerCard index={1} style={styles.row}>
              <View style={[styles.card, styles.cardHalf]}>
                <Text style={styles.cardTitle}>Today Total</Text>
                <Text style={styles.metric}>{formatNumber(totalTodayLiters, 3)} L</Text>
              </View>
              <View style={[styles.card, styles.cardHalf]}>
                <Text style={styles.cardTitle}>Average Flow</Text>
                <Text style={styles.metric}>{formatNumber(avgFlowToday, 2)} L/min</Text>
              </View>
            </StaggerCard>

            <StaggerCard index={2} style={styles.card}>
              <Text style={styles.cardTitle}>Peak Flow Today</Text>
              <Text style={styles.metric}>{formatNumber(highestFlow, 2)} L/min</Text>
            </StaggerCard>
          </SectionAccordion>
        </View>

        <View style={[styles.topSectionItem, isWideLayout && styles.topSectionItemWide]}>
          <SectionAccordion title="Alerts & Limits" defaultExpanded>
            <StaggerCard index={3} style={styles.card}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View>
                  <Text style={styles.cardTitle}>Usage Limits</Text>
                  <Text style={styles.meta}>Daily: {limits?.daily_usage_limit_l ? `${limits.daily_usage_limit_l} L` : "Not set"}</Text>
                  <Text style={styles.meta}>Monthly: {limits?.monthly_usage_limit_l ? `${limits.monthly_usage_limit_l} L` : "Not set"}</Text>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.limitButton, pressed && styles.limitButtonPressed]}
                  onPress={() => navigation.navigate("UsageLimits", { device })}
                >
                  <Text style={styles.limitButtonText}>Edit</Text>
                </Pressable>
              </View>
            </StaggerCard>

            <StaggerCard index={4} style={styles.card}>
              <Text style={styles.cardTitle}>Active Usage Alerts</Text>
              {alerts.length === 0 ? (
                <Text style={styles.meta}>No active alerts</Text>
              ) : (
                <FlatList
                  data={alerts}
                  keyExtractor={(item) => String(item.id)}
                  scrollEnabled={true}
                  nestedScrollEnabled
                  renderItem={({ item, index }) => (
                    <StaggerRow index={index}>
                      <View style={styles.alertItem}>
                        <View style={styles.alertRow}>
                          <View style={styles.alertContent}>
                            <Text style={styles.alertTitle} numberOfLines={1}>{item.title}</Text>
                            <Text style={styles.alertMetaText} numberOfLines={1}>{formatAlertSummary(item)}</Text>
                          </View>
                          <Pressable
                            style={({ pressed }) => [styles.dismissButton, pressed && styles.dismissButtonPressed]}
                            onPress={() => handleDismissAlert(item.id)}
                          >
                            <Text style={styles.dismissButtonText}>Dismiss</Text>
                          </Pressable>
                        </View>
                      </View>
                    </StaggerRow>
                  )}
                />
              )}
            </StaggerCard>
          </SectionAccordion>
        </View>
      </View>

      <SectionAccordion title="Telemetry Details" defaultExpanded>
        <StaggerCard index={5} style={styles.card}>
          <Text style={styles.cardTitle}>Flow Rate Chart</Text>
          <View style={styles.chartTypeRow}>
            <Pressable style={[styles.chartTypeButton, flowChartType === "bar" && styles.chartTypeButtonActive]} onPress={() => setFlowChartType("bar")}>
              <Text style={[styles.chartTypeText, flowChartType === "bar" && styles.chartTypeTextActive]}>Bars</Text>
            </Pressable>
            <Pressable style={[styles.chartTypeButton, flowChartType === "line" && styles.chartTypeButtonActive]} onPress={() => setFlowChartType("line")}>
              <Text style={[styles.chartTypeText, flowChartType === "line" && styles.chartTypeTextActive]}>Line</Text>
            </Pressable>
          </View>
          {dailyItems.length === 0 ? (
            <Text style={styles.meta}>No data to chart</Text>
          ) : (
            <>
              {flowChartType === "bar" ? <FlowBarChart data={dailyItems} /> : <FlowLineChart data={dailyItems} chartWidth={chartWidth} />}
            </>
          )}
        </StaggerCard>

        <StaggerCard index={6} style={styles.card}>
          <Text style={styles.cardTitle}>Hourly Usage (Today)</Text>
          <HourlyUsageLineChart hourlySeries={hourlyUsageSeries} chartWidth={chartWidth} hourlyGuide={hourlyGuide} />
        </StaggerCard>

        <StaggerCard index={7} style={styles.card}>
          <Text style={styles.cardTitle}>Today History</Text>
          {dailyItems.length === 0 ? (
            <Text style={styles.meta}>No telemetry for today</Text>
          ) : (
            <View style={styles.todayHistoryBox}>
              <FlatList
                data={visibleTodayHistoryItems}
                keyExtractor={(item, idx) => `${item.measured_at}-${idx}`}
                scrollEnabled={true}
                nestedScrollEnabled
                renderItem={({ item, index }) => (
                  <StaggerRow index={index}>
                    <View style={styles.historyRow}>
                      <Text style={styles.historyTime}>{formatDateLabel(item.measured_at)}</Text>
                      <Text style={styles.historyValue}>{formatNumber(item.flow_rate_lpm, 2)} L/min</Text>
                      <Text style={styles.historyValue}>{formatNumber(item.volume_delta_l, 4)} L</Text>
                    </View>
                  </StaggerRow>
                )}
              />
              {hasMoreTodayHistory ? (
                <Pressable style={styles.todayHistoryMoreButton} onPress={() => setShowAllTodayHistory((prev) => !prev)}>
                  <Text style={styles.todayHistoryMoreText}>{showAllTodayHistory ? "View Less" : `View More (${dailyItems.length - 10} more)`}</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </StaggerCard>

      </SectionAccordion>
    </Animated.ScrollView>
  );
}
