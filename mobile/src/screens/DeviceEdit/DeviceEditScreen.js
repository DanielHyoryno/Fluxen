import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { listCategoriesApi, updateDeviceApi } from "../../services/api";
import styles from "./styles";

export default function DeviceEditScreen({ route, navigation }) {
    const { device } = route.params;
    const { token } = useAuth();

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");
    const [categories, setCategories] = useState([]);
    const [categoriesLoading, setCategoriesLoading] = useState(true);

    const [deviceName, setDeviceName] = useState(device.device_name || "");
    const [installLocation, setInstallLocation] = useState(device.install_location || "");
    const [selectedCategoryId, setSelectedCategoryId] = useState(device.category_id ?? null);

    useEffect(() => {
        let mounted = true;

        async function loadCategories() {
            try {
                const data = await listCategoriesApi(token);
                if (mounted) setCategories(Array.isArray(data) ? data : data?.items || []);
            } catch (err) {
                if (mounted) setError(err.message || "Failed to load categories");
            } finally {
                if (mounted) setCategoriesLoading(false);
            }
        }

        loadCategories();
        return () => {
            mounted = false;
        };
    }, [token]);

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
                category_id: selectedCategoryId,
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

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Category</Text>
                    {categoriesLoading ? (
                        <ActivityIndicator color="#0f62fe" size="small" />
                    ) : (
                        <View style={styles.categoryOptions}>
                            <Pressable
                                style={[
                                    styles.categoryChip,
                                    selectedCategoryId === null && styles.categoryChipActive,
                                ]}
                                onPress={() => setSelectedCategoryId(null)}
                            >
                                <Text
                                    style={[
                                        styles.categoryChipText,
                                        selectedCategoryId === null && styles.categoryChipTextActive,
                                    ]}
                                >
                                    Uncategorized
                                </Text>
                            </Pressable>
                            {categories.map((category) => {
                                const selected = String(selectedCategoryId) === String(category.id);
                                return (
                                    <Pressable
                                        key={String(category.id)}
                                        style={[styles.categoryChip, selected && styles.categoryChipActive]}
                                        onPress={() => setSelectedCategoryId(category.id)}
                                    >
                                        <Text
                                            style={[
                                                styles.categoryChipText,
                                                selected && styles.categoryChipTextActive,
                                            ]}
                                        >
                                            {category.name}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    )}
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
