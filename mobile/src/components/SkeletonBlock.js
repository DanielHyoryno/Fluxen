import { useEffect, useRef } from "react";
import { Animated, StyleSheet } from "react-native";

export default function SkeletonBlock({ width = "100%", height = 16, style }) {
    const pulse = useRef(new Animated.Value(0.45)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 0.9, duration: 800, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 0.45, duration: 800, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [pulse]);

    return <Animated.View style={[styles.block, { width, height, opacity: pulse }, style]} />;
}

const styles = StyleSheet.create({
    block: {
        backgroundColor: "#dfe8f5",
        borderRadius: 10,
    },
});
