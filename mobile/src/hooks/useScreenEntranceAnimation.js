import { useRef } from "react";
import { Animated, Easing } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

export default function useScreenEntranceAnimation(options = {}) {
    const { duration = 280, translateY = 12 } = options;
    const opacity = useRef(new Animated.Value(0)).current;
    const offsetY = useRef(new Animated.Value(translateY)).current;

    useFocusEffect(
        useRef(() => {
            opacity.setValue(0);
            offsetY.setValue(translateY);

            const animation = Animated.parallel([
                Animated.timing(opacity, {
                    toValue: 1,
                    duration,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.timing(offsetY, {
                    toValue: 0,
                    duration: duration + 60,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]);

            animation.start();

            return () => {
                animation.stop();
            };
        }).current
    );

    return {
        animatedStyle: {
            opacity,
            transform: [{ translateY: offsetY }],
        },
    };
}
