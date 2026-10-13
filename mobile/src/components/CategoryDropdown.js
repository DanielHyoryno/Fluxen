import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/tokens";

export default function CategoryDropdown({ categories, value, onChange, emptyLabel, label }) {
    const [open, setOpen] = useState(false);
    const options = [{ id: null, name: emptyLabel }, ...categories];
    const selected = options.find((item) => String(item.id) === String(value));
    return (
        <View>
            <Pressable accessibilityRole="button" accessibilityLabel={label}
                accessibilityValue={{ text: selected?.name || emptyLabel }}
                accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)}
                style={[styles.field, open && styles.focused]}>
                <Text style={styles.value}>{selected?.name || emptyLabel}</Text>
                <Text style={styles.arrow} accessible={false}>{open ? "⌃" : "⌄"}</Text>
            </Pressable>
            {open && (
                <ScrollView style={styles.menu} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {options.map((item) => {
                        const active = String(item.id) === String(value);
                        return (
                            <Pressable key={String(item.id)} accessibilityRole="button"
                                accessibilityState={{ selected: active }}
                                onPress={() => { onChange(item.id); setOpen(false); }}
                                style={[styles.option, active && styles.selected]}>
                                <Text style={[styles.value, active && styles.activeText]}>{item.name}</Text>
                                {active && <Text style={styles.activeText} accessible={false}>✓</Text>}
                            </Pressable>
                        );
                    })}
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    field: { minHeight: 46, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 12 },
    focused: { borderColor: colors.primary },
    value: { flex: 1, fontSize: 14, color: colors.text },
    arrow: { fontSize: 18, color: colors.textMuted },
    menu: { maxHeight: 220, marginTop: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.surface },
    option: { minHeight: 44, padding: 12, flexDirection: "row", alignItems: "center", gap: 12 },
    selected: { backgroundColor: colors.primarySoft },
    activeText: { color: colors.primary, fontWeight: "600" },
});
