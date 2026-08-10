import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import RegisterScreen from "../src/screens/Register/RegisterScreen";
import { getMessages } from "../src/constants/messages";
import { useAuth } from "../src/context/AuthContext";

jest.mock("../src/context/AuthContext", () => ({
    useAuth: jest.fn(),
}));

const messages = getMessages("en");

function renderRegister(register = jest.fn()) {
    const navigation = {
        goBack: jest.fn(),
        reset: jest.fn(),
    };
    useAuth.mockReturnValue({ register, messages });
    render(<RegisterScreen navigation={navigation} />);
    return { navigation, register };
}

describe("RegisterScreen", () => {
    test("shows a separate required error for every empty field", () => {
        const { register } = renderRegister();

        fireEvent.press(screen.getByText(messages.auth.registerButton));

        expect(screen.getByText(messages.auth.fullNameRequired)).toBeTruthy();
        expect(screen.getByText(messages.auth.emailRequired)).toBeTruthy();
        expect(screen.getByText(messages.auth.passwordRequired)).toBeTruthy();
        expect(register).not.toHaveBeenCalled();
    });

    test("rejects a short name, invalid email, and short password independently", () => {
        const { register } = renderRegister();

        fireEvent.changeText(screen.getByPlaceholderText(messages.auth.fullNamePlaceholder), "A");
        fireEvent.changeText(screen.getByPlaceholderText(messages.auth.emailPlaceholder), "invalid-email");
        fireEvent.changeText(screen.getByPlaceholderText(messages.auth.passwordMinPlaceholder), "12");
        fireEvent.press(screen.getByText(messages.auth.registerButton));

        expect(screen.getByText(messages.auth.fullNameMinLength)).toBeTruthy();
        expect(screen.getByText(messages.auth.emailInvalid)).toBeTruthy();
        expect(screen.getByText(messages.auth.passwordMinLength)).toBeTruthy();
        expect(register).not.toHaveBeenCalled();
    });

    test("submits normalized data and returns to Login after success", async () => {
        const register = jest.fn().mockResolvedValue({});
        const { navigation } = renderRegister(register);

        fireEvent.changeText(screen.getByPlaceholderText(messages.auth.fullNamePlaceholder), "  Test User  ");
        fireEvent.changeText(screen.getByPlaceholderText(messages.auth.emailPlaceholder), "  test@example.com  ");
        fireEvent.changeText(screen.getByPlaceholderText(messages.auth.passwordMinPlaceholder), "password123");
        fireEvent.press(screen.getByText(messages.auth.registerButton));

        await waitFor(() => {
            expect(register).toHaveBeenCalledWith("Test User", "test@example.com", "password123");
            expect(navigation.reset).toHaveBeenCalledWith({
                index: 0,
                routes: [{ name: "Login", params: { registrationSuccess: messages.auth.registerSuccess } }],
            });
        });
    });

    test("maps duplicate email response to the email field", async () => {
        const register = jest.fn().mockRejectedValue(new Error("Email already used"));
        renderRegister(register);

        fireEvent.changeText(screen.getByPlaceholderText(messages.auth.fullNamePlaceholder), "Test User");
        fireEvent.changeText(screen.getByPlaceholderText(messages.auth.emailPlaceholder), "used@example.com");
        fireEvent.changeText(screen.getByPlaceholderText(messages.auth.passwordMinPlaceholder), "password123");
        fireEvent.press(screen.getByText(messages.auth.registerButton));

        expect(await screen.findByText(messages.auth.emailAlreadyUsed)).toBeTruthy();
    });
});
