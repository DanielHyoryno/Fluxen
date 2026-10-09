import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, AppState } from "react-native";
import StartGate from "../src/components/StartGate";
import { setLanguage } from "../src/services/i18n";
import { LOGO_DOCK_MS, LOGO_INTRO_MS, LOGO_REVEAL_MS } from "../src/common/fluxenLogoMotion";

jest.mock("react-native-safe-area-context", () => ({
    useSafeAreaInsets: () => ({ top: 24, bottom: 24, left: 0, right: 0 }),
}));

beforeEach(() => {
    jest.useFakeTimers();
    setLanguage("en");
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
});

afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
});

test("tap immediately skips the intro without waiting for the animation", async () => {
    const onStart = jest.fn();
    render(<StartGate onStart={onStart} />);
    await act(async () => {});
    expect(screen.getByTestId("fluxen-logo-intro")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Tap to start" }));
    expect(onStart).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByTestId("start-gate"));
    expect(onStart).toHaveBeenCalledTimes(1);
});

test("the logo reaches the wave loop and the gate remains tappable", async () => {
    const onStart = jest.fn();
    render(<StartGate onStart={onStart} />);
    await act(async () => {});
    act(() => { jest.advanceTimersByTime(Math.ceil(LOGO_INTRO_MS + LOGO_DOCK_MS + LOGO_REVEAL_MS) + 150); });
    expect(screen.getByTestId("fluxen-logo-steady")).toBeTruthy();
    expect(screen.getByText("Water monitor")).toBeTruthy();
    fireEvent.press(screen.getByTestId("start-gate"));
    expect(onStart).toHaveBeenCalledTimes(1);
});

test("reduced motion skips the intro and shows the final layout", async () => {
    AccessibilityInfo.isReduceMotionEnabled.mockResolvedValue(true);
    render(<StartGate onStart={jest.fn()} />);
    await act(async () => {});
    expect(screen.getByTestId("fluxen-logo-steady")).toBeTruthy();
    expect(screen.getByTestId("start-gate-copy")).toHaveStyle({ opacity: 1 });
});

test("unmount cancels the wave loop and removes listeners", async () => {
    const remove = jest.fn();
    jest.spyOn(AppState, "addEventListener").mockReturnValue({ remove });
    const cancel = jest.spyOn(global, "cancelAnimationFrame");
    const view = render(<StartGate onStart={jest.fn()} />);
    await act(async () => {});
    view.unmount();
    expect(cancel).toHaveBeenCalled();
    expect(remove).toHaveBeenCalledTimes(1);
});

test("the start action uses the selected language", async () => {
    setLanguage("id");
    const onStart = jest.fn();
    render(<StartGate onStart={onStart} />);
    await act(async () => {});
    fireEvent.press(screen.getByRole("button", { name: "Ketuk untuk mulai" }));
    expect(onStart).toHaveBeenCalledTimes(1);
});
