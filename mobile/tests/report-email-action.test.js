import { fireEvent, render, screen } from "@testing-library/react-native";
import ReportEmailAction from "../src/components/ReportEmailAction";
import { confirmFirebaseLinkApi, reportEmailStatusApi, requestFirebaseLinkApi, requestReportEmailCodeApi, sendReportEmailApi, verifyReportEmailCodeApi } from "../src/services/api";

jest.mock("../src/services/api", () => ({
    reportEmailStatusApi: jest.fn(), requestReportEmailCodeApi: jest.fn(),
    sendReportEmailApi: jest.fn(), verifyReportEmailCodeApi: jest.fn(),
    requestFirebaseLinkApi: jest.fn(), confirmFirebaseLinkApi: jest.fn(),
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

test("linking an old account requires its password and replaces its old session", async () => {
    const applySession = jest.fn();
    const session = { user: { email }, access_token: "linked-session" };
    reportEmailStatusApi.mockResolvedValueOnce({ email, verified: false, verification_method: "link" });
    requestFirebaseLinkApi.mockResolvedValueOnce({ email });
    confirmFirebaseLinkApi.mockResolvedValueOnce(session);
    render(<ReportEmailAction token="test-session" verifyOnly onSessionChange={applySession} />);
    fireEvent.press(screen.getByRole("button", { name: "Verify your email" }));
    const password = await screen.findByLabelText("Current Fluxen password");
    expect(password.props.secureTextEntry).toBe(true);
    expect(screen.getByRole("button", { name: "Send verification link" })).toBeDisabled();
    fireEvent.changeText(password, "my-old-password");
    fireEvent.press(screen.getByRole("button", { name: "Send verification link" }));
    fireEvent.press(await screen.findByRole("button", { name: "I’ve verified my email" }));
    expect(await screen.findByText("Your account email is verified.")).toBeTruthy();
    expect(confirmFirebaseLinkApi).toHaveBeenCalledWith("test-session", "my-old-password");
    expect(applySession).toHaveBeenCalledWith(session);
});
