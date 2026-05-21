import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import messages from "../../constants/messages";
import styles from "./styles";

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleRegister() {
    setError("");
    setSubmitting(true);
    try {
      await register(fullName.trim(), email.trim(), password);
    } catch (err) {
      setError(err.message || messages.auth.registerFailed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.page}>
      <Text style={styles.title}>{messages.auth.registerTitle}</Text>

      <TextInput
        style={styles.input}
        placeholder={messages.auth.fullNamePlaceholder}
        placeholderTextColor="#8aa0b8"
        value={fullName}
        onChangeText={setFullName}
      />
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
        placeholder={messages.auth.passwordPlaceholder + " (min 8 chars)"}
        placeholderTextColor="#8aa0b8"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

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
  );
}
