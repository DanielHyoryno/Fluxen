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
        paddingTop: 16,
        paddingHorizontal: 16,
    },
    title: {
        fontSize: 30,
        fontWeight: "800",
        color: colors.text,
    },
    subtitle: {
        color: colors.textMuted,
        marginTop: 2,
        marginBottom: 14,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
        marginBottom: 10,
    },
    cardTitle: {
        fontWeight: "800",
        color: colors.text,
        marginBottom: 12,
    },
    addRow: {
        flexDirection: "row",
        gap: 8,
        alignItems: "flex-start",
    },
    input: {
        flex: 1,
        borderWidth: 1,
        borderColor: "#d4dde7",
        borderRadius: 10,
        backgroundColor: colors.surface,
        color: "#1a3047",
        paddingHorizontal: 12,
        paddingVertical: 11,
    },
    addButton: {
        backgroundColor: "#1f7a3d",
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 11,
        alignItems: "center",
        justifyContent: "center",
        minWidth: 64,
    },
    addButtonText: {
        color: colors.surface,
        fontWeight: "700",
    },
    error: {
        color: "#a61d1d",
        marginBottom: 8,
    },
    editBox: {
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceMuted,
        borderRadius: 10,
        padding: 10,
        marginBottom: 10,
    },
    editTitle: {
        color: "#35506d",
        fontWeight: "700",
        marginBottom: 10,
    },
    editActions: {
        marginTop: 8,
        flexDirection: "row",
        gap: 8,
        justifyContent: "flex-end",
    },
    saveButton: {
        backgroundColor: colors.primary,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    saveText: {
        color: colors.surface,
        fontWeight: "700",
        fontSize: 13,
    },
    cancelButton: {
        backgroundColor: colors.primarySoft,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    cancelText: {
        color: colors.primary,
        fontWeight: "700",
        fontSize: 13,
    },
    listContent: {
        paddingBottom: 4,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderTopWidth: 1,
        borderTopColor: colors.track,
        paddingVertical: 10,
        gap: 8,
    },
    rowName: {
        flex: 1,
        color: colors.text,
        fontWeight: "700",
    },
    rowActions: {
        flexDirection: "row",
        gap: 8,
    },
    editButton: {
        backgroundColor: colors.primarySoft,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    editText: {
        color: colors.primary,
        fontWeight: "700",
        fontSize: 13,
    },
    deleteButton: {
        backgroundColor: "#ffe3e3",
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    deleteText: {
        color: "#a61d1d",
        fontWeight: "700",
        fontSize: 13,
    },
    empty: {
        color: colors.textMuted,
        fontStyle: "italic",
        marginTop: 6,
    },
});

export default styles;
