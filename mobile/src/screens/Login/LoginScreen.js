import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Image, Pressable, Text, TextInput, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import styles from "./styles";

const fluxenLogo = require("../../../AppLogo/FluxenLogo.png");

export default function LoginScreen({ navigation, route }) {
    const { login, messages } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const entryOpacity = useRef(new Animated.Value(0)).current;
    const entryTranslateY = useRef(new Animated.Value(16)).current;
    const buttonScale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(entryOpacity, {
                toValue: 1,
                duration: 380,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(entryTranslateY, {
                toValue: 0,
                duration: 420,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
        ]).start();
    }, [entryOpacity, entryTranslateY]);

    function animateButton(toValue) {
        Animated.spring(buttonScale, {
            toValue,
            friction: 8,
            tension: 180,
            useNativeDriver: true,
        }).start();
    }

    async function handleLogin() {
        setError("");
        setSubmitting(true);
        try {
            await login(email.trim(), password);
        } catch (err) {
            setError(err.message || messages.auth.loginFailed);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <View style={styles.page}>
            <Animated.View style={[styles.bgBlobA, { opacity: entryOpacity }]} />
            <Animated.View style={[styles.bgBlobB, { opacity: entryOpacity }]} />
            <Animated.View
                style={{
                    opacity: entryOpacity,
                    transform: [{ translateY: entryTranslateY }],
                }}
            >
                <View style={styles.heroWrap}>
                    <Image source={fluxenLogo} style={styles.logo} resizeMode="contain" />
                    <Text style={styles.brandTitle}>Fluxen</Text>
                    <Text style={styles.subtitle}>{messages.auth.loginSubtitle}</Text>
                </View>

                <View style={styles.formCard}>
                    <TextInput
                        style={styles.input}
                        placeholder={messages.auth.emailPlaceholder}
                        placeholderTextColor="#8aa0b8"
                        autoCapitalize="none"
                        keyboardType="email-address"
                        value={email}
                        onChangeText={setEmail}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder={messages.auth.passwordPlaceholder}
                        placeholderTextColor="#8aa0b8"
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                    />

                    {error ? <Text style={styles.error}>{error}</Text> : null}
                    {route?.params?.registrationSuccess ? (
                        <Text style={styles.success}>{route.params.registrationSuccess}</Text>
                    ) : null}

                    <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                        <Pressable
                            style={styles.primaryButton}
                            onPress={handleLogin}
                            disabled={submitting}
                            onPressIn={() => animateButton(0.98)}
                            onPressOut={() => animateButton(1)}
                        >
                            {submitting ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.primaryButtonText}>{messages.auth.loginButton}</Text>
                            )}
                        </Pressable>
                    </Animated.View>

                    <Pressable onPress={() => navigation.navigate("Register")}>
                        <Text style={styles.link}>{messages.auth.noAccount}</Text>
                    </Pressable>
                </View>
            </Animated.View>
        </View>
    );
}
