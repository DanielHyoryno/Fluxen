import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { upsertUsageLimitsApi, usageLimitsApi } from "../../services/api";
import styles from "./styles";

export default function UsageLimitsScreen({ route, navigation }) {
    const { device } = route.params;
    const { token } = useAuth();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

    const [dailyLimit, setDailyLimit] = useState("");
    const [monthlyLimit, setMonthlyLimit] = useState("");

    useEffect(() => {
        let mounted = true;
        async function load() {
            try {
                const data = await usageLimitsApi(token, device.device_code);
                if (mounted && data) {
                    setDailyLimit(data.daily_usage_limit_l ? String(data.daily_usage_limit_l) : "");
                    setMonthlyLimit(data.monthly_usage_limit_l ? String(data.monthly_usage_limit_l) : "");
                }
            } catch (err) {
                if (mounted) setError(err.message || "Failed to load limits");
            } finally {
                if (mounted) setLoading(false);
            }
        }
        load();
        return () => {
            mounted = false;
        };
    }, [token, device.device_code]);

    async function handleSave() {
        setError("");
        setSuccessMsg("");
        setSaving(true);

        try {
            const body = {
                device_code: device.device_code,
                daily_usage_limit_l: dailyLimit ? Number(dailyLimit) : null,
                monthly_usage_limit_l: monthlyLimit ? Number(monthlyLimit) : null,
            };

            await upsertUsageLimitsApi(token, body);
            setSuccessMsg("Limits updated successfully");
            setTimeout(() => navigation.goBack(), 1500);
        } catch (err) {
            setError(err.message || "Failed to save limits");
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <View style={styles.loadingPage}>
                <ActivityIndicator size="large" color="#0f62fe" />
            </View>
        );
    }

    return (
        <ScrollView style={styles.page} contentContainerStyle={styles.content}>
            <Text style={styles.title}>Set Usage Limits</Text>
            <Text style={styles.subtitle}>Configure automatic alerts when water usage exceeds these thresholds.</Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {successMsg ? <Text style={styles.success}>{successMsg}</Text> : null}

            <View style={styles.card}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Daily Limit (Liters)</Text>
                    <TextInput
                        style={styles.input}
                        value={dailyLimit}
                        onChangeText={setDailyLimit}
                        placeholder="e.g. 500"
                        keyboardType="numeric"
                        placeholderTextColor="#9db0c4"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Monthly Limit (Liters)</Text>
                    <TextInput
                        style={styles.input}
                        value={monthlyLimit}
                        onChangeText={setMonthlyLimit}
                        placeholder="e.g. 15000"
                        keyboardType="numeric"
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
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save Limits</Text>}
                </Pressable>
            </View>
        </ScrollView>
    );
}
