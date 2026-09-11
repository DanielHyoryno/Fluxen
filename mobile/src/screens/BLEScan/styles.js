import { colors } from "../../theme/tokens";
import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
    page: {
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: 42,
    },
    content: {
        paddingHorizontal: 16,
        paddingBottom: 120,
    },
    header: {
        marginBottom: 10,
    },
    title: {
        fontSize: 24,
        lineHeight: 30,
        fontWeight: "800",
        color: colors.text,
    },
    subtitle: {
        color: colors.textMuted,
        marginTop: 6,
        marginBottom: 14,
        lineHeight: 22,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 14,
        marginBottom: 10,
    },
    sectionTitle: {
        fontWeight: "700",
        color: colors.text,
        marginBottom: 10,
    },
    primaryButton: {
        backgroundColor: colors.primary,
        borderRadius: 10,
        paddingVertical: 12,
        alignItems: "center",
        marginBottom: 8,
    },
    primaryButtonDisabled: {
        opacity: 0.7,
    },
    primaryText: {
        color: colors.surface,
        fontWeight: "700",
    },
    secondaryButton: {
        backgroundColor: colors.primarySoft,
        borderRadius: 10,
        paddingVertical: 10,
        alignItems: "center",
        marginTop: 10,
    },
    secondaryText: {
        color: colors.primary,
        fontWeight: "700",
    },
    cardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    deviceName: {
        fontSize: 17,
        fontWeight: "700",
        color: colors.text,
        flex: 1,
        marginRight: 8,
    },
    meta: {
        color: colors.textMuted,
        marginTop: 2,
    },
    metaLabel: {
        color: colors.textMuted,
        fontWeight: "600",
        marginBottom: 6,
    },
    input: {
        borderWidth: 1,
        borderColor: "#d4dde7",
        borderRadius: 10,
        backgroundColor: colors.surface,
        color: "#1a3047",
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 10,
    },
    readOnlyBox: {
        borderWidth: 1,
        borderColor: "#d4dde7",
        borderRadius: 10,
        backgroundColor: "#f6f9ff",
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 10,
    },
    readOnlyText: {
        color: "#1a3047",
        fontWeight: "600",
    },
    error: {
        color: "#a61d1d",
        marginTop: 4,
    },
    empty: {
        marginTop: 8,
        textAlign: "center",
        color: colors.textMuted,
    },
    feedbackBox: {
        borderRadius: 10,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 8,
    },
    feedbackSuccess: {
        backgroundColor: "#dcfbe8",
        borderColor: "#95dfb5",
    },
    feedbackError: {
        backgroundColor: "#ffecec",
        borderColor: "#f3c3c3",
    },
    successText: {
        color: "#0a6f2f",
    },
});

export default styles;
