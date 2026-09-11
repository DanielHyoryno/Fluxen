import { colors } from "../../theme/tokens";
import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
    loadingPage: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.background,
    },
    page: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        padding: 16,
        paddingBottom: 40,
    },
    title: {
        fontSize: 28,
        fontWeight: "800",
        color: colors.text,
    },
    subtitle: {
        color: colors.textMuted,
        marginTop: 6,
        marginBottom: 14,
    },
    error: {
        color: "#a61d1d",
        marginBottom: 10,
    },
    success: {
        color: "#0a6f2f",
        marginBottom: 10,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
    },
    cardTitle: {
        color: colors.text,
        fontWeight: "800",
        marginBottom: 12,
    },
    label: {
        color: colors.textMuted,
        fontSize: 13,
        fontWeight: "700",
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 11,
        backgroundColor: colors.surfaceMuted,
        color: colors.text,
    },
    helperText: {
        color: colors.textMuted,
        marginTop: 10,
        lineHeight: 19,
        fontSize: 13,
    },
    button: {
        marginTop: 16,
        backgroundColor: colors.primary,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 12,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: colors.surface,
        fontWeight: "800",
    },
});

export default styles;
