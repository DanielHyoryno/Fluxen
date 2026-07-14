import { Modal, Pressable, Text, View } from "react-native";

export default function ConfirmDialog({
    visible,
    title = "Confirm Action",
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    onConfirm,
    onCancel,
}) {
    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
            <View
                style={{
                    flex: 1,
                    backgroundColor: "rgba(13,23,36,0.35)",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 20,
                }}
            >
                <View
                    style={{
                        width: "100%",
                        maxWidth: 420,
                        backgroundColor: "#fff",
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: "#dbe6f5",
                        padding: 16,
                    }}
                >
                    <Text style={{ color: "#1a3047", fontWeight: "700", fontSize: 18, textAlign: "center" }}>
                        {title}
                    </Text>
                    <Text style={{ color: "#4f6982", marginTop: 8, textAlign: "center", lineHeight: 21 }}>
                        {message}
                    </Text>
                    <View style={{ flexDirection: "row", justifyContent: "center", gap: 10, marginTop: 16 }}>
                        <Pressable
                            onPress={onCancel}
                            style={{
                                flex: 1,
                                maxWidth: 140,
                                backgroundColor: "#eef4ff",
                                borderRadius: 8,
                                paddingVertical: 10,
                                paddingHorizontal: 12,
                                alignItems: "center",
                            }}
                        >
                            <Text style={{ color: "#0f62fe", fontWeight: "700", fontSize: 13 }}>{cancelText}</Text>
                        </Pressable>
                        <Pressable
                            onPress={onConfirm}
                            style={{
                                flex: 1,
                                maxWidth: 140,
                                backgroundColor: "#ffe3e3",
                                borderRadius: 8,
                                paddingVertical: 10,
                                paddingHorizontal: 12,
                                alignItems: "center",
                            }}
                        >
                            <Text style={{ color: "#a61d1d", fontWeight: "700", fontSize: 13 }}>{confirmText}</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
