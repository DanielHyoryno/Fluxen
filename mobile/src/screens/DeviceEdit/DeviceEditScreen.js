import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { updateDeviceApi } from "../../services/api";
import styles from "./styles";

export default function DeviceEditScreen({ route, navigation }) {
    const { device } = route.params;
    const { token } = useAuth();

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

    const [deviceName, setDeviceName] = useState(device.device_name || "");
    const [installLocation, setInstallLocation] = useState(device.install_location || "");

    async function handleSave() {
        setError("");
        setSuccessMsg("");

        const trimmedName = deviceName.trim();
        if (!trimmedName || trimmedName.length < 2) {
            setError("Device name must be at least 2 characters");
            return;
        }

        setSaving(true);

        try {
            const body = {
                device_name: trimmedName,
                install_location: installLocation.trim() || null,
            };

            await updateDeviceApi(token, device.id, body);
            setSuccessMsg("Device updated successfully");
            setTimeout(() => navigation.goBack(), 1200);
        } catch (err) {
            setError(err.message || "Failed to update device");
        } finally {
            setSaving(false);
        }
    }

    return (
        <ScrollView style={styles.page} contentContainerStyle={styles.content}>
            <Text style={styles.title}>Edit Device</Text>
            <Text style={styles.subtitle}>Update the name or installation location of your device.</Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {successMsg ? <Text style={styles.success}>{successMsg}</Text> : null}

            <View style={styles.card}>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Device Code</Text>
                    <Text style={styles.infoValue}>{device.device_code}</Text>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Device Name</Text>
                    <TextInput
                        style={styles.input}
                        value={deviceName}
                        onChangeText={setDeviceName}
                        placeholder="e.g. Kitchen Faucet"
                        placeholderTextColor="#9db0c4"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Install Location</Text>
                    <TextInput
                        style={styles.input}
                        value={installLocation}
                        onChangeText={setInstallLocation}
                        placeholder="e.g. Building A, 2nd Floor"
                        placeholderTextColor="#9db0c4"
                    />
                </View>

                <Pressable
                    style={({ pressed }) => [
                        styles.button,
                        pressed && styles.buttonPressed,
                        saving && styles.buttonDisabled,
                    ]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save Changes</Text>}
                </Pressable>
            </View>
        </ScrollView>
    );
}
