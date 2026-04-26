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
    paddingBottom: 28,
  },
  deviceName: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1d3551",
  },
  deviceMeta: {
    color: "#4d6480",
    marginTop: 4,
    marginBottom: 12,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbe6f5",
    padding: 14,
    marginBottom: 10,
  },
  cardInner: {
    paddingVertical: 2,
  },
  cardTitle: {
    color: "#1d3551",
    fontWeight: "700",
    marginBottom: 6,
  },
  metric: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f62fe",
  },
  meta: {
    color: "#4d6480",
    marginTop: 2,
  },
  rangeRow: {
    flexDirection: "row",
    gap: 10,
  },
  rangeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#dbe6f5",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  rangeButtonActive: {
    backgroundColor: "#0f62fe",
    borderColor: "#0f62fe",
  },
  rangeButtonPressed: {
    opacity: 0.85,
  },
  rangeButtonText: {
    color: "#1d3551",
    fontWeight: "600",
  },
  rangeButtonTextActive: {
    color: "#fff",
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
    backgroundColor: "#edf2fa",
    borderRadius: 3,
    overflow: "hidden",
  },
  chartBar: {
    backgroundColor: "#0f62fe",
    borderRadius: 3,
    minHeight: 2,
  },
  chartLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  chartLabel: {
    color: "#4d6480",
    fontSize: 10,
  },
  chartCaption: {
    color: "#4d6480",
    fontSize: 10,
    textAlign: "center",
    marginTop: 4,
  },
  lineChartBox: {
    backgroundColor: "#f9fbff",
    borderWidth: 1,
    borderColor: "#e1eaf8",
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
    borderColor: "#dbe6f5",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#f9fbff",
  },
  customDateLabel: {
    color: "#4d6480",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  customDateValue: {
    color: "#1d3551",
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
    borderColor: "#dbe6f5",
    backgroundColor: "#fff",
  },
  chartTypeButtonActive: {
    borderColor: "#0f62fe",
    backgroundColor: "#edf4ff",
  },
  chartTypeText: {
    color: "#35506d",
    fontWeight: "600",
    fontSize: 12,
  },
  chartTypeTextActive: {
    color: "#0f62fe",
  },
  dailyTotalsStrip: {
    paddingTop: 8,
    gap: 8,
  },
  dailyTotalChip: {
    borderWidth: 1,
    borderColor: "#dbe6f5",
    backgroundColor: "#f9fbff",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 88,
  },
  dailyTotalDate: {
    color: "#4d6480",
    fontSize: 11,
  },
  dailyTotalValue: {
    color: "#1d3551",
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
  calendarHint: {
    color: "#4d6480",
    fontSize: 12,
    marginTop: 8,
  },
  webPickerWrap: {
    borderWidth: 1,
    borderColor: "#dbe6f5",
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#f9fbff",
    gap: 8,
  },
  webPickerValue: {
    color: "#1d3551",
    fontWeight: "600",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 8,
  },
  modalSecondaryButton: {
    backgroundColor: "#eef4ff",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  modalSecondaryText: {
    color: "#0f62fe",
    fontWeight: "700",
  },
  modalPrimaryButton: {
    backgroundColor: "#0f62fe",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  modalPrimaryText: {
    color: "#fff",
    fontWeight: "700",
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#dbe6f5",
    marginBottom: 2,
  },
  headerText: {
    color: "#4d6480",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#edf2fa",
    paddingTop: 8,
    marginTop: 8,
  },
  historyText: {
    color: "#1d3551",
    fontSize: 12,
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
    backgroundColor: "#eef4ff",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  viewMoreText: {
    color: "#0f62fe",
    fontWeight: "700",
    fontSize: 12,
  },
  exportButton: {
    backgroundColor: "#0f62fe",
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
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});

export default styles;
