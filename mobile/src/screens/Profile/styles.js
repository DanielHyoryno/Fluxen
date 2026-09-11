import { colors } from "../../theme/tokens";
import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
    page: {
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: 42,
        paddingHorizontal: 16,
        paddingBottom: 120,
    },
    header: {
        marginBottom: 0,
    },
    title: {
        fontSize: 24,
        lineHeight: 30,
        fontWeight: "800",
        color: colors.text,
    },
    subtitle: {
        marginTop: 6,
        marginBottom: 14,
        color: colors.textMuted,
        lineHeight: 22,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 14,
        marginBottom: 12,
    },
    label: {
        color: colors.textMuted,
        fontSize: 13,
        fontWeight: "700",
        textTransform: "uppercase",
        marginTop: 6,
    },
    value: {
        color: colors.text,
        fontWeight: "700",
        marginTop: 4,
    },
    sectionTitle: {
        color: colors.text,
        fontWeight: "800",
        marginBottom: 8,
    },
    sectionHelp: {
        color: colors.textMuted,
        fontSize: 13,
        marginBottom: 10,
    },
    languageRow: {
        flexDirection: "row",
        gap: 8,
        flexWrap: "wrap",
    },
    languageButton: {
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    languageButtonActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    languageButtonText: {
        color: "#35506d",
        fontWeight: "700",
        fontSize: 13,
    },
    languageButtonTextActive: {
        color: colors.surface,
    },
    logoutButton: {
        marginTop: 14,
        backgroundColor: "#ffe9e9",
        borderWidth: 1,
        borderColor: "#f0b8b8",
        borderRadius: 10,
        paddingVertical: 12,
        alignItems: "center",
    },
    logoutText: {
        color: "#a61d1d",
        fontWeight: "800",
    },
});

export default styles;
