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
    },
    title: {
        fontSize: 24,
        fontWeight: "700",
        color: "#183654",
        marginBottom: 6,
    },
    subtitle: {
        color: "#55708a",
        marginBottom: 20,
        lineHeight: 20,
    },
    card: {
        backgroundColor: "#fff",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#dbe6f5",
        padding: 16,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontWeight: "600",
        color: "#1d3551",
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: "#dbe6f5",
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: "#183654",
        backgroundColor: "#fcfdff",
    },
    button: {
        backgroundColor: "#0f62fe",
        padding: 14,
        borderRadius: 8,
        alignItems: "center",
        marginTop: 8,
    },
    buttonPressed: {
        opacity: 0.8,
    },
    buttonDisabled: {
        backgroundColor: "#8daee6",
    },
    buttonText: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 16,
    },
    error: {
        color: "#a61d1d",
        marginBottom: 16,
        backgroundColor: "#ffe6e6",
        padding: 10,
        borderRadius: 8,
        overflow: "hidden",
    },
    success: {
        color: "#1d803e",
        marginBottom: 16,
        backgroundColor: "#e6ffed",
        padding: 10,
        borderRadius: 8,
        overflow: "hidden",
    },
});

export default styles;
