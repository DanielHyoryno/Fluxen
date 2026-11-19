import { Pressable, StyleSheet, Text } from "react-native";
import { t } from "../services/i18n";
import { colors } from "../theme/tokens";

export default function OtpResendButton({ cooldown, onResend, busy, buttonStyle, textStyle, spacingStyle, labelKey }) {
    const waiting = cooldown.seconds > 0;
    const disabled = busy || waiting;
    return (
        <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled}
            onPress={() => cooldown.resend(onResend)}
            style={({ pressed }) => [buttonStyle, spacingStyle, styles.outline,
                pressed && !disabled && styles.pressed, disabled && styles.disabled]}>
            <Text style={[textStyle, styles.label, disabled && styles.disabledLabel]}>
                {waiting ? t(labelKey ? "firebaseResendLinkCountdown" : "reportEmailResendCountdown", { seconds: cooldown.seconds })
                    : t(labelKey || "reportEmailResend")}
            </Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    outline: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary },
    pressed: { backgroundColor: colors.primarySoft },
    disabled: { backgroundColor: colors.offlineSoft, borderColor: colors.border },
    label: { color: colors.primary, textAlign: "center" },
    disabledLabel: { color: colors.offline },
});
