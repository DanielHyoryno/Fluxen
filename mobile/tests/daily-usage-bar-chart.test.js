import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import DailyUsageBarChart from "../src/components/DailyUsageBarChart";
import { setLanguage, t } from "../src/services/i18n";

const series = [
    { date: "2026-10-27", totalLiters: 12.35 },
    { date: "2026-10-28", totalLiters: 0 },
];
beforeEach(() => setLanguage("en"));

test.each([
    ["en", "October 27, 2026", "12.350 L"],
    ["id", "27 Oktober 2026", "12,350 L"],
])("selecting a date shows its exact total in %s", (locale, dateLabel, volumeLabel) => {
    setLanguage(locale);
    render(<DailyUsageBarChart series={series} chartWidth={300} />);
    expect(screen.getByText(t("tapDailyUsageBar"))).toBeTruthy();
    fireEvent.press(screen.getByTestId("usage-bar-2026-10-27"));
    const readout = within(screen.getByTestId("usage-selection"));
    expect(readout.getByText(dateLabel)).toBeTruthy();
    expect(readout.getByText(volumeLabel)).toBeTruthy();
    expect(readout.getByText(t("Total Usage"))).toBeTruthy();
    expect(screen.getByRole("button", { selected: true })).toBeTruthy();
});

test("a zero-volume day is selectable and replaces the previous selection", () => {
    render(<DailyUsageBarChart series={series} chartWidth={300} />);
    fireEvent.press(screen.getByTestId("usage-bar-2026-10-27"));
    fireEvent.press(screen.getByTestId("usage-bar-2026-10-28"));
    expect(within(screen.getByTestId("usage-selection")).getByText("0.000 L")).toBeTruthy();
    expect(screen.getByTestId("usage-bar-2026-10-27").props.accessibilityState.selected).toBe(false);
    expect(screen.getByTestId("usage-bar-2026-10-28").props.accessibilityState.selected).toBe(true);
    expect(StyleSheet.flatten(screen.getByTestId("usage-fill-2026-10-28").props.style).height).toBe(0);
});

test("refreshing totals updates the readout without losing the selected day", () => {
    const { rerender } = render(<DailyUsageBarChart series={series} chartWidth={300} />);
    fireEvent.press(screen.getByTestId("usage-bar-2026-10-27"));
    rerender(<DailyUsageBarChart series={[{ ...series[0], totalLiters: 13.125 }, series[1]]} chartWidth={300} />);
    expect(within(screen.getByTestId("usage-selection")).getByText("13.125 L")).toBeTruthy();
});

test("changing the date range clears selection, including overlapping dates", () => {
    const { rerender } = render(<DailyUsageBarChart series={series} chartWidth={300} />);
    fireEvent.press(screen.getByTestId("usage-bar-2026-10-27"));
    rerender(<DailyUsageBarChart series={[...series, { date: "2026-10-29", totalLiters: 2 }]} chartWidth={300} />);
    expect(screen.queryByRole("button", { selected: true })).toBeNull();
    expect(screen.getByText(t("tapDailyUsageBar"))).toBeTruthy();
});

test("changing language updates the current selection", () => {
    render(<DailyUsageBarChart series={series} chartWidth={300} />);
    fireEvent.press(screen.getByTestId("usage-bar-2026-10-27"));
    act(() => setLanguage("id"));
    expect(within(screen.getByTestId("usage-selection")).getByText("27 Oktober 2026")).toBeTruthy();
    expect(within(screen.getByTestId("usage-selection")).getByText("12,350 L")).toBeTruthy();
});

test("the last date of a long range remains selectable", () => {
    const month = Array.from({ length: 31 }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, "0")}`, totalLiters: i + 1 }));
    render(<DailyUsageBarChart series={month} chartWidth={256} />);
    expect(screen.getByTestId("usage-bars-scroll")).toBeTruthy();
    fireEvent.press(screen.getByTestId("usage-bar-2026-10-31"));
    expect(within(screen.getByTestId("usage-selection")).getByText("31.000 L")).toBeTruthy();
});
