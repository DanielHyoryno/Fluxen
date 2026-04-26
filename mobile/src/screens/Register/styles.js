import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  page: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    backgroundColor: "#f5f7fb",
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    color: "#10243d",
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d4dde7",
    borderRadius: 10,
    backgroundColor: "#fff",
    color: "#1a3047",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: "#0f62fe",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  link: {
    marginTop: 16,
    textAlign: "center",
    color: "#0f62fe",
    fontWeight: "600",
  },
  error: {
    color: "#bd1e1e",
    marginBottom: 8,
  },
});

export default styles;
