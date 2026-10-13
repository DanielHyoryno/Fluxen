import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import MetricGrid from "../src/components/MetricGrid";
import { OverallUsageChart } from "../src/screens/Home/HomeScreen";
import { getMessages } from "../src/constants/messages";

jest.mock("../src/context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../src/services/api", () => ({}));

test.each([0, 2.5])("long ranges retain explicit bar dimensions with usage %s", (usage) => {
    const series = Array.from({ length: 31 }, (_, index) => ({
        date: `2026-08-${String(index + 1).padStart(2, "0")}`,
        totalLiters: usage,
    }));
    render(<OverallUsageChart series={series} chartWidth={298} messages={getMessages("id")} />);
    const columns = screen.getAllByTestId(/^usage-bar-/);
    expect(columns).toHaveLength(31);
    for (const column of columns) {
        const style = StyleSheet.flatten(column.props.style);
        expect(style.width).toBeGreaterThanOrEqual(30);
        expect(style.height).toBeGreaterThanOrEqual(140);
        expect(style.flexShrink).toBe(0);
        expect(style.flex).toBeUndefined();
    }
    const content = StyleSheet.flatten(screen.getByTestId("usage-bars-scroll").props.contentContainerStyle);
    expect(content.width).toBeGreaterThan(298);
    expect(content.height).toBeGreaterThanOrEqual(140);
});

test("compact metrics share typography and keep labels and units on one line", () => {
    render(<MetricGrid items={[
        { label: "Pemakaian hari ini", value: "0,000 L" },
        { label: "Debit rata-rata", value: "0,00 L/min" },
    ]} />);
    const labels = [screen.getByText("Pemakaian hari ini"), screen.getByText("Debit rata-rata")];
    const values = [screen.getByText("0,000 L"), screen.getByText("0,00 L/min")];
    for (const pair of [labels, values]) {
        expect(StyleSheet.flatten(pair[0].props.style).fontSize).toBe(StyleSheet.flatten(pair[1].props.style).fontSize);
        for (const text of pair) {
            expect(text.props.numberOfLines).toBe(1);
            expect(text.props.adjustsFontSizeToFit).toBe(true);
        }
    }
});
