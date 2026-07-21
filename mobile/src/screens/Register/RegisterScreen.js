import { useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, TextInput, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
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

    async function handleRegister() {
        setError("");
        if (!validateFields()) return;

        setSubmitting(true);
        try {
            await register(fullName.trim(), email.trim(), password);
            navigation.reset({
                index: 0,
                routes: [{ name: "Login", params: { registrationSuccess: messages.auth.registerSuccess } }],
            });
        } catch (err) {
            const message = String(err.message || "");
            if (message.toLowerCase().includes("email already used")) {
                setFieldErrors((current) => ({ ...current, email: messages.auth.emailAlreadyUsed }));
            } else {
                setError(message || messages.auth.registerFailed);
            }
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <View style={styles.page}>
            <View style={styles.bgBlobA} />
            <View style={styles.bgBlobB} />
            <View style={styles.heroWrap}>
                <Image source={fluxenLogo} style={styles.logo} resizeMode="contain" />
                <Text style={styles.brandTitle}>Fluxen</Text>
                <Text style={styles.subtitle}>{messages.auth.registerTitle}</Text>
            </View>

            <View style={styles.formCard}>
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

                <Pressable style={styles.primaryButton} onPress={handleRegister} disabled={submitting}>
                    {submitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.primaryButtonText}>{messages.auth.registerButton}</Text>
                    )}
                </Pressable>

                <Pressable onPress={() => navigation.goBack()}>
                    <Text style={styles.link}>{messages.auth.backToLogin}</Text>
                </Pressable>
            </View>
        </View>
    );
}
