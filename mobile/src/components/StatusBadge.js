import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/tokens";

export default function StatusBadge({ online }) {
    return (
        <View style={[styles.badge, { backgroundColor: online ? colors.onlineSoft : colors.offlineSoft }]}>
            <View style={[styles.dot, { backgroundColor: online ? colors.online : colors.offline }]} />
            <Text style={[styles.label, { color: online ? colors.online : colors.offline }]}>{online ? "Online" : "Offline"}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20, flexShrink: 0 },
    dot: { width: 7, height: 7, borderRadius: 4 },
    label: { fontSize: 12, lineHeight: 18, fontWeight: "700" },
});
