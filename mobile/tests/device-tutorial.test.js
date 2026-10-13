import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";
import DeviceTutorial from "../src/components/DeviceTutorial";
import { DeviceTutorialProvider, useDeviceTutorial } from "../src/context/DeviceTutorialContext";
import { getDeviceTutorialSeen, saveDeviceTutorialSeen } from "../src/services/storage";
import { setLanguage, t } from "../src/services/i18n";

jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 24 }) }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }), { virtual: true });
jest.mock("../src/services/storage", () => ({ getDeviceTutorialSeen: jest.fn(), saveDeviceTutorialSeen: jest.fn() }));

function ReopenButton() {
    const { openTutorial } = useDeviceTutorial();
    return <Pressable onPress={openTutorial}><Text>Reopen</Text></Pressable>;
}

beforeEach(() => {
    setLanguage("en");
    getDeviceTutorialSeen.mockResolvedValue(false);
    saveDeviceTutorialSeen.mockResolvedValue(undefined);
});

test("first-use guide waits for authentication; skipping persists dismissal", async () => {
    const { rerender } = render(<DeviceTutorialProvider enabled={false}><ReopenButton /></DeviceTutorialProvider>);
    expect(getDeviceTutorialSeen).not.toHaveBeenCalled();
    rerender(<DeviceTutorialProvider enabled><ReopenButton /></DeviceTutorialProvider>);
    await screen.findByTestId("iot-tutorial");
    fireEvent.press(screen.getByRole("button", { name: t("tutorialSkip") }));
    expect(saveDeviceTutorialSeen).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("iot-tutorial")).toBeNull();
    rerender(<DeviceTutorialProvider enabled={false}><ReopenButton /></DeviceTutorialProvider>);
    rerender(<DeviceTutorialProvider enabled><ReopenButton /></DeviceTutorialProvider>);
    await act(async () => {});
    expect(screen.queryByTestId("iot-tutorial")).toBeNull();
});

test("a saved dismissal prevents automatic display, but manual reopening works", async () => {
    getDeviceTutorialSeen.mockResolvedValue(true);
    render(<DeviceTutorialProvider enabled><ReopenButton /></DeviceTutorialProvider>);
    await waitFor(() => expect(getDeviceTutorialSeen).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("iot-tutorial")).toBeNull();
    fireEvent.press(screen.getByText("Reopen"));
    expect(screen.getByText(t("tutorialScanTitle"))).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: t("tutorialNext") }));
    fireEvent.press(screen.getByRole("button", { name: t("tutorialSkip") }));
    fireEvent.press(screen.getByText("Reopen"));
    expect(screen.getByText(t("tutorialScanTitle"))).toBeTruthy();
});

test("a late storage read cannot reopen a guide the user just dismissed", async () => {
    let resolveRead;
    getDeviceTutorialSeen.mockReturnValue(new Promise((resolve) => { resolveRead = resolve; }));
    render(<DeviceTutorialProvider enabled><ReopenButton /></DeviceTutorialProvider>);
    fireEvent.press(screen.getByText("Reopen"));
    fireEvent.press(screen.getByRole("button", { name: t("tutorialSkip") }));
    await act(async () => resolveRead(false));
    expect(screen.queryByTestId("iot-tutorial")).toBeNull();
});

test.each(["en", "id"])("all six steps, back navigation and completion work in %s", (locale) => {
    setLanguage(locale);
    const onClose = jest.fn();
    render(<DeviceTutorial onClose={onClose} />);
    fireEvent.press(screen.getByRole("button", { name: t("tutorialNext") }));
    expect(screen.getByText(t("tutorialCodeTitle"))).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: t("tutorialBack") }));
    expect(screen.getByText(t("tutorialScanTitle"))).toBeTruthy();
    for (let i = 0; i < 5; i += 1) fireEvent.press(screen.getByRole("button", { name: t("tutorialNext") }));
    expect(screen.getByText(t("tutorialMonitorTitle"))).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole("button", { name: t("tutorialDone") }));
    expect(onClose).toHaveBeenCalledTimes(1);
});
