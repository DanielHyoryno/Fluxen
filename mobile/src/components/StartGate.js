import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t, useLocale } from "../services/i18n";
import { colors } from "../theme/tokens";
import FluxenAnimatedLogo from "./FluxenAnimatedLogo";
import useReducedMotion from "../hooks/useReducedMotion";
import { LOGO_DOCK_MS, LOGO_REVEAL_MS } from "../common/fluxenLogoMotion";

export default function StartGate({ onStart }) {
    useLocale();
    const window = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const [layout, setLayout] = useState(null);
    const reduceMotion = useReducedMotion();
    const dock = useRef(new Animated.Value(0)).current;
    const reveal = useRef(new Animated.Value(0)).current;
    const transition = useRef(null);
    const docking = useRef(false);
    const entered = useRef(false);
    const width = layout?.width || window.width;
    const height = layout?.height || window.height;
    const largeHeight = Math.min(280, Math.max(180, height * 0.31), width * 0.72);
    const smallHeight = Math.min(112, Math.max(82, width * 0.27));
    const titleTop = Math.max(insets.top + smallHeight + 40, Math.min(height * 0.5, height - insets.bottom - 150));
    const initialCenter = height / 2;
    const finalCenter = titleTop - 24 - smallHeight / 2;

    useEffect(() => {
        return () => {
            transition.current?.stop();
        };
    }, []);

    useEffect(() => {
        if (reduceMotion) {
            transition.current?.stop();
            dock.setValue(1);
            reveal.setValue(1);
        }
    }, [dock, reduceMotion, reveal]);

    const finishIntro = useCallback(() => {
        if (docking.current || entered.current) return;
        docking.current = true;
        if (reduceMotion) {
            dock.setValue(1);
            reveal.setValue(1);
            return;
        }
        transition.current = Animated.sequence([
            Animated.timing(dock, {
                toValue: 1,
                duration: LOGO_DOCK_MS,
                easing: Easing.inOut(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(reveal, {
                toValue: 1,
                duration: LOGO_REVEAL_MS,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
        ]);
        transition.current.start();
    }, [dock, reduceMotion, reveal]);

    const start = useCallback(() => {
        if (entered.current) return;
        entered.current = true;
        transition.current?.stop();
        onStart();
    }, [onStart]);

    return (
        <Pressable
            style={styles.page}
            onPress={start}
            onLayout={event => setLayout(event.nativeEvent.layout)}
            accessibilityRole="button"
            accessibilityLabel={t("Tap anywhere to start")}
            testID="start-gate"
        >
            <Animated.View pointerEvents="none" accessible={false} style={[StyleSheet.absoluteFillObject, { opacity: reveal }]}>
                <View style={styles.blobA} />
                <View style={styles.blobB} />
                <View style={styles.blobC} />
            </Animated.View>
            <Animated.View
                pointerEvents="none"
                style={[styles.logoPosition, {
                    top: initialCenter - largeHeight / 2,
                    height: largeHeight,
                    transform: [{ translateY: dock.interpolate({ inputRange: [0, 1], outputRange: [0, finalCenter - initialCenter] }) }],
                }]}
                testID="start-gate-logo-position"
            >
                <Animated.View style={{ transform: [{ scale: dock.interpolate({ inputRange: [0, 1], outputRange: [1, smallHeight / largeHeight] }) }] }}>
                    <FluxenAnimatedLogo height={largeHeight} reduceMotion={reduceMotion} onIntroComplete={finishIntro} />
                </Animated.View>
            </Animated.View>
            <Animated.View
                pointerEvents="none"
                accessible={false}
                style={[styles.copy, {
                    top: titleTop,
                    opacity: reveal,
                    transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
                }]}
                testID="start-gate-copy"
            >
                <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.3}>{t("Water Monitor")}</Text>
                <Text style={styles.subtitle} maxFontSizeMultiplier={1.3}>{t("IoT Telemetry Dashboard")}</Text>
            </Animated.View>
            <Animated.View pointerEvents="none" style={[styles.hint, { bottom: Math.max(34, insets.bottom + 14), opacity: reveal }]}>
                <Text style={styles.hintText}>{t("Tap anywhere to start")}</Text>
            </Animated.View>
            <StatusBar style="dark" />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.background, overflow: "hidden" },
    logoPosition: { position: "absolute", left: 0, right: 0, alignItems: "center", justifyContent: "center" },
    copy: { position: "absolute", left: 24, right: 24, alignItems: "center" },
    title: { color: colors.text, fontSize: 36, fontWeight: "800", letterSpacing: 0.2, textAlign: "center" },
    subtitle: { color: colors.textMuted, fontSize: 15, marginTop: 10, textAlign: "center" },
    hint: { position: "absolute", left: 24, right: 24, alignItems: "center" },
    hintText: { color: "#35506d", fontSize: 13, fontWeight: "700" },
    blobA: { position: "absolute", width: 240, height: 240, borderRadius: 140, backgroundColor: "rgba(66, 133, 244, 0.16)", top: -70, left: -70 },
    blobB: { position: "absolute", width: 270, height: 270, borderRadius: 150, backgroundColor: "rgba(15, 98, 254, 0.11)", bottom: -90, right: -60 },
    blobC: { position: "absolute", width: 140, height: 140, borderRadius: 80, backgroundColor: "rgba(41, 121, 255, 0.12)", top: 120, right: 40 },
});
