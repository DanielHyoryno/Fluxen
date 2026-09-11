import { useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { colors } from "../theme/tokens";

// Stretch labels into the available space so values share a baseline even
// when a translation wraps. Large accessibility text switches to one column.
export default function MetricGrid({ items, muted = false, accent = false }) {
    const { fontScale } = useWindowDimensions();
    const [width, setWidth] = useState(0);
    const [valueHeights, setValueHeights] = useState({});
    const stacked = fontScale > 1.35 || (width > 0 && width < 270);
    const valueHeight = stacked ? undefined : Math.max(30 * fontScale, ...items.map((_, index) => valueHeights[index] || 0));

    return (
        <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
            style={[styles.row, stacked && styles.stacked]}>
            {items.map(({ label, value }, index) => (
                <View key={index} style={[styles.card, stacked && styles.stackedCard, muted && styles.muted]}>
                    <View style={styles.labelSpace}><Text style={styles.label}>{label}</Text></View>
                    <View style={{ minHeight: valueHeight }}>
                        <Text style={[styles.value, accent && styles.accent]}
                            onLayout={(event) => {
                                const height = event.nativeEvent.layout.height;
                                setValueHeights((current) => current[index] === height ? current : { ...current, [index]: height });
                            }}>{value}</Text>
                    </View>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: "row", gap: 10, marginBottom: 12, alignItems: "stretch" },
    stacked: { flexDirection: "column" },
    stackedCard: { flexGrow: 0, flexShrink: 0, flexBasis: "auto" },
    card: { flex: 1, minWidth: 0, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    muted: { backgroundColor: colors.surfaceMuted },
    labelSpace: { flexGrow: 1, marginBottom: 8 },
    label: { color: colors.textMuted, fontSize: 12, lineHeight: 18, fontWeight: "700", textTransform: "uppercase" },
    value: { color: colors.text, fontSize: 22, lineHeight: 30, fontWeight: "800", fontVariant: ["tabular-nums"] },
    accent: { color: colors.primary },
});
