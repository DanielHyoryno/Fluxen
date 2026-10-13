import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import BillingEstimationScreen from "../src/screens/BillingEstimation/BillingEstimationScreen";
import { getMessages } from "../src/constants/messages";
import { useAuth } from "../src/context/AuthContext";
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
    Calendar: () => null,
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
    render(<BillingEstimationScreen navigation={{ navigate: jest.fn() }} />);
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
});
