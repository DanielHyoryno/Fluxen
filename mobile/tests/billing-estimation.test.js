import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import BillingEstimationScreen from "../src/screens/BillingEstimation/BillingEstimationScreen";
import { getMessages } from "../src/constants/messages";
import { useAuth } from "../src/context/AuthContext";
import { t, getLanguageTag, formatValue } from "../src/services/i18n";
import { estimateBillApi, listCategoriesApi, listDevicesApi } from "../src/services/api";

jest.mock("../src/context/AuthContext", () => ({
    useAuth: jest.fn(),
}));

jest.mock("../src/services/api", () => ({
    estimateBillApi: jest.fn(),
    listCategoriesApi: jest.fn(),
    listDevicesApi: jest.fn(),
}));

jest.mock("react-native-calendars", () => ({
    Calendar: ({ onDayPress }) => {
        const React = require("react");
        const { Pressable, Text } = require("react-native");
        return React.createElement(Pressable, { testID: "billing-calendar-date", onPress: () => onDayPress({ dateString: "2026-01-01" }) }, React.createElement(Text, null, "Choose test date"));
    },
}));

const messages = getMessages("en");
const categories = [
    { id: 10, name: "Home" },
    { id: 20, name: "Garden" },
];
const devices = [
    { id: 1, device_name: "Kitchen Meter", category_id: 10, category_name: "Home" },
    { id: 2, device_name: "Garden Meter", category_id: 20, category_name: "Garden" },
];
const emptyEstimate = {
    summary: { device_count: 0, total_liters: 0, estimated_cost: 0, currency: "IDR" },
    items: [],
};

function renderBillingEstimation() {
    useAuth.mockReturnValue({ token: "user-token", messages });
    listCategoriesApi.mockResolvedValue({ items: categories });
    listDevicesApi.mockResolvedValue({ items: devices });
    estimateBillApi.mockResolvedValue(emptyEstimate);
    const navigation = { navigate: jest.fn() };
    render(<BillingEstimationScreen navigation={navigation} />);
    return navigation;
}

