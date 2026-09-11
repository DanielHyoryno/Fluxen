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
