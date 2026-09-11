import { Animated, Pressable, ScrollView, Text, View } from "react-native";
import usePageInsets from "../../hooks/usePageInsets";
import { useAuth } from "../../context/AuthContext";
import useScreenEntranceAnimation from "../../hooks/useScreenEntranceAnimation";
import styles from "./styles";

export default function ProfileScreen() {
    const pageInsets = usePageInsets();
    const { user, logout, locale, messages, setLocale } = useAuth();
    const { animatedStyle } = useScreenEntranceAnimation();

    return (
        <ScrollView style={{ flex: 1, backgroundColor: "#f4f8ff" }} contentContainerStyle={[{ paddingHorizontal: 16 }, pageInsets]}>
        <Animated.View style={animatedStyle}>
            <View style={styles.header}>
                <Text style={styles.title}>{messages.profile.pageTitle}</Text>
                <Text style={styles.subtitle}>{messages.profile.subtitle}</Text>
            </View>

            <View style={styles.card}>
                <Text style={styles.label}>{messages.profile.fullName}</Text>
                <Text style={styles.value}>{user?.full_name || "-"}</Text>

                <Text style={styles.label}>{messages.profile.email}</Text>
                <Text style={styles.value}>{user?.email || "-"}</Text>
            </View>

            <View style={styles.card}>
                <Text style={styles.sectionTitle}>{messages.profile.languageTitle}</Text>
                <Text style={styles.sectionHelp}>{messages.profile.languageHelp}</Text>
                <View style={styles.languageRow}>
                    <Pressable
                        style={[styles.languageButton, locale === "en" && styles.languageButtonActive]}
                        onPress={() => setLocale("en")}
                    >
                        <Text style={[styles.languageButtonText, locale === "en" && styles.languageButtonTextActive]}>
                            {messages.profile.english}
                        </Text>
                    </Pressable>
                    <Pressable
                        style={[styles.languageButton, locale === "id" && styles.languageButtonActive]}
                        onPress={() => setLocale("id")}
                    >
                        <Text style={[styles.languageButtonText, locale === "id" && styles.languageButtonTextActive]}>
                            {messages.profile.indonesian}
                        </Text>
                    </Pressable>
                </View>
            </View>

            <Pressable style={styles.logoutButton} onPress={logout}>
                <Text style={styles.logoutText}>{messages.profile.logout}</Text>
            </Pressable>
        </Animated.View>
        </ScrollView>
    );
}