describe("BillingEstimationScreen", () => {
    beforeEach(() => {
        estimateBillApi.mockReset();
        listCategoriesApi.mockReset();
        listDevicesApi.mockReset();
    });

    test("only submits selected devices that belong to the active category", async () => {
        renderBillingEstimation();
        await screen.findByText("Kitchen Meter", {}, { timeout: 5000 });
        await waitFor(() => expect(estimateBillApi).toHaveBeenCalledTimes(1));
        estimateBillApi.mockClear();

        fireEvent.press(screen.getByRole("button", { name: messages.billing.categoryFilter }));
        fireEvent.press(screen.getByRole("button", { name: "Garden" }));
        fireEvent.press(screen.getByText(messages.billing.apply));

        await waitFor(() => {
            expect(estimateBillApi).toHaveBeenCalledWith(
                "user-token",
                expect.objectContaining({ category_id: 20, device_ids: [2] })
            );
        });
    });

    test("submits an empty device list when all visible devices are unchecked", async () => {
        renderBillingEstimation();
        await screen.findByText("Kitchen Meter", {}, { timeout: 5000 });
        await waitFor(() => expect(estimateBillApi).toHaveBeenCalledTimes(1));
        estimateBillApi.mockClear();

        fireEvent.press(screen.getByText("Kitchen Meter"));
        fireEvent.press(screen.getByText("Garden Meter"));
        fireEvent.press(screen.getByText(messages.billing.apply));

        await waitFor(() => {
            expect(estimateBillApi).toHaveBeenCalledWith(
                "user-token",
                expect.objectContaining({ category_id: null, device_ids: [] })
            );
        });
    });

    test.each(["day", "month", "year"])("BB-BIL-007 | period preset %s is submitted", async (preset) => {
        renderBillingEstimation();
        await screen.findByText("Kitchen Meter");
        await waitFor(() => expect(estimateBillApi).toHaveBeenCalled());
        estimateBillApi.mockClear();
        fireEvent.press(screen.getByRole("button", { name: messages.billing[preset] }));
        fireEvent.press(screen.getByText(messages.billing.apply));
        await waitFor(() => expect(estimateBillApi).toHaveBeenCalled());
        const payload = estimateBillApi.mock.calls.at(-1)[1];
        const today = new Date();
        const localDate = date => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
        expect(payload.to).toBe(localDate(today));
        expect(payload.from).toBe(preset === "day" ? localDate(today) : preset === "month"
            ? localDate(new Date(today.getFullYear(), today.getMonth(), 1))
            : localDate(new Date(today.getFullYear(), 0, 1)));
    });

    test("BB-BIL-009 | custom dates and water-price navigation", async () => {
        const navigation = renderBillingEstimation();
        await screen.findByText("Kitchen Meter");
        await waitFor(() => expect(estimateBillApi).toHaveBeenCalled());
        fireEvent.press(screen.getByText(messages.billing.manageWaterPrice));
        expect(navigation.navigate).toHaveBeenCalledWith("BillingSettings");
        fireEvent.press(screen.getByRole("button", { name: messages.billing.custom }));
        fireEvent.press(screen.getByText(messages.billing.from));
        fireEvent.press(screen.getByTestId("billing-calendar-date"));
        estimateBillApi.mockClear();
        fireEvent.press(screen.getByText(messages.billing.apply));
        await waitFor(() => expect(estimateBillApi).toHaveBeenCalledWith("user-token", expect.objectContaining({ from: "2026-01-01" })));
    });

    test("BB-BIL-003 | summary and per-device result render 3 L and Rp30", async () => {
        renderBillingEstimation();
        await screen.findByText("Kitchen Meter");
        await waitFor(() => expect(estimateBillApi).toHaveBeenCalled());
        estimateBillApi.mockResolvedValue({ summary: { total_liters: 3, estimated_cost: 30, device_count: 1 },
            items: [{ device_id: 1, device_name: "Kitchen Meter", total_liters: 3, estimated_cost: 30 }] });
        fireEvent.press(screen.getByText(messages.billing.apply));
        const money = new Intl.NumberFormat(getLanguageTag(), { style: "currency", currency: "IDR", maximumFractionDigits: 2 }).format(30);
        await waitFor(() => expect(screen.getAllByText(money)).toHaveLength(2));
        expect(screen.getAllByText(`${formatValue(3, 3)} L`)).toHaveLength(2);
    });

    test("BB-BIL-006 | missing water price is visible after Apply", async () => {
        renderBillingEstimation();
        await screen.findByText("Kitchen Meter");
        await waitFor(() => expect(estimateBillApi).toHaveBeenCalled());
        estimateBillApi.mockRejectedValue(Object.assign(new Error(t("priceNotSet")), { code: "BILLING_SETTINGS_NOT_FOUND" }));
        fireEvent.press(screen.getByText(messages.billing.apply));
        expect(await screen.findByText(t("priceNotSet"))).toBeTruthy();
    });

    test("BB-BIL-008 | recalculating replaces the previously displayed price", async () => {
        renderBillingEstimation();
        await screen.findByText("Kitchen Meter");
        await waitFor(() => expect(estimateBillApi).toHaveBeenCalled());
        for (const cost of [30, 60]) {
            estimateBillApi.mockResolvedValue({ summary: { total_liters: 3, estimated_cost: cost, device_count: 1 }, items: [] });
            fireEvent.press(screen.getByText(messages.billing.apply));
            const money = new Intl.NumberFormat(getLanguageTag(), { style: "currency", currency: "IDR", maximumFractionDigits: 2 }).format(cost);
            expect(await screen.findByText(money)).toBeTruthy();
        }
        expect(screen.queryByText(new Intl.NumberFormat(getLanguageTag(), { style: "currency", currency: "IDR", maximumFractionDigits: 2 }).format(30))).toBeNull();
    });
});
