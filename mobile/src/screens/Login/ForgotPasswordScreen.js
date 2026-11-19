import { useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { t, useLocale } from "../../services/i18n";
import { completePasswordResetApi, requestPasswordResetApi, verifyPasswordResetApi } from "../../services/api";
import OtpResendButton from "../../components/OtpResendButton";
import useOtpResendCooldown from "../../hooks/useOtpResendCooldown";
import styles from "../Register/styles";

const fluxenLogo = require("../../../AppLogo/FluxenLogo.png");

export default function ForgotPasswordScreen({ navigation, route }) {
    const locale = useLocale();
    const [step, setStep] = useState("email");
    const [email, setEmail] = useState(route?.params?.email || "");
    const [code, setCode] = useState("");
    const [resetToken, setResetToken] = useState("");
    const [password, setPassword] = useState("");
    const [confirmation, setConfirmation] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const pending = useRef(false);
    const cooldown = useOtpResendCooldown();

    async function run(action) {
        if (pending.current) return;
        pending.current = true;
        setBusy(true);
        setError("");
        try { await action(); }
        catch (err) {
            setError(err.message || t("requestError"));
            if (err.code === "ACCOUNT_RESET_EXPIRED") { setResetToken(""); setStep("email"); }
        } finally { pending.current = false; setBusy(false); }
    }

    function sendCode(isResend = false) {
        const address = email.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || address.length > 150) {
            setError(t("accountEmailInvalid"));
            return;
        }
        return run(async () => {
            await requestPasswordResetApi(address, locale);
            if (!isResend) cooldown.startCooldown();
            setCode("");
            setStep("code");
        });
    }

    function confirmCode() {
        return run(async () => {
            const result = await verifyPasswordResetApi(email.trim(), code);
            setResetToken(result.reset_token);
            setCode("");
            setStep("password");
        });
    }

    function submitPassword() {
        if (password.length < 8 || password.length > 100) { setError(t("accountPasswordLength")); return; }
        if (password !== confirmation) { setError(t("accountPasswordMismatch")); return; }
        return run(async () => {
            await completePasswordResetApi(resetToken, password);
            setResetToken(""); setPassword(""); setConfirmation("");
            navigation.reset({ index: 0, routes: [{ name: "Login", params: { registrationSuccess: t("accountResetSuccess") } }] });
        });
    }

    const action = step === "email" ? () => sendCode() : step === "code" ? confirmCode : submitPassword;
    const label = step === "email" ? t("accountSendCode") : step === "code" ? t("reportEmailConfirm") : t("accountSavePassword");
    const disabled = busy || (step === "code" && code.length !== 6);
    return (
        <ScrollView style={{ flex: 1, backgroundColor: "#f5f7fb" }} contentContainerStyle={[styles.page, { flex: undefined, flexGrow: 1, paddingVertical: 24 }]} keyboardShouldPersistTaps="handled">
            <View style={styles.heroWrap}>
                <Image source={fluxenLogo} style={styles.logo} resizeMode="contain" />
                <Text style={styles.brandTitle}>Fluxen</Text>
                <Text style={styles.subtitle}>{t("accountForgotPassword")}</Text>
            </View>
            <View style={styles.formCard}>
                {step === "email" ? <>
                    <Text style={styles.help}>{t("accountResetRequestHelp")}</Text>
                    <TextInput style={styles.input} accessibilityLabel={t("accountEmailLabel")} placeholder={t("accountEmailLabel")}
                        autoCapitalize="none" keyboardType="email-address" autoComplete="email" maxLength={150} editable={!busy}
                        value={email} onChangeText={setEmail} />
                </> : step === "code" ? <>
                    <Text style={styles.help}>{t("accountResetCodeHelp")}</Text>
                    <TextInput style={styles.input} accessibilityLabel={t("reportEmailCodeLabel")} placeholder="000000"
                        keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} value={code} editable={!busy}
                        onChangeText={value => setCode(value.replace(/\D/g, ""))} />
                </> : <>
                    <TextInput style={styles.input} accessibilityLabel={t("accountNewPassword")} placeholder={t("accountNewPassword")}
                        secureTextEntry autoComplete="new-password" value={password} onChangeText={setPassword} editable={!busy} />
                    <TextInput style={styles.input} accessibilityLabel={t("accountConfirmPassword")} placeholder={t("accountConfirmPassword")}
                        secureTextEntry autoComplete="new-password" value={confirmation} onChangeText={setConfirmation} editable={!busy} />
                </>}
                {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
                <Pressable accessibilityRole="button" disabled={disabled} onPress={action}
                    style={[styles.primaryButton, disabled && styles.disabled]}>
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{label}</Text>}
                </Pressable>
                {step === "code" ? <OtpResendButton cooldown={cooldown} busy={busy} onResend={() => sendCode(true)}
                    buttonStyle={styles.primaryButton} textStyle={styles.primaryButtonText} spacingStyle={styles.resendSpacing} /> : null}
                <Pressable accessibilityRole="button" disabled={busy} onPress={() => navigation.goBack()}>
                    <Text style={styles.link}>{t("accountBackToLogin")}</Text>
                </Pressable>
            </View>
        </ScrollView>
    );
}
