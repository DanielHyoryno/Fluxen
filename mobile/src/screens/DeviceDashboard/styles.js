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
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  deviceHeaderLeft: {
    flex: 1,
  },
  deviceName: {
    fontSize: 26,
    fontWeight: "700",
    color: "#183654",
  },
  deviceMeta: {
    color: "#55708a",
    marginTop: 4,
  },
  editDeviceButton: {
    backgroundColor: "#edf2fa",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 4,
  },
  editDeviceButtonPressed: {
    backgroundColor: "#dbe6f5",
  },
  editDeviceButtonText: {
    color: "#0f62fe",
    fontWeight: "600",
    fontSize: 14,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbe6f5",
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
    color: "#1d3551",
    fontWeight: "700",
    marginBottom: 6,
  },
  liveHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  liveChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#eef4ff",
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
    backgroundColor: "#0f62fe",
  },
  liveDotOffline: {
    backgroundColor: "#8fa0b4",
  },
  liveText: {
    color: "#0f62fe",
    fontSize: 11,
    fontWeight: "700",
  },
  liveTextOffline: {
    color: "#5f738b",
  },
  mainMetric: {
    fontSize: 30,
    fontWeight: "700",
    color: "#0f62fe",
  },
  metric: {
    fontSize: 21,
    fontWeight: "700",
    color: "#16426d",
  },
  meta: {
    color: "#4d6480",
    marginTop: 2,
  },
  metaStrong: {
    color: "#2b4b6a",
    marginTop: 4,
    fontWeight: "700",
    fontSize: 12,
  },
  overviewDetailButton: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: "#eef4ff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  overviewDetailButtonPressed: {
    opacity: 0.85,
  },
  overviewDetailButtonText: {
    color: "#0f62fe",
    fontWeight: "700",
    fontSize: 12,
  },
  alertItem: {
    borderTopWidth: 1,
    borderTopColor: "#edf2fa",
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
    fontSize: 12,
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
    fontSize: 12,
  },
  todayHistoryBox: {
    maxHeight: 320,
  },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#edf2fa",
    paddingTop: 8,
    marginTop: 8,
  },
  historyTime: {
    color: "#27435e",
    width: 70,
  },
  historyValue: {
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
    backgroundColor: "#eef4ff",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  todayHistoryMoreText: {
    color: "#0f62fe",
    fontWeight: "700",
    fontSize: 12,
  },
  limitButton: {
    backgroundColor: "#edf2fa",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  limitButtonPressed: {
    backgroundColor: "#dbe6f5",
  },
  limitButtonText: {
    color: "#0f62fe",
    fontWeight: "600",
    fontSize: 14,
  },
  historyButton: {
    backgroundColor: "#0f62fe",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#0f62fe",
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 4,
  },
  historyButtonPressed: {
    opacity: 0.85,
  },
  historyButtonText: {
    color: "#fff",
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
    color: "#55708a",
    fontSize: 10,
  },
  chartCaption: {
    color: "#55708a",
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
  hourlyLineChartBox: {
    marginTop: 4,
    width: "100%",
    backgroundColor: "#f9fbff",
    borderWidth: 1,
    borderColor: "#e1eaf8",
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
    color: "#55708a",
    fontSize: 9,
  },
  hourlyGuideText: {
    color: "#9a6700",
    fontSize: 11,
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
});

export default styles;
