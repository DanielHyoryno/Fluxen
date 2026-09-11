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
        paddingBottom: 28,
    },
    topSectionWrap: {
        gap: 10,
    },
    topSectionWrapWide: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
    },
    topSectionItem: {
        width: "100%",
    },
    topSectionItemWide: {
        flex: 1,
    },
    deviceHeader: {
        flexDirection: "row",
        gap: 12,
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 12,
    },
    deviceHeaderLeft: {
        flex: 1,
        minWidth: 0,
    },
    deviceName: {
        fontSize: 26,
        fontWeight: "700",
        color: colors.text,
    },
    deviceMeta: {
        color: colors.textMuted,
        marginTop: 4,
    },
    editDeviceButton: {
        flexShrink: 1,
        maxWidth: "40%",
        minHeight: 44,
        justifyContent: "center",
        backgroundColor: colors.track,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        marginTop: 4,
    },
    editDeviceButtonPressed: {
        backgroundColor: colors.border,
    },
    editDeviceButtonText: {
        color: colors.primary,
        fontWeight: "600",
        fontSize: 14,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 14,
        marginBottom: 10,
    },
    row: {
        flexDirection: "row",
        gap: 10,
    },
    cardHalf: {
        flex: 1,
    },
    cardTitle: {
        color: colors.text,
        fontWeight: "700",
        marginBottom: 6,
    },
    liveHeader: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 8,
        justifyContent: "space-between",
        alignItems: "center",
    },
    liveChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: colors.primarySoft,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    liveChipOffline: {
        backgroundColor: "#f5f7fa",
    },
    liveDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: colors.primary,
    },
    liveDotOffline: {
        backgroundColor: "#8fa0b4",
    },
    liveText: {
        color: colors.primary,
        fontSize: 13,
        fontWeight: "700",
    },
    liveTextOffline: {
        color: "#5f738b",
    },
    mainMetric: {
        fontSize: 30,
        fontWeight: "700",
        color: colors.primary,
    },
    metric: {
        fontSize: 21,
        fontWeight: "700",
        color: colors.text,
    },
    meta: {
        color: colors.textMuted,
        marginTop: 2,
    },
    metaStrong: {
        color: "#2b4b6a",
        marginTop: 4,
        fontWeight: "700",
        fontSize: 13,
    },
    overviewDetailButton: {
        marginTop: 12,
        alignSelf: "flex-start",
        backgroundColor: colors.primarySoft,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    overviewDetailButtonPressed: {
        opacity: 0.85,
    },
    overviewDetailButtonText: {
        color: colors.primary,
        fontWeight: "700",
        fontSize: 13,
    },
    alertItem: {
        borderTopWidth: 1,
        borderTopColor: colors.track,
        paddingTop: 8,
        marginTop: 8,
    },
    alertRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
    },
    alertContent: {
        flex: 1,
        marginRight: 10,
    },
    alertTitle: {
        fontWeight: "700",
        color: "#7a2323",
    },
    alertMsg: {
        color: "#8f3a3a",
        marginTop: 2,
    },
    alertMetaText: {
        color: "#8f3a3a",
        marginTop: 2,
        fontSize: 13,
        lineHeight: 16,
    },
    dismissButton: {
        backgroundColor: "#fef0f0",
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: "#f5c6c6",
    },
    dismissButtonPressed: {
        backgroundColor: "#fddcdc",
    },
    dismissButtonText: {
        color: "#a61d1d",
        fontWeight: "600",
        fontSize: 13,
    },
    todayHistoryBox: {
        maxHeight: 320,
    },
    historyRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        borderTopWidth: 1,
        borderTopColor: colors.track,
        paddingTop: 8,
        marginTop: 8,
    },
    historyTime: {
        color: "#27435e",
        width: 70,
    },
    historyValue: {
        flex: 1,
        marginLeft: 8,
        textAlign: "right",
        color: "#27435e",
        fontWeight: "600",
    },
    error: {
        color: "#a61d1d",
        marginBottom: 8,
    },
    todayHistoryMoreButton: {
        marginTop: 10,
        alignSelf: "center",
        backgroundColor: colors.primarySoft,
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    todayHistoryMoreText: {
        color: colors.primary,
        fontWeight: "700",
        fontSize: 13,
    },
    limitButton: {
        backgroundColor: colors.track,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    limitButtonPressed: {
        backgroundColor: colors.border,
    },
    limitButtonText: {
        color: colors.primary,
        fontWeight: "600",
        fontSize: 14,
    },
    historyButton: {
        backgroundColor: colors.primary,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.primary,
        paddingVertical: 12,
        alignItems: "center",
        marginBottom: 4,
    },
    historyButtonPressed: {
        opacity: 0.85,
    },
    historyButtonText: {
        color: colors.surface,
        fontWeight: "700",
        fontSize: 15,
    },
    chartContainer: {
        marginTop: 4,
    },
    chartBars: {
        flexDirection: "row",
        alignItems: "flex-end",
        height: 100,
        gap: 2,
    },
    chartBarCol: {
        flex: 1,
        height: "100%",
        justifyContent: "flex-end",
    },
    chartBarTrack: {
        flex: 1,
        justifyContent: "flex-end",
        backgroundColor: colors.track,
        borderRadius: 3,
        overflow: "hidden",
    },
    chartBar: {
        backgroundColor: colors.primary,
        borderRadius: 3,
        minHeight: 2,
    },
    chartLabels: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 6,
    },
    chartLabel: {
        color: colors.textMuted,
        fontSize: 13,
    },
    chartCaption: {
        color: colors.textMuted,
        fontSize: 13,
        textAlign: "center",
        marginTop: 4,
    },
    lineChartBox: {
        backgroundColor: colors.surfaceMuted,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 8,
        alignItems: "center",
    },
    hourlyLineChartBox: {
        marginTop: 4,
        width: "100%",
        backgroundColor: colors.surfaceMuted,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 8,
        alignItems: "center",
        overflow: "hidden",
    },
    hourlyLineLabels: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 6,
        width: "100%",
    },
    hourlyLineLabel: {
        color: colors.textMuted,
        fontSize: 13,
    },
    hourlyGuideText: {
        color: "#9a6700",
        fontSize: 13,
        marginTop: 2,
        textAlign: "center",
    },
    chartTypeRow: {
        flexDirection: "row",
        gap: 8,
        marginBottom: 8,
    },
    chartTypeButton: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    chartTypeButtonActive: {
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
    },
    chartTypeText: {
        color: "#35506d",
        fontWeight: "600",
        fontSize: 13,
    },
    chartTypeTextActive: {
        color: colors.primary,
    },
});

export default styles;
