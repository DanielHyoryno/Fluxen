import { useEffect, useRef } from "react";
import { Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/tokens";
import useReducedMotion from "../hooks/useReducedMotion";

export default function TabIcon({ name, focused }) {
    const scale = useRef(new Animated.Value(1)).current;
    const reducedMotion = useReducedMotion();
    useEffect(() => {
        const animation = Animated.spring(scale, {
            toValue: focused && !reducedMotion ? 1.08 : 1,
            speed: 24, bounciness: 3, useNativeDriver: true,
        });
        animation.start();
        return () => animation.stop();
    }, [focused, reducedMotion, scale]);
    return (
        <Animated.View style={{ width: 44, height: 40, alignItems: "center", justifyContent: "center",
            borderRadius: 12, backgroundColor: focused ? colors.primarySoft : "transparent", transform: [{ scale }] }}>
            <Ionicons name={name} size={22} color={focused ? colors.primary : colors.textMuted} />
        </Animated.View>
    );
}
