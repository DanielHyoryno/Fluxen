import { exportXlsxApi, loginApi } from "../src/services/api";
import { getAppLocale } from "../src/services/storage";
import { getMessages } from "../src/constants/messages";

jest.mock("../src/services/storage", () => ({
    getAppLocale: jest.fn(),
}));

const messages = getMessages("en");

describe("API service", () => {
    beforeEach(() => {
        getAppLocale.mockResolvedValue("en");
        global.fetch = jest.fn();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test("returns response data for a successful request", async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({ success: true, data: { access_token: "token" } }),
        });

        await expect(loginApi({ email: "test@example.com", password: "password123" })).resolves.toEqual({
            access_token: "token",
        });
    });

    test("uses the backend error message for a rejected API request", async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            json: async () => ({ success: false, message: "Invalid email or password" }),
        });

        await expect(loginApi({ email: "test@example.com", password: "wrong" })).rejects.toThrow(
            "Invalid email or password"
        );
    });

    test("maps a network failure to the localized connectivity message", async () => {
        global.fetch.mockRejectedValue(new TypeError("Network request failed"));

        await expect(loginApi({ email: "test@example.com", password: "password123" })).rejects.toThrow(
            messages.auth.unableToReachServer
        );
    });

    test("aborts a request after the configured timeout", async () => {
        jest.useFakeTimers();
        global.fetch.mockImplementation((_, options) =>
            new Promise((resolve, reject) => {
                options.signal.addEventListener("abort", () => {
                    const error = new Error("Aborted");
                    error.name = "AbortError";
                    reject(error);
                });
            })
        );

        const requestAssertion = expect(
            loginApi({ email: "test@example.com", password: "password123" })
        ).rejects.toThrow(messages.auth.requestTimedOut);
        await jest.advanceTimersByTimeAsync(20000);

        await requestAssertion;
    });

    test("allows XLSX exports up to 60 seconds for a Render cold start", async () => {
        jest.useFakeTimers();
        let aborted = false;
        global.fetch.mockImplementation((_, options) =>
            new Promise((resolve, reject) => {
                options.signal.addEventListener("abort", () => {
                    aborted = true;
                    const error = new Error("Aborted");
                    error.name = "AbortError";
                    reject(error);
                });
            })
        );

        const requestAssertion = expect(
            exportXlsxApi("token", "DEVICE-01", "2026-08-01", "2026-08-31")
        ).rejects.toThrow(messages.auth.requestTimedOut);

        await jest.advanceTimersByTimeAsync(20000);
        expect(aborted).toBe(false);

        await jest.advanceTimersByTimeAsync(40000);
        await requestAssertion;
        expect(aborted).toBe(true);
    });
});
