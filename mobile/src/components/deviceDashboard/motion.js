import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";

export function StaggerCard({ index = 0, style, children }) {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(12)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1,
                duration: 280,
                delay: Math.min(index * 70, 420),
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: 0,
                duration: 340,
                delay: Math.min(index * 70, 420),
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
        ]).start();
    }, [index, opacity, translateY]);

    return (
        <Animated.View
            style={[
                style,
                {
                    opacity,
                    transform: [{ translateY }],
                },
            ]}
        >
            {children}
        </Animated.View>
    );
}

export function StaggerRow({ index = 0, children }) {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateX = useRef(new Animated.Value(-8)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1,
                duration: 220,
                delay: Math.min(index * 40, 320),
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(translateX, {
                toValue: 0,
                duration: 260,
                delay: Math.min(index * 40, 320),
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
        ]).start();
    }, [index, opacity, translateX]);

    return <Animated.View style={{ opacity, transform: [{ translateX }] }}>{children}</Animated.View>;
}
