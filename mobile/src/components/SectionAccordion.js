import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, UIManager, View } from "react-native";

export default function SectionAccordion({ title, defaultExpanded = false, children }) {
    const [expanded, setExpanded] = useState(defaultExpanded);
    const spin = useRef(new Animated.Value(defaultExpanded ? 1 : 0)).current;
    const bodyProgress = useRef(new Animated.Value(defaultExpanded ? 1 : 0)).current;

    useEffect(() => {
        if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
            UIManager.setLayoutAnimationEnabledExperimental(true);
        }
    }, []);

    function toggle() {
        const next = !expanded;
        setExpanded(next);
        Animated.parallel([
            Animated.timing(spin, {
                toValue: next ? 1 : 0,
                duration: 220,
                easing: Easing.linear,
                useNativeDriver: true,
            }),
            Animated.timing(bodyProgress, {
                toValue: next ? 1 : 0,
                duration: 220,
                easing: Easing.linear,
                useNativeDriver: false,
            }),
        ]).start();
    }

    const rotate = spin.interpolate({
        inputRange: [0, 1],
        outputRange: ["0deg", "90deg"],
    });
    const bodyMaxHeight = bodyProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1200],
    });
    const bodyOpacity = bodyProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
    });
    const bodyTranslateY = bodyProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [-8, 0],
    });

    return (
        <View style={styles.wrap}>
            <Pressable style={({ pressed }) => [styles.header, pressed && styles.headerPressed]} onPress={toggle}>
                <Text style={styles.title}>{title}</Text>
                <Animated.Text style={[styles.chevron, { transform: [{ rotate }] }]}>›</Animated.Text>
            </Pressable>
            <Animated.View
                pointerEvents={expanded ? "auto" : "none"}
                style={[
                    styles.bodyAnimated,
                    {
                        maxHeight: bodyMaxHeight,
                        opacity: bodyOpacity,
                        transform: [{ translateY: bodyTranslateY }],
                    },
                ]}
            >
                <View style={styles.body}>{children}</View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        backgroundColor: "#fff",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#dbe6f5",
        marginBottom: 14,
        overflow: "hidden",
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: "#f7faff",
    },
    headerPressed: {
        opacity: 0.88,
    },
    title: {
        color: "#1d3551",
        fontWeight: "700",
        fontSize: 14,
    },
    chevron: {
        color: "#35506d",
        fontWeight: "700",
        fontSize: 16,
        lineHeight: 16,
    },
    body: {
        padding: 10,
        backgroundColor: "#fff",
    },
    bodyAnimated: {
        overflow: "hidden",
    },
});
