import { useEffect, useId, useRef, useState } from "react";
import { AppState } from "react-native";
import Svg, { ClipPath, Defs, G, LinearGradient, Path, Stop } from "react-native-svg";
import {
    getLogoWaterFrame,
    LOGO_ASPECT_RATIO,
    LOGO_INTRO_MS,
    LOGO_MARK_PATH,
    LOGO_VIEWBOX,
} from "../common/fluxenLogoMotion";

export default function FluxenAnimatedLogo({
    height = 112,
    sequence = "intro",
    reduceMotion = false,
    onIntroComplete,
}) {
    const id = `fluxen-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
    const [frame, setFrame] = useState(() => getLogoWaterFrame(reduceMotion ? LOGO_INTRO_MS : 0, sequence));
    const [isActive, setIsActive] = useState(() => !["background", "inactive"].includes(AppState.currentState));
    const elapsed = useRef(0);
    const completed = useRef(false);
    const completeCallback = useRef(onIntroComplete);
    completeCallback.current = onIntroComplete;

    useEffect(() => {
        const subscription = AppState.addEventListener("change", state => setIsActive(state === "active"));
        return () => subscription.remove();
    }, []);

    useEffect(() => {
        if (reduceMotion) {
            elapsed.current = LOGO_INTRO_MS;
            setFrame(getLogoWaterFrame(LOGO_INTRO_MS, "steady"));
            if (!completed.current && sequence === "intro") {
                completed.current = true;
                completeCallback.current?.();
            }
            return undefined;
        }
        if (!isActive) return undefined;
        let request;
        let startTime;
        let lastPaint = -Infinity;
        const initialElapsed = elapsed.current;
        const tick = now => {
            if (startTime === undefined) startTime = now;
            const nextElapsed = initialElapsed + now - startTime;
            elapsed.current = nextElapsed;
            // Only the small logo redraws, at about 30 fps. Layout movement uses the native driver.
            if (now - lastPaint >= 1000 / 30) {
                setFrame(getLogoWaterFrame(nextElapsed, sequence));
                lastPaint = now;
            }
            if (!completed.current && sequence === "intro" && nextElapsed >= LOGO_INTRO_MS) {
                completed.current = true;
                completeCallback.current?.();
            }
            request = requestAnimationFrame(tick);
        };
        request = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(request);
    }, [isActive, reduceMotion, sequence]);

    return (
        <Svg
            width={height * LOGO_ASPECT_RATIO}
            height={height}
            viewBox={LOGO_VIEWBOX}
            accessible={false}
            pointerEvents="none"
            testID={`fluxen-logo-${frame.phase}`}
        >
            <Defs>
                <ClipPath id={`${id}-clip`}><Path d={LOGO_MARK_PATH} /></ClipPath>
                <LinearGradient id={`${id}-blue`} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#1479f3" />
                    <Stop offset="1" stopColor="#0d70f2" />
                </LinearGradient>
                <LinearGradient id={`${id}-water`} gradientUnits="userSpaceOnUse" x1="0" y1={frame.level} x2="0" y2="1085">
                    <Stop offset="0" stopColor="#0ccde6" />
                    <Stop offset="1" stopColor="#00b9df" />
                </LinearGradient>
            </Defs>
            <Path d={LOGO_MARK_PATH} fill={`url(#${id}-blue)`} />
            <G clipPath={`url(#${id}-clip)`}>
                <Path d={frame.back} fill="#43deed" opacity={0.5} />
                <Path d={frame.front} fill={`url(#${id}-water)`} />
                <Path d={frame.rim} fill="#82f0f8" />
            </G>
            <Path d={LOGO_MARK_PATH} fill="none" stroke="#052650" strokeWidth="22" strokeLinejoin="round" />
        </Svg>
    );
}
