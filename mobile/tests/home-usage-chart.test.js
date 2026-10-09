import { render, screen } from "@testing-library/react-native";
import { StyleSheet, useWindowDimensions } from "react-native";
import { OverallUsageChart } from "../src/screens/Home/HomeScreen";
import { getMessages } from "../src/constants/messages";

jest.mock("../src/context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../src/services/api", () => ({}));
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
    __esModule: true,
    default: jest.fn(),
}));

beforeEach(() => {
    useWindowDimensions.mockReturnValue({ width: 360, height: 800, scale: 1, fontScale: 1 });
});

function makeSeries(days, zeroUsage = false) {
    return Array.from({ length: days }, (_, index) => ({
        date: `2026-10-${String(index + 1).padStart(2, "0")}`,
        totalLiters: zeroUsage || index % 3 === 0 ? 0 : index + 1,
    }));
}

test.each([10, 11, 30, 31].flatMap((days) => [true, false].map((zeroUsage) => [days, zeroUsage])))(
    "%i days retain visible tracks and scroll dimensions (zero usage: %s)",
    (days, zeroUsage) => {
        const series = makeSeries(days, zeroUsage);
        render(<OverallUsageChart series={series} chartWidth={298} messages={getMessages("id")} />);

        expect(screen.getAllByTestId(/^usage-bar-/)).toHaveLength(days);
        const viewport = StyleSheet.flatten(screen.getByTestId("usage-bars-scroll").props.style);
        const content = StyleSheet.flatten(screen.getByTestId("usage-bars-scroll").props.contentContainerStyle);
        expect(viewport.width).toBe(298);
        expect(viewport.height).toBe(content.height);
        expect(content.width).toBe(days * 30 + (days - 1) * 6);
        expect(StyleSheet.flatten(screen.getByTestId("usage-chart").props.style).height).toBe(content.height);

        const maxVolume = Math.max(...series.map((item) => item.totalLiters));
        for (const item of series) {
            const column = StyleSheet.flatten(screen.getByTestId(`usage-bar-${item.date}`).props.style);
            const track = StyleSheet.flatten(screen.getByTestId(`usage-track-${item.date}`).props.style);
            const fill = StyleSheet.flatten(screen.getByTestId(`usage-fill-${item.date}`).props.style);
            expect(column.width).toBe(30);
            expect(column.height).toBe(content.height);
            expect(column.flex).toBeUndefined();
            expect(column.flexShrink).toBe(0);
            expect(track.width).toBe(column.width);
            expect(track.height).toBe(120);
            expect(fill.height).toBe(item.totalLiters > 0 ? Math.max(item.totalLiters / maxVolume * 120, 3) : 0);
        }
    }
);

test("switching between short and long ranges preserves all bars", () => {
    const { rerender } = render(<OverallUsageChart series={makeSeries(7)} chartWidth={298} messages={getMessages("en")} />);
    expect(screen.queryByTestId("usage-bars-scroll")).toBeNull();
    expect(screen.getAllByTestId(/^usage-bar-/)).toHaveLength(7);

    rerender(<OverallUsageChart series={makeSeries(30)} chartWidth={298} messages={getMessages("en")} />);
    expect(screen.getByTestId("usage-bars-scroll")).toBeTruthy();
    expect(screen.getAllByTestId(/^usage-bar-/)).toHaveLength(30);

    rerender(<OverallUsageChart series={makeSeries(7)} chartWidth={298} messages={getMessages("en")} />);
    expect(screen.queryByTestId("usage-bars-scroll")).toBeNull();
    expect(screen.getAllByTestId(/^usage-bar-/)).toHaveLength(7);
});

test("large system text increases bar and label space without collapsing the chart", () => {
    useWindowDimensions.mockReturnValue({ width: 320, height: 800, scale: 1, fontScale: 1.5 });
    render(<OverallUsageChart series={makeSeries(30)} chartWidth={256} messages={getMessages("id")} />);
    const content = StyleSheet.flatten(screen.getByTestId("usage-bars-scroll").props.contentContainerStyle);
    expect(content.height).toBe(156);
    expect(StyleSheet.flatten(screen.getByTestId("usage-bar-2026-10-30").props.style).width).toBe(45);
    expect(screen.getByText("30").props.numberOfLines).toBe(1);
});

test.each([0, undefined, NaN])("unmeasured width %s uses a finite viewport until layout completes", (chartWidth) => {
    render(<OverallUsageChart series={makeSeries(30)} chartWidth={chartWidth} messages={getMessages("id")} />);
    expect(StyleSheet.flatten(screen.getByTestId("usage-bars-scroll").props.style).width).toBe(296);
});

test("empty series shows the no-data message without a blank chart area", () => {
    const messages = getMessages("id");
    render(<OverallUsageChart series={[]} chartWidth={298} messages={messages} />);
    expect(screen.getByText(messages.home.emptyTotalTrend)).toBeTruthy();
    expect(screen.queryByTestId("usage-chart")).toBeNull();
});
