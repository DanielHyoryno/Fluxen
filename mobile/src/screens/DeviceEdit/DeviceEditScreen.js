import CategoryDropdown from "../../components/CategoryDropdown";
import FailureNotice from "../../components/FailureNotice";
import { t, useLocale } from "../../services/i18n";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { listCategoriesApi, updateDeviceApi } from "../../services/api";
import styles from "./styles";

export default function DeviceEditScreen({ route, navigation }) {
    useLocale();
    const { device } = route.params;
    const { token } = useAuth();

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [loadError, setLoadError] = useState("");
    const [loadAttempt, setLoadAttempt] = useState(0);
    const [successMsg, setSuccessMsg] = useState("");
    const [categories, setCategories] = useState([]);
    const [categoriesLoading, setCategoriesLoading] = useState(true);

    const [deviceName, setDeviceName] = useState(device.device_name || "");
    const [installLocation, setInstallLocation] = useState(device.install_location || "");
    const [selectedCategoryId, setSelectedCategoryId] = useState(device.category_id ?? null);

    useEffect(() => {
        let mounted = true;
        setLoadError("");
        setCategoriesLoading(true);

        async function loadCategories() {
            try {
                const data = await listCategoriesApi(token);
                if (mounted) setCategories(Array.isArray(data) ? data : data?.items || []);
            } catch (err) {
                if (mounted) setLoadError(err.message || t("Failed to load categories"));
            } finally {
                if (mounted) setCategoriesLoading(false);
            }
        }

        loadCategories();
        return () => {
            mounted = false;
        };
    }, [token, loadAttempt]);

    async function handleSave() {
        setError("");
        setSuccessMsg("");

        const trimmedName = deviceName.trim();
        if (!trimmedName || trimmedName.length < 2) {
            setError(t("Device name must be at least 2 characters"));
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
            setSuccessMsg(t("Device updated successfully"));
            setTimeout(() => navigation.goBack(), 1200);
        } catch (err) {
            setError(err.message || t("Failed to update device"));
        } finally {
            setSaving(false);
        }
    }

    return (
        <ScrollView style={styles.page} contentContainerStyle={styles.content}>
            <Text style={styles.title}>{t("Edit Device")}</Text>
            <Text style={styles.subtitle}>{t("Update the name or installation location of your device.")}</Text>

            <FailureNotice error={loadError} onRetry={() => setLoadAttempt((n) => n + 1)} />
            <FailureNotice error={error} popup={false} />
            {successMsg ? <Text style={styles.success}>{successMsg}</Text> : null}

            <View style={styles.card}>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{t("Device Code")}</Text>
                    <Text style={styles.infoValue}>{device.device_code}</Text>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>{t("Device Name")}</Text>
                    <TextInput
                        style={styles.input}
                        value={deviceName}
                        onChangeText={setDeviceName}
                        placeholder={t("e.g. Kitchen Faucet")}
                        placeholderTextColor="#9db0c4"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>{t("Install Location")}</Text>
                    <TextInput
                        style={styles.input}
                        value={installLocation}
                        onChangeText={setInstallLocation}
                        placeholder={t("e.g. Building A, 2nd Floor")}
                        placeholderTextColor="#9db0c4"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>{t("Category")}</Text>
                    {categoriesLoading ? (
                        <ActivityIndicator color="#0f62fe" size="small" />
                    ) : (
                        <CategoryDropdown categories={categories} value={selectedCategoryId}
                            onChange={setSelectedCategoryId} emptyLabel={t("Uncategorized")} label={t("Category")} />
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
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t("Save Changes")}</Text>}
                </Pressable>
            </View>
        </ScrollView>
    );
}
