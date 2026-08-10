import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import LoginScreen from "../src/screens/Login/LoginScreen";
import { getMessages } from "../src/constants/messages";
import { useAuth } from "../src/context/AuthContext";

jest.mock("../src/context/AuthContext", () => ({
    useAuth: jest.fn(),
}));

const messages = getMessages("en");

function renderLogin({ login = jest.fn(), route } = {}) {
    const navigation = { navigate: jest.fn() };
    useAuth.mockReturnValue({ login, messages });
    render(<LoginScreen navigation={navigation} route={route} />);
    return { login, navigation };
}

describe("LoginScreen", () => {
    test("trims email and submits credentials", async () => {
        const login = jest.fn().mockResolvedValue({});
        renderLogin({ login });

        fireEvent.changeText(screen.getByPlaceholderText(messages.auth.emailPlaceholder), "  test@example.com  ");
        fireEvent.changeText(screen.getByPlaceholderText(messages.auth.passwordPlaceholder), "password123");
        fireEvent.press(screen.getByText(messages.auth.loginButton));

        await waitFor(() => expect(login).toHaveBeenCalledWith("test@example.com", "password123"));
    });

    test("shows backend or connectivity errors", async () => {
        const login = jest.fn().mockRejectedValue(new Error(messages.auth.unableToReachServer));
        renderLogin({ login });

        fireEvent.changeText(screen.getByPlaceholderText(messages.auth.emailPlaceholder), "test@example.com");
        fireEvent.changeText(screen.getByPlaceholderText(messages.auth.passwordPlaceholder), "password123");
        fireEvent.press(screen.getByText(messages.auth.loginButton));

        expect(await screen.findByText(messages.auth.unableToReachServer)).toBeTruthy();
    });

    test("shows registration success and opens the Register screen", () => {
        const { navigation } = renderLogin({
            route: { params: { registrationSuccess: messages.auth.registerSuccess } },
        });

        expect(screen.getByText(messages.auth.registerSuccess)).toBeTruthy();
        fireEvent.press(screen.getByText(messages.auth.noAccount));
        expect(navigation.navigate).toHaveBeenCalledWith("Register");
    });
});
