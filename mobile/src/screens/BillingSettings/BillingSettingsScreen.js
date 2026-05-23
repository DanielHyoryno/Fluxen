import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { billingSettingsApi, upsertBillingSettingsApi } from "../../services/api";
import styles from "./styles";

export default function BillingSettingsScreen() {
  const { token, messages } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pricePerLiter, setPricePerLiter] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const settings = await billingSettingsApi(token).catch(() => null);
        if (mounted && settings?.price_per_liter !== null && settings?.price_per_liter !== undefined) {
          setPricePerLiter(String(settings.price_per_liter));
        }
      } catch (err) {
        if (mounted) setError(err.message || messages.billingSettings.loadFailed);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [token]);

  async function handleSave() {
    setError("");
    setSuccessMsg("");
    setSaving(true);

    try {
      const saved = await upsertBillingSettingsApi(token, {
        price_per_liter: Number(pricePerLiter),
        currency: "IDR",
      });
      setPricePerLiter(String(saved.price_per_liter));
      setSuccessMsg(messages.billingSettings.saveSuccess);
    } catch (err) {
      setError(err.message || messages.billingSettings.saveFailed);
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
      <Text style={styles.title}>{messages.billingSettings.pageTitle}</Text>
      <Text style={styles.subtitle}>{messages.billingSettings.subtitle}</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {successMsg ? <Text style={styles.success}>{successMsg}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{messages.billingSettings.waterPrice}</Text>
        <Text style={styles.label}>{messages.billingSettings.pricePerLiter}</Text>
        <TextInput
          style={styles.input}
          value={pricePerLiter}
          onChangeText={setPricePerLiter}
          placeholder={messages.billingSettings.placeholder}
          keyboardType="numeric"
          placeholderTextColor="#9db0c4"
        />
        <Text style={styles.helperText}>{messages.billingSettings.helper}</Text>

        <Pressable style={[styles.button, saving && styles.buttonDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{messages.billingSettings.save}</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}
