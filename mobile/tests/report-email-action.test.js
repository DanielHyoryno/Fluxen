import { fireEvent, render, screen } from "@testing-library/react-native";
import ReportEmailAction from "../src/components/ReportEmailAction";
import { reportEmailStatusApi, requestReportEmailCodeApi, sendReportEmailApi, verifyReportEmailCodeApi } from "../src/services/api";

jest.mock("../src/services/api", () => ({
    reportEmailStatusApi: jest.fn(), requestReportEmailCodeApi: jest.fn(),
    sendReportEmailApi: jest.fn(), verifyReportEmailCodeApi: jest.fn(),
}));

const email = "tester@example.test";
const range = { from: "2026-11-01", to: "2026-11-30" };
const renderAction = () => render(<ReportEmailAction token="test-session" deviceCode="METER-01" range={range} />);

test("legacy accounts can verify their email from Profile", async () => {
    reportEmailStatusApi.mockResolvedValueOnce({ email, verified: false });
    requestReportEmailCodeApi.mockResolvedValue({ email, verified: false });
    verifyReportEmailCodeApi.mockRejectedValueOnce({ code: "REPORT_EMAIL_CODE_INVALID" }).mockResolvedValueOnce({ email, verified: true });
    render(<ReportEmailAction token="test-session" verifyOnly />);
    fireEvent.press(screen.getByRole("button", { name: "Verify your email" }));
    const input = await screen.findByPlaceholderText("000000", {}, { timeout: 5000 });
    expect(requestReportEmailCodeApi).toHaveBeenCalledWith("test-session", "en");
    expect(sendReportEmailApi).not.toHaveBeenCalled();

    fireEvent.changeText(input, "123456");
    fireEvent.press(screen.getByRole("button", { name: "Verify code" }));
    expect(await screen.findByText(/The code is incorrect/)).toBeTruthy();

    fireEvent.changeText(input, "654321");
    fireEvent.press(screen.getByRole("button", { name: "Verify code" }));
    expect(await screen.findByText("Your account email is verified.")).toBeTruthy();
    expect(sendReportEmailApi).not.toHaveBeenCalled();
});

test("an unverified report recipient is sent to Profile, not an OTP form in history", async () => {
    reportEmailStatusApi.mockResolvedValueOnce({ email, verified: false });
    const openProfile = jest.fn();
    render(<ReportEmailAction token="test-session" deviceCode="METER-01" range={range} onOpenProfile={openProfile} />);
    fireEvent.press(screen.getByRole("button", { name: "Send XLSX to my email" }));
    fireEvent.press(await screen.findByRole("button", { name: "Open Profile" }));
    expect(openProfile).toHaveBeenCalledTimes(1);
    expect(requestReportEmailCodeApi).not.toHaveBeenCalled();
    expect(sendReportEmailApi).not.toHaveBeenCalled();
});

test("a verified account can email the selected report without another code", async () => {
    reportEmailStatusApi.mockResolvedValueOnce({ email, verified: true });
    sendReportEmailApi.mockResolvedValueOnce({ email });
    renderAction();
    fireEvent.press(screen.getByRole("button", { name: "Send XLSX to my email" }));
    expect(await screen.findByText(`Report submitted for delivery to ${email}.`)).toBeTruthy();
    expect(sendReportEmailApi).toHaveBeenCalledWith("test-session", { device_code: "METER-01", ...range, locale: "en" });
});

test("explains that sending is unavailable when the provider is disabled", async () => {
    reportEmailStatusApi.mockRejectedValueOnce({ code: "REPORT_EMAIL_UNAVAILABLE" });
    renderAction();
    fireEvent.press(screen.getByRole("button", { name: "Send XLSX to my email" }));
    expect(await screen.findByText(/You can still download XLSX/)).toBeTruthy();
    expect(requestReportEmailCodeApi).not.toHaveBeenCalled();
});
