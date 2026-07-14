import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
    loadingPage: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f4f8ff",
    },
    page: {
        flex: 1,
        backgroundColor: "#f4f8ff",
    },
    content: {
        padding: 16,
        paddingBottom: 40,
    },
    title: {
        fontSize: 28,
        fontWeight: "800",
        color: "#17324d",
    },
    subtitle: {
        color: "#55708a",
        marginTop: 6,
        marginBottom: 14,
    },
    heroCard: {
        backgroundColor: "#fff",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#dbe6f5",
        padding: 14,
        marginBottom: 12,
    },
    heroHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
    },
    heroEyebrow: {
        color: "#1d3551",
        fontWeight: "800",
        fontSize: 18,
    },
    heroHeaderAction: {
        backgroundColor: "#0f62fe",
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    heroHeaderActionText: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "700",
    },
    heroValue: {
        color: "#17324d",
        fontSize: 26,
        fontWeight: "900",
        marginTop: 6,
    },
    heroRangeBlock: {
        marginTop: 12,
    },
    heroStats: {
        flexDirection: "row",
        gap: 10,
        marginTop: 12,
    },
    heroStatBox: {
        flex: 1,
        backgroundColor: "#f9fbff",
        borderWidth: 1,
        borderColor: "#e1eaf8",
        borderRadius: 10,
        padding: 10,
    },
    heroStatLabel: {
        color: "#55708a",
        fontSize: 11,
        fontWeight: "700",
        textTransform: "uppercase",
    },
    heroStatValue: {
        color: "#17324d",
        fontWeight: "800",
        fontSize: 18,
        marginTop: 6,
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
        backgroundColor: "#fff",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#dbe6f5",
        padding: 14,
        marginBottom: 12,
    },
    cardTitle: {
        color: "#1d3551",
        fontWeight: "800",
        marginBottom: 10,
    },
    row: {
        flexDirection: "row",
        gap: 10,
        flexWrap: "wrap",
    },
    inputGroupWide: {
        flex: 1,
        minWidth: 160,
    },
    label: {
        color: "#4d6480",
        fontSize: 12,
        fontWeight: "700",
        marginBottom: 6,
    },
    input: {
        borderWidth: 1,
        borderColor: "#dbe6f5",
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: "#f9fbff",
        color: "#17324d",
    },
    button: {
        marginTop: 12,
        backgroundColor: "#0f62fe",
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 12,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: "#fff",
        fontWeight: "800",
    },
    helperText: {
        color: "#55708a",
        marginTop: 8,
        lineHeight: 18,
        fontSize: 12,
    },
    presetRow: {
        flexDirection: "row",
        gap: 8,
        flexWrap: "wrap",
        marginBottom: 10,
    },
    presetButton: {
        borderWidth: 1,
        borderColor: "#dbe6f5",
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: "#fff",
    },
    presetButtonActive: {
        borderColor: "#0f62fe",
        backgroundColor: "#edf4ff",
    },
    presetButtonText: {
        color: "#35506d",
        fontWeight: "700",
        fontSize: 12,
    },
    presetButtonTextActive: {
        color: "#0f62fe",
    },
    customDateButton: {
        flex: 1,
        minWidth: 150,
        borderWidth: 1,
        borderColor: "#dbe6f5",
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: "#f9fbff",
    },
    customDateLabel: {
        color: "#4d6480",
        fontSize: 11,
        fontWeight: "700",
        textTransform: "uppercase",
    },
    customDateValue: {
        color: "#17324d",
        fontWeight: "700",
        marginTop: 4,
    },
    rangeText: {
        color: "#55708a",
    },
    chipRow: {
        gap: 8,
    },
    chip: {
        borderWidth: 1,
        borderColor: "#dbe6f5",
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: "#fff",
    },
    chipActive: {
        borderColor: "#0f62fe",
        backgroundColor: "#edf4ff",
    },
    chipText: {
        color: "#35506d",
        fontWeight: "700",
    },
    chipTextActive: {
        color: "#0f62fe",
    },
    deviceRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        borderWidth: 1,
        borderColor: "#e4ecf8",
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
        backgroundColor: "#f9fbff",
    },
    deviceRowChecked: {
        borderColor: "#0f62fe",
        backgroundColor: "#edf4ff",
    },
    checkbox: {
        width: 18,
        height: 18,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: "#8ca1bb",
        backgroundColor: "#fff",
    },
    checkboxChecked: {
        backgroundColor: "#0f62fe",
        borderColor: "#0f62fe",
    },
    deviceInfo: {
        flex: 1,
    },
    deviceName: {
        color: "#17324d",
        fontWeight: "700",
    },
    deviceMeta: {
        color: "#55708a",
        marginTop: 2,
        fontSize: 12,
    },
    summaryLine: {
        color: "#27435e",
        marginBottom: 6,
        fontWeight: "600",
    },
    resultList: {
        marginTop: 10,
        gap: 8,
    },
    resultRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderTopWidth: 1,
        borderTopColor: "#edf2fa",
        paddingTop: 10,
    },
    resultCost: {
        color: "#0f62fe",
        fontWeight: "800",
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: "rgba(13,23,36,0.35)",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
    },
    modalCard: {
        width: "100%",
        maxWidth: 420,
        backgroundColor: "#fff",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#dbe6f5",
        padding: 14,
    },
    modalTitle: {
        color: "#1a3047",
        fontWeight: "700",
        fontSize: 17,
        marginBottom: 8,
    },
    modalActions: {
        flexDirection: "row",
        justifyContent: "flex-end",
        marginTop: 10,
    },
    modalCloseButton: {
        backgroundColor: "#eef4ff",
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    modalCloseText: {
        color: "#0f62fe",
        fontWeight: "700",
    },
});

export default styles;
