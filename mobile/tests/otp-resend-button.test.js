import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import OtpResendButton from "../src/components/OtpResendButton";
import useOtpResendCooldown from "../src/hooks/useOtpResendCooldown";
import { colors } from "../src/theme/tokens";

function Harness({ sendAgain }) {
    const cooldown = useOtpResendCooldown();
    return <View>
        <Pressable accessibilityRole="button" onPress={cooldown.startCooldown}><Text>First code sent</Text></Pressable>
        <OtpResendButton cooldown={cooldown} onResend={sendAgain} buttonStyle={{ minHeight: 44 }} />
    </View>;
}

test("resend is outlined when available, gray and disabled for 60 seconds after each code", () => {
    jest.useFakeTimers();
    try {
        const sendAgain = jest.fn();
        render(<Harness sendAgain={sendAgain} />);
        const getButton = (name) => screen.getByRole("button", { name });
        expect(StyleSheet.flatten(getButton("Resend code").props.style)).toMatchObject({
            backgroundColor: colors.surface, borderColor: colors.primary, minHeight: 44,
        });

        fireEvent.press(getButton("First code sent"));
        const waiting = getButton("Resend code (60s)");
        expect(waiting).toBeDisabled();
        expect(StyleSheet.flatten(waiting.props.style)).toMatchObject({
            backgroundColor: colors.offlineSoft, borderColor: colors.border, minHeight: 44,
        });
        fireEvent.press(waiting);
        expect(sendAgain).not.toHaveBeenCalled();

        act(() => jest.advanceTimersByTime(59_000));
        expect(getButton("Resend code (1s)")).toBeDisabled();
        act(() => jest.advanceTimersByTime(1000));
        expect(getButton("Resend code")).toBeEnabled();
        fireEvent.press(getButton("Resend code"));
        expect(sendAgain).toHaveBeenCalledTimes(1);
        fireEvent.press(getButton("Resend code (60s)"));
        expect(sendAgain).toHaveBeenCalledTimes(1);
    } finally {
        jest.useRealTimers();
    }
});
