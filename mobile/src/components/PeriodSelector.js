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
                    <Text style={[styles.label, option.key === value && styles.activeLabel]}>{option.label}</Text>
                </Pressable>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
    button: { flex: 1, minWidth: 56, minHeight: 44, paddingHorizontal: 5, paddingVertical: 10, alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    largeText: { flexBasis: "40%" },
    active: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    label: { color: colors.textMuted, fontSize: 13, lineHeight: 20, fontWeight: "700", textAlign: "center" },
    activeLabel: { color: colors.primary },
    pressed: { opacity: 0.72 },
});
