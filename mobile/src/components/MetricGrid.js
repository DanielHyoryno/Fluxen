import { useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { colors } from "../theme/tokens";

// Compact, shared typography. Only unusually narrow layouts or large
// accessibility text switch to one column.
export default function MetricGrid({ items, muted = false, accent = false }) {
    const { fontScale } = useWindowDimensions();
    const [width, setWidth] = useState(0);
    const stacked = fontScale > 1.35 || (width > 0 && width < 220);

    return (
        <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
            style={[styles.row, stacked && styles.stacked]}>
            {items.map(({ label, value }, index) => (
                <View key={index} style={[styles.card, stacked && styles.stackedCard, muted && styles.muted]}>
                    <View style={styles.labelSpace}>
                        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={styles.label}>{label}</Text>
                    </View>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}
                        style={[styles.value, accent && styles.accent]}>{value}</Text>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: "row", gap: 10, marginBottom: 12, alignItems: "stretch" },
    stacked: { flexDirection: "column" },
    stackedCard: { flexGrow: 0, flexShrink: 0, flexBasis: "auto" },
    card: { flex: 1, minWidth: 0, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    muted: { backgroundColor: colors.surfaceMuted },
    labelSpace: { marginBottom: 6 },
    label: { color: colors.textMuted, fontSize: 11, lineHeight: 16, fontWeight: "600", includeFontPadding: false },
    value: { color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: "700", includeFontPadding: false, fontVariant: ["tabular-nums"] },
    accent: { color: colors.primary },
});
