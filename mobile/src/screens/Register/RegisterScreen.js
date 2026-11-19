import { useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, TextInput, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { confirmFirebaseRegistrationApi, verifyRegistrationApi } from "../../services/api";
import { t } from "../../services/i18n";
import OtpResendButton from "../../components/OtpResendButton";
import useOtpResendCooldown from "../../hooks/useOtpResendCooldown";
import styles from "./styles";

const fluxenLogo = require("../../../AppLogo/FluxenLogo.png");
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen({ navigation }) {
    const { register, messages } = useAuth();
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});
    const [verificationEmail, setVerificationEmail] = useState("");
    const [verificationMethod, setVerificationMethod] = useState("code");
    const [code, setCode] = useState("");
    const cooldown = useOtpResendCooldown();

    function finishRegistration() {
        setPassword("");
        navigation.reset({ index: 0, routes: [{ name: "Login", params: { registrationSuccess: messages.auth.registerSuccess } }] });
    }

    function validateFields() {
        const nextErrors = {};
        const trimmedName = fullName.trim();
        const trimmedEmail = email.trim();

        if (!trimmedName) {
            nextErrors.fullName = messages.auth.fullNameRequired;
        } else if (trimmedName.length < 2) {
            nextErrors.fullName = messages.auth.fullNameMinLength;
        } else if (trimmedName.length > 120) {
            nextErrors.fullName = messages.auth.fullNameMaxLength;
        }

        if (!trimmedEmail) {
            nextErrors.email = messages.auth.emailRequired;
        } else if (trimmedEmail.length > 150) {
            nextErrors.email = messages.auth.emailMaxLength;
        } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
            nextErrors.email = messages.auth.emailInvalid;
        }

        if (!password) {
            nextErrors.password = messages.auth.passwordRequired;
        } else if (password.length < 8) {
            nextErrors.password = messages.auth.passwordMinLength;
        } else if (password.length > 100) {
            nextErrors.password = messages.auth.passwordMaxLength;
        }

        setFieldErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    }

    function updateField(field, setter, value) {
        setter(value);
        if (fieldErrors[field]) {
            setFieldErrors((current) => ({ ...current, [field]: undefined }));
        }
    }

    async function handleRegister(isResend = false) {
        setError("");
        if (!validateFields()) return;

        setSubmitting(true);
        try {
            const result = await register(fullName.trim(), email.trim(), password);
            if (result?.verification_required) {
                if (!isResend) cooldown.startCooldown();
                setCode("");
                setVerificationEmail(result.email);
                setVerificationMethod(result.verification_method || "code");
            } else finishRegistration();
        } catch (err) {
            const message = String(err.message || "");
            if (err.code === "EMAIL_ALREADY_USED" || message.toLowerCase().includes("email already used")) {
                setVerificationEmail("");
                setFieldErrors((current) => ({ ...current, email: messages.auth.emailAlreadyUsed }));
            } else {
                setError(message || messages.auth.registerFailed);
            }
        } finally {
            setSubmitting(false);
        }
    }

    async function confirmRegistration() {
        if (submitting || (verificationMethod !== "link" && code.length !== 6)) return;
        setSubmitting(true);
        setError("");
        try {
            const data = { full_name: fullName.trim(), email: verificationEmail, password };
            if (verificationMethod === "link") await confirmFirebaseRegistrationApi(data);
            else await verifyRegistrationApi({ ...data, code });
            finishRegistration();
        } catch (err) {
            setError(err.message || messages.auth.registerFailed);
        } finally { setSubmitting(false); }
    }

    const usesLink = verificationMethod === "link";
    const cannotVerify = submitting || (!usesLink && code.length !== 6);
    return (
        <View style={styles.page}>
            <View style={styles.bgBlobA} />
            <View style={styles.bgBlobB} />
            <View style={styles.heroWrap}>
                <Image source={fluxenLogo} style={styles.logo} resizeMode="contain" />
                <Text style={styles.brandTitle}>Fluxen</Text>
                <Text style={styles.subtitle}>{verificationEmail ? t("reportEmailVerifyTitle") : messages.auth.registerTitle}</Text>
            </View>

            <View style={styles.formCard}>
                {verificationEmail ? <>
                    <Text style={styles.help}>{t(usesLink ? "firebaseVerifyLinkHint" : "reportEmailCodeHint", { email: verificationEmail })}</Text>
                    {!usesLink ? <TextInput style={styles.input} placeholder="000000" accessibilityLabel={t("reportEmailCodeLabel")}
                        value={code} onChangeText={value => setCode(value.replace(/\D/g, ""))} keyboardType="number-pad"
                        autoComplete="one-time-code" maxLength={6} editable={!submitting} /> : null}
                    {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
                    <Pressable accessibilityRole="button" style={[styles.primaryButton, cannotVerify && styles.disabled]}
                        disabled={cannotVerify} onPress={confirmRegistration}>
                        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{t(usesLink ? "firebaseVerifyDone" : "reportEmailConfirm")}</Text>}
                    </Pressable>
                    <OtpResendButton cooldown={cooldown} busy={submitting} onResend={() => handleRegister(true)}
                        labelKey={usesLink ? "firebaseResendLink" : undefined}
                        buttonStyle={styles.primaryButton} textStyle={styles.primaryButtonText} spacingStyle={styles.resendSpacing} />
                    <Pressable accessibilityRole="button" disabled={submitting} onPress={() => { setVerificationEmail(""); setError(""); }}>
                        <Text style={styles.link}>{t("accountBackToForm")}</Text>
                    </Pressable>
                </> : <>
                <TextInput
                    style={[styles.input, fieldErrors.fullName && styles.inputError]}
                    placeholder={messages.auth.fullNamePlaceholder}
                    placeholderTextColor="#8aa0b8"
                    value={fullName}
                    onChangeText={(value) => updateField("fullName", setFullName, value)}
                />
                {fieldErrors.fullName ? <Text style={styles.fieldError}>{fieldErrors.fullName}</Text> : null}
                <TextInput
                    style={[styles.input, fieldErrors.email && styles.inputError]}
                    placeholder={messages.auth.emailPlaceholder}
                    placeholderTextColor="#8aa0b8"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={email}
                    onChangeText={(value) => updateField("email", setEmail, value)}
                />
                {fieldErrors.email ? <Text style={styles.fieldError}>{fieldErrors.email}</Text> : null}
                <TextInput
                    style={[styles.input, fieldErrors.password && styles.inputError]}
                    placeholder={messages.auth.passwordMinPlaceholder}
                    placeholderTextColor="#8aa0b8"
                    secureTextEntry
                    value={password}
                    onChangeText={(value) => updateField("password", setPassword, value)}
                />
                {fieldErrors.password ? <Text style={styles.fieldError}>{fieldErrors.password}</Text> : null}

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <Pressable style={styles.primaryButton} onPress={() => handleRegister()} disabled={submitting}>
                    {submitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.primaryButtonText}>{messages.auth.registerButton}</Text>
                    )}
                </Pressable>

                <Pressable onPress={() => navigation.goBack()}>
                    <Text style={styles.link}>{messages.auth.backToLogin}</Text>
                </Pressable>
                </>}
            </View>
        </View>
    );
}
