import { exportXlsxApi, getDeviceApi, loginApi } from "../src/services/api";
import { getAppLocale } from "../src/services/storage";
import { getMessages } from "../src/constants/messages";
import { t } from "../src/services/i18n";

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

    test("loads fresh device metadata from the authenticated detail endpoint", async () => {
        const device = { id: "42", device_name: "Renamed Meter", install_location: null, category_id: 2, category_name: "Garden" };
        global.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: device }) });

        await expect(getDeviceApi("session-token", "42")).resolves.toEqual(device);
        expect(global.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/devices\/42$/), expect.objectContaining({
            method: "GET", headers: { Authorization: "Bearer session-token" },
        }));
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

    test("localizes server failures without displaying internal backend details", async () => {
        getAppLocale.mockResolvedValue("id");
        global.fetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({ success: false, message: "SQL connection internal detail" }) });
        await expect(loginApi({})).rejects.toThrow(t("serverError", {}, "id"));
    });

    test("localizes invalid credentials by error code", async () => {
        getAppLocale.mockResolvedValue("id");
        global.fetch.mockResolvedValue({ ok: false, status: 401, json: async () => ({ success: false, error_code: "INVALID_CREDENTIALS" }) });
        await expect(loginApi({})).rejects.toThrow("Email atau kata sandi salah");
    });

    test("rejects unreadable success responses instead of treating them as empty data", async () => {
        global.fetch.mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError("Unexpected HTML"); } });
        await expect(loginApi({})).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    });

    test("timeout also covers downloading the response body", async () => {
        jest.useFakeTimers();
        global.fetch.mockImplementation(async (_, options) => ({
            ok: true,
            json: () => new Promise((resolve, reject) => {
                options.signal.addEventListener("abort", () => reject(Object.assign(new Error("abort"), { name: "AbortError" })));
            }),
        }));
        const assertion = expect(loginApi({})).rejects.toMatchObject({ code: "TIMEOUT" });
        await jest.advanceTimersByTimeAsync(20000);
        await assertion;
    });
});
