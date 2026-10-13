import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { formatValue, getLanguageTag, t, useLocale } from "../services/i18n";
import { colors } from "../theme/tokens";

function formatDate(dateKey) {
    return new Date(`${dateKey}T00:00:00`).toLocaleDateString(getLanguageTag(), {
        day: "numeric", month: "long", year: "numeric",
    });
}

// Both screens provide daily totals; selection never recalculates or fetches usage.
export default function DailyUsageBarChart({ series, chartWidth, emptyMessage }) {
    useLocale();
    const { fontScale, width: screenWidth } = useWindowDimensions();
    const [selectedDate, setSelectedDate] = useState(null);
    const [measuredWidth, setMeasuredWidth] = useState(0);
    const rangeKey = `${series[0]?.date}:${series[series.length - 1]?.date}`;
    useEffect(() => setSelectedDate(null), [rangeKey]);
    const selected = series.find((item) => item.date === selectedDate);

    if (!series.length) return <Text style={styles.hint}>{emptyMessage}</Text>;

    const viewportWidth = Number.isFinite(chartWidth) && chartWidth > 0
        ? chartWidth : measuredWidth || Math.max(1, screenWidth - 64);
    const trackHeight = 120;
    const chartMax = Math.max(0, ...series.map((item) => Number(item.totalLiters || 0))) || 1;
    const minSlotWidth = Math.max(40, Math.ceil(30 * fontScale));
    const interBarGap = 6;
    const requiredWidth = series.length * minSlotWidth + (series.length - 1) * interBarGap;
    const contentWidth = Math.max(requiredWidth, viewportWidth);
    const slotWidth = (contentWidth - (series.length - 1) * interBarGap) / series.length;
    const labelHeight = (series.length > 10 ? 20 : 36) * fontScale;
    const contentHeight = trackHeight + 6 + labelHeight;
    const rowStyle = { flexDirection: "row", gap: interBarGap, width: contentWidth, height: contentHeight, alignItems: "flex-start" };

    const bars = series.map((item) => {
        const value = Number(item.totalLiters || 0);
        const active = item.date === selectedDate;
        const date = new Date(`${item.date}T00:00:00`);
        const label = series.length > 10 ? String(date.getDate())
            : `${date.getDate()}\n${date.toLocaleDateString(getLanguageTag(), { month: "short" })}`;
        return (
            <Pressable key={item.date} testID={`usage-bar-${item.date}`}
                accessibilityRole="button" accessibilityState={{ selected: active }}
                accessibilityLabel={`${formatDate(item.date)}. ${t("Total Usage")}: ${formatValue(value, 3)} L`}
                onPress={() => setSelectedDate(item.date)}
                style={{ width: slotWidth, height: contentHeight, flexShrink: 0, alignItems: "center" }}>
                <View testID={`usage-track-${item.date}`} style={[styles.track, { width: slotWidth, height: trackHeight }]}>
                    <View testID={`usage-fill-${item.date}`} style={[styles.fill, active && styles.selectedFill,
                        { height: value > 0 ? Math.max(value / chartMax * trackHeight, 3) : 0 }]} />
                    {active && <View pointerEvents="none" style={styles.selectionOutline} />}
                </View>
                <Text numberOfLines={series.length > 10 ? 1 : 2}
                    style={[styles.label, { height: labelHeight }, active && styles.selectedLabel]}>{label}</Text>
            </Pressable>
        );
    });

    return (
        <View onLayout={(event) => setMeasuredWidth(event.nativeEvent.layout.width)}>
            <View style={styles.readout} accessibilityLiveRegion="polite" testID="usage-selection">
                {selected ? (
                    <>
                        <Text style={styles.selectedDate}>{formatDate(selected.date)}</Text>
                        <View style={styles.valueRow}>
                            <Text style={styles.hint}>{t("Total Usage")}</Text>
                            <Text style={styles.value}>{formatValue(selected.totalLiters, 3)} L</Text>
                        </View>
                    </>
                ) : <Text style={styles.hint}>{t("tapDailyUsageBar")}</Text>}
            </View>
            <View testID="usage-chart" style={{ height: contentHeight, flexShrink: 0 }}>
                {requiredWidth > viewportWidth ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} testID="usage-bars-scroll"
                        style={{ width: viewportWidth, height: contentHeight, flexGrow: 0, flexShrink: 0 }}
                        contentContainerStyle={rowStyle}>
                        {bars}
                    </ScrollView>
                ) : <View style={rowStyle}>{bars}</View>}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    readout: { minHeight: 66, justifyContent: "center", paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10,
        borderRadius: 8, backgroundColor: colors.surfaceMuted },
    hint: { color: colors.textMuted, fontSize: 12, lineHeight: 18, flexShrink: 1 },
    selectedDate: { color: colors.text, fontSize: 13, lineHeight: 19, fontWeight: "600" },
    valueRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", columnGap: 12, rowGap: 2 },
    value: { color: colors.primary, fontSize: 18, lineHeight: 26, fontWeight: "700", fontVariant: ["tabular-nums"] },
    track: { justifyContent: "flex-end", backgroundColor: colors.track, borderRadius: 6, overflow: "hidden" },
    fill: { width: "100%", backgroundColor: colors.primary, borderRadius: 6 },
    selectedFill: { backgroundColor: colors.text },
    selectionOutline: { ...StyleSheet.absoluteFillObject, borderWidth: 2, borderColor: colors.text, borderRadius: 6 },
    label: { marginTop: 6, color: colors.textMuted, fontSize: 11, lineHeight: 16, textAlign: "center", width: "100%" },
    selectedLabel: { color: colors.text, fontWeight: "700" },
});
