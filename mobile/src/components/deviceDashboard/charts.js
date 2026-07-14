import { Text, View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import styles from "../../screens/DeviceDashboard/styles";
import { formatDateLabel, formatNumber } from "../../common/deviceDashboard/formatters";

export function FlowBarChart({ data }) {
    if (!data || data.length === 0) return null;

    const items = data.slice(-20);
    const maxFlow = items.reduce((max, d) => Math.max(max, Number(d.flow_rate_lpm || 0)), 0);
    const chartMax = maxFlow > 0 ? maxFlow * 1.15 : 1;
    const tickIndexes = [0, Math.floor((items.length - 1) / 2), items.length - 1].filter(
        (v, i, arr) => arr.indexOf(v) === i
    );

    return (
        <View style={styles.chartContainer}>
            <View style={styles.chartBars}>
                {items.map((item, idx) => {
                    const val = Number(item.flow_rate_lpm || 0);
                    const pct = (val / chartMax) * 100;
                    return (
                        <View key={`${item.measured_at}-${idx}`} style={styles.chartBarCol}>
                            <View style={styles.chartBarTrack}>
                                <View style={[styles.chartBar, { height: `${Math.max(pct, 2)}%` }]} />
                            </View>
                        </View>
                    );
                })}
            </View>
            <View style={styles.chartLabels}>
                {tickIndexes.map((idx) => (
                    <Text key={`tick-${idx}`} style={styles.chartLabel}>
                        {formatDateLabel(items[idx].measured_at)}
                    </Text>
                ))}
            </View>
            <Text style={styles.chartCaption}>Flow rate (peak {formatNumber(maxFlow, 2)} L/min)</Text>
        </View>
    );
}

export function FlowLineChart({ data, chartWidth }) {
    if (!data || data.length === 0) return null;

    const items = data.slice(-20);
    const maxFlow = items.reduce((max, d) => Math.max(max, Number(d.flow_rate_lpm || 0)), 0);
    const chartMax = maxFlow > 0 ? maxFlow * 1.15 : 1;
    const chartHeight = 100;
    const width = Math.max(220, chartWidth || 300);
    const tickIndexes = [0, Math.floor((items.length - 1) / 2), items.length - 1].filter(
        (v, i, arr) => arr.indexOf(v) === i
    );

    const points = items
        .map((item, idx) => {
            const val = Number(item.flow_rate_lpm || 0);
            const x = items.length <= 1 ? width / 2 : (idx / (items.length - 1)) * width;
            const y = chartHeight - (val / chartMax) * chartHeight;
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
                    {items.map((item, idx) => {
                        const val = Number(item.flow_rate_lpm || 0);
                        const x = items.length <= 1 ? width / 2 : (idx / (items.length - 1)) * width;
                        const y = chartHeight - (val / chartMax) * chartHeight;
                        return <Circle key={`linept-${item.measured_at}-${idx}`} cx={x} cy={y} r="3" fill="#0f62fe" />;
                    })}
                </Svg>
            </View>
            <View style={styles.chartLabels}>
                {tickIndexes.map((idx) => (
                    <Text key={`dot-tick-${idx}`} style={styles.chartLabel}>
                        {formatDateLabel(items[idx].measured_at)}
                    </Text>
                ))}
            </View>
            <Text style={styles.chartCaption}>Line trend (peak {formatNumber(maxFlow, 2)} L/min)</Text>
        </View>
    );
}

export function HourlyUsageLineChart({ hourlySeries, chartWidth, hourlyGuide }) {
    if (!hourlySeries || hourlySeries.length === 0) return null;

    const baseWidth = Math.max(220, chartWidth || 320);
    const height = 120;
    const maxVal = hourlySeries.reduce(
        (max, item) => Math.max(max, Number(item.totalLiters || 0), Number(hourlyGuide || 0)),
        0
    );
    const chartMax = maxVal > 0 ? maxVal * 1.1 : 1;

    const points = hourlySeries
        .map((item, idx) => {
            const val = Number(item.totalLiters || 0);
            const x = hourlySeries.length <= 1 ? baseWidth / 2 : (idx / (hourlySeries.length - 1)) * baseWidth;
            const y = height - (val / chartMax) * height;
            return `${x},${y}`;
        })
        .join(" ");

    const guideY = Number(hourlyGuide || 0) > 0 ? height - (Number(hourlyGuide) / chartMax) * height : null;
    const labelIndexes = [0, 6, 12, 18, 23];

    return (
        <View style={styles.hourlyLineChartBox}>
            <Svg width="100%" height={height} viewBox={`0 0 ${baseWidth} ${height}`} preserveAspectRatio="none">
                <Line x1="0" y1={height} x2={baseWidth} y2={height} stroke="#dbe6f5" strokeWidth="1" />
                <Line x1="0" y1="0" x2="0" y2={height} stroke="#dbe6f5" strokeWidth="1" />
                {guideY !== null ? (
                    <Line
                        x1="0"
                        y1={guideY}
                        x2={baseWidth}
                        y2={guideY}
                        stroke="#f59e0b"
                        strokeDasharray="4 4"
                        strokeWidth="1.5"
                    />
                ) : null}
                <Polyline fill="none" stroke="#0f62fe" strokeWidth="2.5" points={points} />
                {hourlySeries.map((item, idx) => {
                    const val = Number(item.totalLiters || 0);
                    const x = hourlySeries.length <= 1 ? baseWidth / 2 : (idx / (hourlySeries.length - 1)) * baseWidth;
                    const y = height - (val / chartMax) * height;
                    return <Circle key={`hr-${item.hour}-${idx}`} cx={x} cy={y} r="2.7" fill="#0f62fe" />;
                })}
            </Svg>
            <View style={styles.hourlyLineLabels}>
                {labelIndexes.map((idx) => (
                    <Text key={`hr-lbl-${idx}`} style={styles.hourlyLineLabel}>
                        {String(idx).padStart(2, "0")}
                    </Text>
                ))}
            </View>
            <Text style={styles.chartCaption}>Hourly usage trend (today)</Text>
            {hourlyGuide && hourlyGuide > 0 ? (
                <Text style={styles.hourlyGuideText}>
                    Guide from daily limit: {formatNumber(hourlyGuide, 3)} L/hour
                </Text>
            ) : null}
        </View>
    );
}
