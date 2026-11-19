import { fireEvent, render, screen } from "@testing-library/react-native";
import ForgotPasswordScreen from "../src/screens/Login/ForgotPasswordScreen";
import { completePasswordResetApi, requestPasswordResetApi, verifyPasswordResetApi } from "../src/services/api";

jest.mock("../src/services/api", () => ({
    completePasswordResetApi: jest.fn(), requestPasswordResetApi: jest.fn(), verifyPasswordResetApi: jest.fn(),
}));

test("an accepted reset request does not unlock the password form until OTP verification succeeds", async () => {
    const navigation = { reset: jest.fn(), goBack: jest.fn() };
    const email = "person@example.test";
    requestPasswordResetApi.mockResolvedValue({ accepted: true });
    verifyPasswordResetApi.mockRejectedValueOnce(new Error("Invalid code")).mockResolvedValueOnce({ reset_token: "reset-token" });
    completePasswordResetApi.mockResolvedValue({ password_reset: true });
    render(<ForgotPasswordScreen navigation={navigation} route={{ params: { email } }} />);
    fireEvent.press(screen.getByRole("button", { name: "Send code" }));
    const input = await screen.findByLabelText("Verification code");
    expect(requestPasswordResetApi).toHaveBeenCalledWith(email, "en");
    expect(screen.queryByLabelText("New password")).toBeNull();
    fireEvent.changeText(input, "132456");
    fireEvent.press(screen.getByRole("button", { name: "Verify code" }));
    expect(await screen.findByText("Invalid code")).toBeTruthy();
    fireEvent.changeText(input, "123456");
    fireEvent.press(screen.getByRole("button", { name: "Verify code" }));
    fireEvent.changeText(await screen.findByLabelText("New password"), "new-password");
    fireEvent.changeText(screen.getByLabelText("Confirm new password"), "new-password");
    fireEvent.press(screen.getByRole("button", { name: "Save new password" }));
    expect(completePasswordResetApi).toHaveBeenCalledWith("reset-token", "new-password");
    await screen.findByRole("button", { name: "Save new password" });
    expect(navigation.reset).toHaveBeenCalledWith(expect.objectContaining({ routes: [expect.objectContaining({ name: "Login" })] }));
});
