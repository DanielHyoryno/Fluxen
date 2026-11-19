import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { t, useLocale } from "../services/i18n";
import { reportEmailStatusApi, requestReportEmailCodeApi, sendReportEmailApi, verifyReportEmailCodeApi } from "../services/api";
import { colors } from "../theme/tokens";
import useOtpResendCooldown from "../hooks/useOtpResendCooldown";
import OtpResendButton from "./OtpResendButton";

const errors = {
    REPORT_EMAIL_UNAVAILABLE: "reportEmailUnavailable",
    REPORT_EMAIL_CODE_COOLDOWN: "reportEmailCooldown",
    REPORT_EMAIL_CODE_INVALID: "reportEmailBadCode",
    REPORT_EMAIL_NOT_VERIFIED: "reportEmailNeedsVerification",
    REPORT_EMAIL_SEND_FAILED: "reportEmailSendFailed",
};

export default function ReportEmailAction({ token, deviceCode, range, verifyOnly = false, onOpenProfile }) {
    const locale = useLocale();
    const inFlight = useRef(false);
    const [busy, setBusy] = useState(false);
    const [verificationEmail, setVerificationEmail] = useState("");
    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [feedback, setFeedback] = useState(null);
    const [needsProfile, setNeedsProfile] = useState(false);
    const cooldown = useOtpResendCooldown();

    async function run(action) {
        if (inFlight.current || !token) return;
        inFlight.current = true;
        setBusy(true);
        setError("");
        setFeedback(null);
        setNeedsProfile(false);
        try {
            await action();
        } catch (err) {
            setError(errors[err.code] ? t(errors[err.code]) : err.message || t("reportEmailSendFailed"));
        } finally {
            inFlight.current = false;
            setBusy(false);
        }
    }

    async function requestCode(isResend = false) {
        const result = await requestReportEmailCodeApi(token, locale);
        setCode("");
        if (result.verified) {
            setVerificationEmail("");
            setFeedback({ key: "reportEmailVerified" });
        } else {
            if (!isResend) cooldown.startCooldown();
            setVerificationEmail(result.email);
            setFeedback({ key: "reportEmailCodeSent", email: result.email });
        }
    }

    function onSendPress() {
        return run(async () => {
            const status = await reportEmailStatusApi(token);
            if (!status.verified) {
                if (verifyOnly) return requestCode();
                setNeedsProfile(true);
                return;
            }
            if (verifyOnly) {
                setFeedback({ key: "accountEmailVerified" });
                return;
            }
            const result = await sendReportEmailApi(token, { device_code: deviceCode, ...range, locale });
            setFeedback({ key: "reportEmailQueued", email: result.email });
        });
    }

    function onConfirmPress() {
        return run(async () => {
            await verifyReportEmailCodeApi(token, code);
            setCode("");
            setVerificationEmail("");
            setFeedback({ key: "accountEmailVerified" });
        });
    }

    return (
        <View style={styles.section} testID="report-email-action">
            {verificationEmail ? (
                <View style={styles.verification}>
                    <Text style={styles.title}>{t("reportEmailVerifyTitle")}</Text>
                    <Text style={styles.hint}>{t("reportEmailCodeHint", { email: verificationEmail })}</Text>
                    <TextInput style={styles.input} value={code} onChangeText={(value) => setCode(value.replace(/\D/g, ""))}
                        placeholder="000000" placeholderTextColor={colors.textMuted} accessibilityLabel={t("reportEmailCodeLabel")}
                        keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} editable={!busy} />
                    <Pressable accessibilityRole="button" disabled={busy || code.length !== 6} onPress={onConfirmPress}
                        style={[styles.button, styles.primary, (busy || code.length !== 6) && styles.disabled]}>
                        <Text style={[styles.buttonText, styles.primaryText]}>{t("reportEmailConfirm")}</Text>
                    </Pressable>
                    <OtpResendButton cooldown={cooldown} busy={busy} onResend={() => run(() => requestCode(true))}
                        buttonStyle={styles.button} textStyle={styles.buttonText} />
                </View>
            ) : (
                <Pressable accessibilityRole="button" accessibilityState={{ busy, disabled: busy }} disabled={busy || !token}
                    onPress={onSendPress} style={({ pressed }) => [styles.button, pressed && styles.pressed, busy && styles.disabled]}>
                    <Text style={styles.buttonText}>{t(busy ? "reportEmailWorking" : verifyOnly ? "reportEmailVerifyTitle" : "reportEmailButton")}</Text>
                </Pressable>
            )}
            {feedback ? <Text accessibilityLiveRegion="polite" style={styles.feedback}>{t(feedback.key, { email: feedback.email })}</Text> : null}
            {needsProfile ? <>
                <Text accessibilityLiveRegion="polite" style={styles.feedback}>{t("reportEmailVerifyInProfile")}</Text>
                {onOpenProfile ? <Pressable accessibilityRole="button" onPress={onOpenProfile} style={styles.button}>
                    <Text style={styles.buttonText}>{t("reportEmailOpenProfile")}</Text>
                </Pressable> : null}
            </> : null}
            {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    section: { marginTop: 10, gap: 8 },
    verification: { padding: 12, gap: 10, backgroundColor: colors.surfaceMuted, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
    title: { fontWeight: "700", color: colors.text },
    hint: { color: colors.textMuted, lineHeight: 20 },
    input: { color: colors.text, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, minHeight: 44, paddingHorizontal: 12, fontSize: 17, letterSpacing: 3 },
    button: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, justifyContent: "center", alignItems: "center", backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
    buttonText: { color: colors.primary, fontWeight: "700", textAlign: "center" },
    primary: { backgroundColor: colors.primary, borderColor: colors.primary },
    primaryText: { color: colors.surface },
    pressed: { backgroundColor: colors.primarySoft },
    disabled: { opacity: 0.55 },
    feedback: { color: colors.textMuted, lineHeight: 19 },
    error: { color: colors.danger, lineHeight: 19 },
});
