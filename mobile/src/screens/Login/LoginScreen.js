import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Pressable, Text, TextInput, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import styles from "./styles";

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
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
      setError(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.page}>
      <Animated.View
        style={{
          opacity: entryOpacity,
          transform: [{ translateY: entryTranslateY }],
        }}
      >
        <Text style={styles.title}>Water Monitor</Text>
        <Text style={styles.subtitle}>Login to view your device telemetry</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#8aa0b8"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#8aa0b8"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
          <Pressable
            style={styles.primaryButton}
            onPress={handleLogin}
            disabled={submitting}
            onPressIn={() => animateButton(0.98)}
            onPressOut={() => animateButton(1)}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Login</Text>}
          </Pressable>
        </Animated.View>

        <Pressable onPress={() => navigation.navigate("Register")}>
          <Text style={styles.link}>No account yet? Register</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
