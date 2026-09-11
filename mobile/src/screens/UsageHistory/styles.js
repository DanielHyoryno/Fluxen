import { colors } from "../../theme/tokens";
import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
    loadingPage: {
        flex: 1,
        backgroundColor: colors.background,
        padding: 16,
    },
    skeletonPage: {
        gap: 12,
    },
    page: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        padding: 16,
        paddingBottom: 28,
    },
    deviceName: {
        fontSize: 26,
        fontWeight: "700",
        color: colors.text,
    },
    deviceMeta: {
        color: colors.textMuted,
        marginTop: 4,
        marginBottom: 12,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 14,
        marginBottom: 10,
    },
    cardInner: {
        paddingVertical: 2,
    },
    summaryGrid: {
        flexDirection: "row",
        gap: 10,
        marginBottom: 10,
    },
    summaryTile: {
        flex: 1,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceMuted,
        borderRadius: 10,
        padding: 12,
    },
    summaryLabel: {
        color: colors.textMuted,
        fontSize: 13,
        fontWeight: "700",
        textTransform: "uppercase",
    },
    summaryTileValue: {
        color: colors.text,
        fontWeight: "700",
        fontSize: 18,
        marginTop: 6,
    },
    peakDayCard: {
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        borderRadius: 10,
        padding: 12,
    },
    cardTitle: {
        color: colors.text,
        fontWeight: "700",
        marginBottom: 6,
    },
    metric: {
        fontSize: 24,
        fontWeight: "700",
        color: colors.primary,
    },
    meta: {
        color: colors.textMuted,
        marginTop: 2,
    },
    rangeRow: {
        flexDirection: "row",
        gap: 10,
    },
    rangeButton: {
        flex: 1,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        paddingVertical: 8,
        alignItems: "center",
        backgroundColor: colors.surface,
    },
    rangeButtonActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    rangeButtonPressed: {
        opacity: 0.85,
    },
    rangeButtonText: {
        color: colors.text,
        fontWeight: "600",
    },
    rangeButtonTextActive: {
        color: colors.surface,
    },
    chartContainer: {
        marginTop: 4,
    },
    chartBars: {
        flexDirection: "row",
        alignItems: "flex-end",
        height: 110,
        gap: 3,
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
    customRangeWrap: {
        flexDirection: "row",
        gap: 10,
        marginTop: 8,
    },
    customDateButton: {
        flex: 1,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        backgroundColor: colors.surfaceMuted,
    },
    customDateLabel: {
        color: colors.textMuted,
        fontSize: 13,
        fontWeight: "700",
        textTransform: "uppercase",
    },
    customDateValue: {
        color: colors.text,
        marginTop: 4,
        fontWeight: "600",
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
    dailyTotalsStrip: {
        paddingTop: 8,
        gap: 8,
    },
    dailyTotalChip: {
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceMuted,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        minWidth: 88,
    },
    dailyTotalDate: {
        color: colors.textMuted,
        fontSize: 13,
    },
    dailyTotalValue: {
        color: colors.text,
        fontWeight: "700",
        marginTop: 3,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: "rgba(13,23,36,0.35)",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
    },
    calendarDialogCard: {
        width: "100%",
        maxWidth: 420,
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 14,
    },
    modalTitle: {
        color: "#1a3047",
        fontWeight: "700",
        fontSize: 17,
        marginBottom: 8,
    },
    calendarHint: {
        color: colors.textMuted,
        fontSize: 13,
        marginTop: 8,
    },
    webPickerWrap: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        padding: 10,
        backgroundColor: colors.surfaceMuted,
        gap: 8,
    },
    webPickerValue: {
        color: colors.text,
        fontWeight: "600",
    },
    modalActions: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 8,
        marginTop: 8,
    },
    modalSecondaryButton: {
        backgroundColor: colors.primarySoft,
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    modalSecondaryText: {
        color: colors.primary,
        fontWeight: "700",
    },
    modalPrimaryButton: {
        backgroundColor: colors.primary,
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    modalPrimaryText: {
        color: colors.surface,
        fontWeight: "700",
    },
    monthOptionGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    monthOption: {
        width: "31%",
        minWidth: 92,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        paddingVertical: 9,
        paddingHorizontal: 6,
        alignItems: "center",
        backgroundColor: colors.surfaceMuted,
    },
    monthOptionSelected: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    monthOptionPressed: {
        opacity: 0.82,
    },
    monthOptionText: {
        color: colors.text,
        fontWeight: "600",
        fontSize: 13,
    },
    monthOptionTextSelected: {
        color: colors.surface,
    },
    tableHeader: {
        flexDirection: "row",
        alignItems: "center",
        paddingBottom: 6,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        marginBottom: 2,
    },
    headerText: {
        color: colors.textMuted,
        fontSize: 13,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 0.3,
    },
    historyRow: {
        flexDirection: "row",
        alignItems: "center",
        borderTopWidth: 1,
        borderTopColor: colors.track,
        paddingTop: 8,
        marginTop: 8,
    },
    historyText: {
        color: colors.text,
        fontSize: 13,
    },
    historyDate: {
        flex: 1.1,
    },
    historyValue: {
        flex: 1,
        textAlign: "right",
        fontWeight: "600",
    },
    error: {
        color: "#a61d1d",
        marginBottom: 8,
    },
    viewMoreButton: {
        marginTop: 10,
        alignSelf: "center",
        backgroundColor: colors.primarySoft,
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    viewMoreText: {
        color: colors.primary,
        fontWeight: "700",
        fontSize: 13,
    },
    detailCard: {
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceMuted,
        borderRadius: 10,
        padding: 12,
        marginTop: 8,
    },
    detailListWrap: {
        maxHeight: 360,
    },
    detailDate: {
        color: colors.text,
        fontWeight: "700",
        marginBottom: 8,
    },
    detailMetricRow: {
        flexDirection: "row",
        gap: 10,
    },
    detailMetricItem: {
        flex: 1,
    },
    detailMetricLabel: {
        color: colors.textMuted,
        fontSize: 13,
        fontWeight: "700",
        textTransform: "uppercase",
    },
    detailMetricValue: {
        color: colors.text,
        fontWeight: "700",
        marginTop: 4,
        fontSize: 13,
    },
    exportPeriodRow: {
        flexDirection: "row",
        gap: 10,
    },
    exportPeriodField: {
        flex: 1,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: colors.surface,
    },
    exportPeriodFieldDisabled: {
        backgroundColor: "#edf1f6",
        borderColor: "#d9e0e8",
    },
    exportPeriodPressed: {
        opacity: 0.82,
    },
    exportPeriodLabel: {
        color: colors.textMuted,
        fontSize: 13,
        fontWeight: "700",
        textTransform: "uppercase",
    },
    exportPeriodLabelDisabled: {
        color: "#8a98a8",
        fontSize: 13,
        fontWeight: "700",
        textTransform: "uppercase",
    },
    exportPeriodValue: {
        color: colors.text,
        fontWeight: "700",
        marginTop: 5,
    },
    exportPeriodValueDisabled: {
        color: "#8a98a8",
        fontWeight: "700",
        marginTop: 5,
    },
    exportPeriodHint: {
        color: colors.textMuted,
        fontSize: 13,
        marginTop: 8,
    },
    exportButton: {
        backgroundColor: colors.primary,
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: "center",
        marginTop: 6,
        marginBottom: 4,
    },
    exportButtonPressed: {
        opacity: 0.85,
    },
    exportButtonDisabled: {
        backgroundColor: "#8daee6",
    },
    exportButtonText: {
        color: colors.surface,
        fontWeight: "700",
        fontSize: 15,
    },
});

export default styles;
