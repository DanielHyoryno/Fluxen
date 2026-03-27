import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#f4f8ff",
    paddingTop: 56,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  header: {
    marginBottom: 10,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#17324d",
  },
  subtitle: {
    color: "#4f6982",
    marginTop: 2,
    marginBottom: 14,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbe6f5",
    padding: 14,
    marginBottom: 10,
  },
  sectionTitle: {
    fontWeight: "700",
    color: "#1d3551",
    marginBottom: 10,
  },
  primaryButton: {
    backgroundColor: "#0f62fe",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryText: {
    color: "#fff",
    fontWeight: "700",
  },
  secondaryButton: {
    backgroundColor: "#eef4ff",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 10,
  },
  secondaryText: {
    color: "#0f62fe",
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
    color: "#17324d",
    flex: 1,
    marginRight: 8,
  },
  meta: {
    color: "#4d6480",
    marginTop: 2,
  },
  metaLabel: {
    color: "#4f6982",
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d4dde7",
    borderRadius: 10,
    backgroundColor: "#fff",
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
    color: "#4d6480",
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
