import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
    page: {
        flex: 1,
        backgroundColor: "#f4f8ff",
        paddingTop: 42,
        paddingHorizontal: 16,
        paddingBottom: 120,
    },
    header: {
        marginBottom: 0,
    },
    title: {
        fontSize: 24,
        lineHeight: 30,
        fontWeight: "800",
        color: "#17324d",
    },
    subtitle: {
        marginTop: 6,
        marginBottom: 14,
        color: "#4f6982",
        lineHeight: 22,
    },
    card: {
        backgroundColor: "#fff",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#dbe6f5",
        padding: 14,
        marginBottom: 12,
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
    sectionTitle: {
        color: "#1d3551",
        fontWeight: "800",
        marginBottom: 8,
    },
    sectionHelp: {
        color: "#55708a",
        fontSize: 12,
        marginBottom: 10,
    },
    languageRow: {
        flexDirection: "row",
        gap: 8,
        flexWrap: "wrap",
    },
    languageButton: {
        borderWidth: 1,
        borderColor: "#dbe6f5",
        backgroundColor: "#fff",
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    languageButtonActive: {
        backgroundColor: "#0f62fe",
        borderColor: "#0f62fe",
    },
    languageButtonText: {
        color: "#35506d",
        fontWeight: "700",
        fontSize: 13,
    },
    languageButtonTextActive: {
        color: "#fff",
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
