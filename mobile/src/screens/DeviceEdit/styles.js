import { colors } from "../../theme/tokens";
import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
    page: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        padding: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: "700",
        color: colors.text,
        marginBottom: 6,
    },
    subtitle: {
        color: colors.textMuted,
        marginBottom: 20,
        lineHeight: 20,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
    },
    infoRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.track,
    },
    infoLabel: {
        color: colors.textMuted,
        fontWeight: "600",
    },
    infoValue: {
        color: colors.text,
        fontWeight: "700",
        fontFamily: "monospace",
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontWeight: "600",
        color: colors.text,
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: colors.text,
        backgroundColor: "#fcfdff",
    },
    categoryOptions: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    categoryChip: {
        borderWidth: 1,
        borderColor: "#c8d8eb",
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: "#f8fbff",
    },
    categoryChipActive: {
        borderColor: colors.primary,
        backgroundColor: "#e8f0ff",
    },
    categoryChipText: {
        color: "#49637d",
        fontWeight: "600",
    },
    categoryChipTextActive: {
        color: colors.primary,
    },
    button: {
        backgroundColor: colors.primary,
        padding: 14,
        borderRadius: 8,
        alignItems: "center",
        marginTop: 8,
    },
    buttonPressed: {
        opacity: 0.8,
    },
    buttonDisabled: {
        backgroundColor: "#8daee6",
    },
    buttonText: {
        color: colors.surface,
        fontWeight: "600",
        fontSize: 16,
    },
    error: {
        color: "#a61d1d",
        marginBottom: 16,
        backgroundColor: "#ffe6e6",
        padding: 10,
        borderRadius: 8,
        overflow: "hidden",
    },
    success: {
        color: "#1d803e",
        marginBottom: 16,
        backgroundColor: "#e6ffed",
        padding: 10,
        borderRadius: 8,
        overflow: "hidden",
    },
});

export default styles;
