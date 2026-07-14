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
        padding: 16,
    },
    cardTitle: {
        color: "#1d3551",
        fontWeight: "800",
        marginBottom: 12,
    },
    label: {
        color: "#4d6480",
        fontSize: 12,
        fontWeight: "700",
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: "#dbe6f5",
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 11,
        backgroundColor: "#f9fbff",
        color: "#17324d",
    },
    helperText: {
        color: "#55708a",
        marginTop: 10,
        lineHeight: 19,
        fontSize: 12,
    },
    button: {
        marginTop: 16,
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
});

export default styles;
