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
    paddingTop: 16,
    paddingHorizontal: 16,
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
  cardTitle: {
    fontWeight: "800",
    color: "#1d3551",
    marginBottom: 10,
  },
  addRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d4dde7",
    borderRadius: 10,
    backgroundColor: "#fff",
    color: "#1a3047",
    paddingHorizontal: 12,
    paddingVertical: 10,
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
    color: "#fff",
    fontWeight: "700",
  },
  error: {
    color: "#a61d1d",
    marginBottom: 8,
  },
  editBox: {
    borderWidth: 1,
    borderColor: "#dbe6f5",
    backgroundColor: "#f9fbff",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  editTitle: {
    color: "#35506d",
    fontWeight: "700",
    marginBottom: 8,
  },
  editActions: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
  },
  saveButton: {
    backgroundColor: "#0f62fe",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  saveText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  cancelButton: {
    backgroundColor: "#eef4ff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cancelText: {
    color: "#0f62fe",
    fontWeight: "700",
    fontSize: 12,
  },
  listContent: {
    paddingBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#edf2fa",
    paddingVertical: 10,
    gap: 8,
  },
  rowName: {
    flex: 1,
    color: "#17324d",
    fontWeight: "700",
  },
  rowActions: {
    flexDirection: "row",
    gap: 8,
  },
  editButton: {
    backgroundColor: "#eef4ff",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  editText: {
    color: "#0f62fe",
    fontWeight: "700",
    fontSize: 12,
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
    fontSize: 12,
  },
  empty: {
    color: "#55708a",
    fontStyle: "italic",
    marginTop: 6,
  },
});

export default styles;
