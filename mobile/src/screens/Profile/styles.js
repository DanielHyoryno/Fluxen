import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#f4f8ff",
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#17324d",
  },
  subtitle: {
    marginTop: 2,
    marginBottom: 14,
    color: "#4f6982",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbe6f5",
    padding: 14,
  },
  label: {
    color: "#55708a",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    marginTop: 6,
  },
  value: {
    color: "#1d3551",
    fontWeight: "700",
    marginTop: 4,
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
