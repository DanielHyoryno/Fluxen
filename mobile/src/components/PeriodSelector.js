import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { colors } from "../theme/tokens";

export default function PeriodSelector({ options, value, onChange }) {
    const { fontScale } = useWindowDimensions();
    return (
        <View style={styles.row}>
            {options.map((option) => (
                <Pressable key={option.key} onPress={() => onChange(option.key)}
                    accessibilityRole="button" accessibilityState={{ selected: option.key === value }}
                    style={({ pressed }) => [styles.button, fontScale > 1.35 && styles.largeText,
                        option.key === value && styles.active, pressed && styles.pressed]}>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}
                        style={[styles.label, option.key === value && styles.activeLabel]}>{option.label}</Text>
                </Pressable>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
    button: { flex: 1, minWidth: 56, minHeight: 44, paddingHorizontal: 10, paddingVertical: 8, alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    largeText: { flexBasis: "40%" },
    active: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    label: { color: colors.textMuted, fontSize: 12, lineHeight: 18, fontWeight: "600", includeFontPadding: false, textAlign: "center" },
    activeLabel: { color: colors.primary },
    pressed: { opacity: 0.72 },
});
