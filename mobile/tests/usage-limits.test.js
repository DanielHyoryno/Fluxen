import { t } from "../src/services/i18n";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import UsageLimitsScreen from "../src/screens/UsageLimits/UsageLimitsScreen";
import { useAuth } from "../src/context/AuthContext";
import { upsertUsageLimitsApi, usageLimitsApi } from "../src/services/api";

jest.mock("../src/context/AuthContext", () => ({
    useAuth: jest.fn(),
}));

jest.mock("../src/services/api", () => ({
    upsertUsageLimitsApi: jest.fn(),
    usageLimitsApi: jest.fn(),
}));

function renderUsageLimits() {
    const navigation = { goBack: jest.fn() };
    useAuth.mockReturnValue({ token: "user-token" });
    usageLimitsApi.mockResolvedValue({
        daily_usage_limit_l: null,
        monthly_usage_limit_l: null,
    });
    render(
        <UsageLimitsScreen
            route={{ params: { device: { device_code: "TEST-ESP32-01" } } }}
            navigation={navigation}
        />
    );
    return navigation;
}

describe("UsageLimitsScreen", () => {
    beforeEach(() => {
        usageLimitsApi.mockReset();
        upsertUsageLimitsApi.mockReset();
    });

    test("saves positive limits and uses null to disable an empty limit", async () => {
        upsertUsageLimitsApi.mockResolvedValue({});
        renderUsageLimits();

        const dailyInput = await screen.findByPlaceholderText("e.g. 500");
        const monthlyInput = screen.getByPlaceholderText("e.g. 15000");
        fireEvent.changeText(dailyInput, "25.5");
        fireEvent.changeText(monthlyInput, "");
        fireEvent.press(screen.getByText(t("Save Limits")));

        await waitFor(() => {
            expect(upsertUsageLimitsApi).toHaveBeenCalledWith("user-token", {
                device_code: "TEST-ESP32-01",
                daily_usage_limit_l: 25.5,
                monthly_usage_limit_l: null,
            });
        });
    });

    test.each(["0", "-5", "not-a-number"])("rejects invalid limit %s before calling the API", async (value) => {
        renderUsageLimits();

        const dailyInput = await screen.findByPlaceholderText("e.g. 500");
        fireEvent.changeText(dailyInput, value);
        fireEvent.press(screen.getByText(t("Save Limits")));

        expect(screen.getByText(t("Limits must be positive numbers or left empty."))).toBeTruthy();
        expect(upsertUsageLimitsApi).not.toHaveBeenCalled();
    });

    test.each([
        ["BB-LIM-001", "10", "100", 10, 100],
        ["BB-LIM-002", "", "100", null, 100],
        ["BB-LIM-003", "", "", null, null],
    ])("%s | save daily %s and monthly %s", async (id, daily, monthly, expectedDaily, expectedMonthly) => {
        upsertUsageLimitsApi.mockResolvedValue({});
        renderUsageLimits();
        fireEvent.changeText(await screen.findByPlaceholderText("e.g. 500"), daily);
        fireEvent.changeText(screen.getByPlaceholderText("e.g. 15000"), monthly);
        fireEvent.press(screen.getByText(t("Save Limits")));
        await waitFor(() => expect(upsertUsageLimitsApi).toHaveBeenCalledWith("user-token", {
            device_code: "TEST-ESP32-01", daily_usage_limit_l: expectedDaily, monthly_usage_limit_l: expectedMonthly,
        }));
    });
});
