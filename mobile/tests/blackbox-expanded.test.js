// UI simulation only: native services and API transport are mocked.
// Evidence is written only after the assertions for a variation pass.
import fs from "node:fs";
import path from "node:path";
import { Alert, Animated } from "react-native";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import RegisterScreen from "../src/screens/Register/RegisterScreen";
import ManageCategoryScreen from "../src/screens/ManageCategory/ManageCategoryScreen";
import DevicesScreen from "../src/screens/Devices/DevicesScreen";
import DeviceEditScreen from "../src/screens/DeviceEdit/DeviceEditScreen";
import ProfileScreen from "../src/screens/Profile/ProfileScreen";
import BillingSettingsScreen from "../src/screens/BillingSettings/BillingSettingsScreen";
import LoginScreen from "../src/screens/Login/LoginScreen";
import { getMessages } from "../src/constants/messages";
import { setLanguage, t } from "../src/services/i18n";
import { useAuth } from "../src/context/AuthContext";
import * as api from "../src/services/api";

jest.mock("../src/context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../src/context/DeviceTutorialContext", () => ({ useDeviceTutorial: () => ({ openTutorial: jest.fn() }) }));
jest.mock("../src/services/api", () => ({
    createCategoryApi: jest.fn(), updateCategoryApi: jest.fn(), deleteCategoryApi: jest.fn(),
    listCategoriesApi: jest.fn(), createDeviceApi: jest.fn(), deleteDeviceApi: jest.fn(),
    listDevicesApi: jest.fn(), updateDeviceApi: jest.fn(), billingSettingsApi: jest.fn(), upsertBillingSettingsApi: jest.fn(),
}));
jest.mock("../src/hooks/useScreenEntranceAnimation", () => () => ({ animatedStyle: {} }));
jest.mock("@react-navigation/native", () => ({
    useFocusEffect: (callback) => require("react").useEffect(callback, [callback]),
}));

const messages = getMessages("id");
jest.setTimeout(30000);
const observations = [];
const token = "synthetic-user-session";
const categories = [{ id: 10, name: "Dapur" }, { id: 20, name: "Taman" }];
const devices = [
    { id: 1, device_code: "TEST-01", device_name: "Meter Dapur", category_id: 10, category_name: "Dapur", status: "online" },
    { id: 2, device_code: "TEST-02", device_name: "Meter Taman", category_id: 20, category_name: "Taman", status: "offline" },
    { id: 3, device_code: "TEST-03", device_name: "Meter Bebas", category_id: null, status: "offline" },
];

function observe(id, variation, actual) { observations.push({ id, variation, actual }); }
function auth(extra = {}) {
    useAuth.mockReturnValue({ token, messages, user: { id: 1, full_name: "Pengguna Uji", email: "uji@example.test" }, locale: "id", ...extra });
}
beforeEach(() => {
    jest.clearAllMocks();
    Object.values(api).filter(jest.isMockFunction).forEach((mock) => mock.mockReset());
    act(() => setLanguage("id"));
    auth();
    api.listCategoriesApi.mockResolvedValue({ items: categories });
    api.listDevicesApi.mockResolvedValue({ items: devices });
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    jest.spyOn(Animated, "loop").mockReturnValue({ start: jest.fn(), stop: jest.fn() });
});
afterEach(() => { cleanup(); act(() => setLanguage("en")); });
afterAll(() => {
    if (process.env.BLACKBOX_EVIDENCE_DIR) {
        fs.mkdirSync(process.env.BLACKBOX_EVIDENCE_DIR, { recursive: true });
        fs.writeFileSync(path.join(process.env.BLACKBOX_EVIDENCE_DIR, "ui-observations.json"), JSON.stringify(observations, null, 2));
    }
});

function registerForm(overrides = {}) {
    const register = jest.fn().mockResolvedValue({});
    const navigation = { reset: jest.fn(), goBack: jest.fn() };
    auth({ register });
    render(<RegisterScreen navigation={navigation} />);
    const values = { name: "Pengguna Uji", email: "uji@example.test", password: "password123", ...overrides };
    fireEvent.changeText(screen.getByPlaceholderText(messages.auth.fullNamePlaceholder), values.name);
    fireEvent.changeText(screen.getByPlaceholderText(messages.auth.emailPlaceholder), values.email);
    fireEvent.changeText(screen.getByPlaceholderText(messages.auth.passwordMinPlaceholder), values.password);
    return { register, navigation, values };
}

const invalidRegistration = [
    ["BB-REG-003", "nama kosong", { name: "" }, "fullNameRequired"],
    ["BB-REG-003", "nama satu karakter", { name: "A" }, "fullNameMinLength"],
    ["BB-REG-003", "nama 121 karakter", { name: "A".repeat(121) }, "fullNameMaxLength"],
    ["BB-REG-005", "email kosong", { email: "" }, "emailRequired"],
    ["BB-REG-005", "format email salah", { email: "bukan-email" }, "emailInvalid"],
    ["BB-REG-005", "email 151 karakter", { email: `${"a".repeat(139)}@example.com` }, "emailMaxLength"],
    ["BB-REG-006", "kata sandi kosong", { password: "" }, "passwordRequired"],
    ["BB-REG-006", "kata sandi tujuh karakter", { password: "1234567" }, "passwordMinLength"],
    ["BB-REG-006", "kata sandi 101 karakter", { password: "a".repeat(101) }, "passwordMaxLength"],
];
for (const [id, variation, values, errorKey] of invalidRegistration) {
    test(`${id} | ${variation}`, () => {
        const { register } = registerForm(values);
        fireEvent.press(screen.getByText(messages.auth.registerButton));
        expect(screen.getByText(messages.auth[errorKey])).toBeTruthy();
        expect(register).not.toHaveBeenCalled();
        observe(id, variation, messages.auth[errorKey]);
    });
}
for (const [id, variation, values] of [
    ["BB-REG-004", "nama dua karakter", { name: "AB" }],
    ["BB-REG-004", "nama 120 karakter", { name: "A".repeat(120) }],
    ["BB-REG-007", "kata sandi delapan karakter", { password: "12345678" }],
    ["BB-REG-007", "kata sandi 100 karakter", { password: "a".repeat(100) }],
]) {
    test(`${id} | ${variation}`, async () => {
        const { register, navigation, values: expected } = registerForm(values);
        fireEvent.press(screen.getByText(messages.auth.registerButton));
        await waitFor(() => expect(navigation.reset).toHaveBeenCalled());
        expect(register).toHaveBeenCalledWith(expected.name, expected.email, expected.password);
        observe(id, variation, "Masukan diterima; navigasi ke Login dijalankan setelah respons API simulasi berhasil.");
    });
}

async function categoryForm(items = categories) {
    api.listCategoriesApi.mockResolvedValue({ items });
    render(<ManageCategoryScreen />);
    await screen.findByText(messages.categories.categoryListTitle);
}
for (const [variation, value, message] of [
    ["kosong", "", messages.categories.nameRequired],
    ["hanya spasi", "   ", messages.categories.nameRequired],
    ["satu karakter", "A", messages.categories.nameTooShort],
]) {
    test(`BB-KAT-002 | nama ${variation}`, async () => {
        await categoryForm();
        fireEvent.changeText(screen.getByPlaceholderText(messages.categories.categoryNameExamplePlaceholder), value);
        fireEvent.press(screen.getByText(messages.categories.addButton));
        expect(screen.getByText(message)).toBeTruthy();
        expect(api.createCategoryApi).not.toHaveBeenCalled();
        observe("BB-KAT-002", variation, message);
    });
}
test("BB-KAT-001 | tambah kategori dan refresh daftar", async () => {
    await categoryForm([]);
    api.createCategoryApi.mockResolvedValue({ id: 30, name: "Kamar Mandi" });
    api.listCategoriesApi.mockResolvedValue({ items: [{ id: 30, name: "Kamar Mandi" }] });
    fireEvent.changeText(screen.getByPlaceholderText(messages.categories.categoryNameExamplePlaceholder), "  Kamar Mandi  ");
    fireEvent.press(screen.getByText(messages.categories.addButton));
    expect(await screen.findByText("Kamar Mandi")).toBeTruthy();
    expect(api.createCategoryApi).toHaveBeenCalledWith(token, { name: "Kamar Mandi" });
    observe("BB-KAT-001", "tambah", "Kamar Mandi muncul; spasi tepi dibuang sebelum permintaan dikirim.");
});
test("BB-KAT-004 | edit kategori dan refresh daftar", async () => {
    await categoryForm();
    fireEvent.press(screen.getAllByText(messages.categories.editButton)[0]);
    fireEvent.changeText(screen.getByPlaceholderText(messages.categories.categoryNamePlaceholder), "Dapur Baru");
    api.updateCategoryApi.mockResolvedValue({});
    api.listCategoriesApi.mockResolvedValue({ items: [{ id: 10, name: "Dapur Baru" }, categories[1]] });
    fireEvent.press(screen.getByText(messages.categories.saveButton));
    expect(await screen.findByText("Dapur Baru")).toBeTruthy();
    expect(api.updateCategoryApi).toHaveBeenCalledWith(token, 10, { name: "Dapur Baru" });
    observe("BB-KAT-004", "ubah nama", "Dapur Baru muncul setelah respons penyimpanan simulasi.");
});
test("BB-KAT-006 | batal edit kategori", async () => {
    await categoryForm();
    fireEvent.press(screen.getAllByText(messages.categories.editButton)[0]);
    fireEvent.changeText(screen.getByPlaceholderText(messages.categories.categoryNamePlaceholder), "Tidak Disimpan");
    fireEvent.press(screen.getByText(messages.categories.cancelButton));
    expect(screen.queryByPlaceholderText(messages.categories.categoryNamePlaceholder)).toBeNull();
    expect(screen.getByText("Dapur")).toBeTruthy();
    expect(api.updateCategoryApi).not.toHaveBeenCalled();
    observe("BB-KAT-006", "batal", "Form edit tertutup; Dapur tetap tampil; API update tidak dipanggil.");
});
test("BB-KAT-007 | konfirmasi hapus kategori", async () => {
    await categoryForm();
    api.deleteCategoryApi.mockResolvedValue({});
    api.listCategoriesApi.mockResolvedValue({ items: [categories[1]] });
    fireEvent.press(screen.getAllByText(messages.categories.deleteButton)[0]);
    expect(screen.getByText(messages.categories.deleteDialogTitle)).toBeTruthy();
    fireEvent.press(screen.getAllByText(messages.categories.deleteButton).at(-1));
    await waitFor(() => expect(api.deleteCategoryApi).toHaveBeenCalledWith(token, 10));
    await waitFor(() => expect(screen.queryByText("Dapur")).toBeNull());
    observe("BB-KAT-007", "hapus", "Konfirmasi tampil; kategori Dapur hilang setelah respons API simulasi.");
});
test("BB-KAT-009 | batal hapus kategori", async () => {
    await categoryForm();
    fireEvent.press(screen.getAllByText(messages.categories.deleteButton)[0]);
    fireEvent.press(screen.getByText(t("Cancel")));
    expect(api.deleteCategoryApi).not.toHaveBeenCalled();
    expect(screen.getByText("Dapur")).toBeTruthy();
    observe("BB-KAT-009", "batal hapus", "Kategori tetap tampil; API delete tidak dipanggil.");
});

test("BB-KAT-003 | pesan nama kategori duplikat pada UI", async () => {
    await categoryForm();
    api.createCategoryApi.mockRejectedValue(new Error(messages.categories.duplicateName));
    fireEvent.changeText(screen.getByPlaceholderText(messages.categories.categoryNameExamplePlaceholder), "dapur");
    fireEvent.press(screen.getByText(messages.categories.addButton));
    expect(await screen.findByText(messages.categories.duplicateName)).toBeTruthy();
    observe("BB-KAT-003", "duplikat", messages.categories.duplicateName);
});
test("BB-KAT-005 | pesan duplikasi ketika edit kategori", async () => {
    await categoryForm();
    api.updateCategoryApi.mockRejectedValue(new Error(messages.categories.duplicateName));
    fireEvent.press(screen.getAllByText(messages.categories.editButton)[0]);
    fireEvent.changeText(screen.getByPlaceholderText(messages.categories.categoryNamePlaceholder), "Taman");
    fireEvent.press(screen.getByText(messages.categories.saveButton));
    expect(await screen.findByText(messages.categories.duplicateName)).toBeTruthy();
    observe("BB-KAT-005", "edit duplikat", messages.categories.duplicateName);
});
test("BB-KAT-008 | perangkat tetap tampak sebagai Uncategorized setelah kategori dihapus", async () => {
    api.listDevicesApi.mockResolvedValue({ items: [{ ...devices[0], category_id: null, category_name: null }] });
    render(<DevicesScreen navigation={{ navigate: jest.fn() }} />);
    await screen.findByText("Meter Dapur");
    expect(screen.getByText(`${messages.devices.categoryLabel}: ${messages.devices.uncategorized}`)).toBeTruthy();
    observe("BB-KAT-008", "daftar setelah kategori dihapus", "Meter Dapur tetap tampil dengan kategori Uncategorized pada respons daftar simulasi.");
});

async function deviceForm(manage = false) {
    const navigation = { navigate: jest.fn() };
    render(<DevicesScreen navigation={navigation} />);
    await screen.findByText("Meter Dapur");
    if (manage) {
        fireEvent.press(screen.getByText(messages.devices.manageTab));
        await screen.findByText(messages.devices.addDeviceTitle);
    }
    return navigation;
}
for (const [id, variation, value, placeholder, message] of [
    ["BB-DEV-003", "kode kosong", "", "deviceCodePlaceholder", "minDeviceCodeError"],
    ["BB-DEV-003", "kode dua karakter", "AB", "deviceCodePlaceholder", "minDeviceCodeError"],
    ["BB-DEV-005", "nama kosong", "", "deviceNamePlaceholder", "minDeviceNameError"],
    ["BB-DEV-005", "nama satu karakter", "A", "deviceNamePlaceholder", "minDeviceNameError"],
    ["BB-DEV-008", "lokasi 151 karakter", "A".repeat(151), "locationPlaceholder", "maxLocationError"],
]) {
    test(`${id} | ${variation}`, async () => {
        await deviceForm(true);
        fireEvent.changeText(screen.getByPlaceholderText(messages.devices.deviceCodePlaceholder), "NEW-01");
        fireEvent.changeText(screen.getByPlaceholderText(messages.devices.deviceNamePlaceholder), "Meter Baru");
        fireEvent.changeText(screen.getByPlaceholderText(messages.devices[placeholder]), value);
        fireEvent.press(screen.getByText(messages.devices.createDevice));
        expect(screen.getByText(messages.devices[message])).toBeTruthy();
        expect(api.createDeviceApi).not.toHaveBeenCalled();
        observe(id, variation, messages.devices[message]);
    });
}
test("BB-DEV-002 | perangkat tanpa kategori dan lokasi", async () => {
    await deviceForm(true);
    api.createDeviceApi.mockResolvedValue({ api_token: "synthetic-device-token" });
    fireEvent.changeText(screen.getByPlaceholderText(messages.devices.deviceCodePlaceholder), "NEW-01");
    fireEvent.changeText(screen.getByPlaceholderText(messages.devices.deviceNamePlaceholder), "Meter Baru");
    fireEvent.press(screen.getByText(messages.devices.createDevice));
    await screen.findByText(messages.devices.tokenTitle);
    expect(api.createDeviceApi).toHaveBeenCalledWith(token, { device_code: "NEW-01", device_name: "Meter Baru", install_location: undefined, category_id: null });
    observe("BB-DEV-002", "opsional kosong", "Permintaan memakai category_id null tanpa lokasi; dialog token tampil.");
});
for (const [id, variation, overrides] of [
    ["BB-DEV-004", "kode 3 karakter", { device_code: "ABC" }],
    ["BB-DEV-004", "kode 50 karakter", { device_code: "C".repeat(50) }],
    ["BB-DEV-006", "nama 2 karakter", { device_name: "AB" }],
    ["BB-DEV-006", "nama 100 karakter", { device_name: "N".repeat(100) }],
    ["BB-DEV-007", "lokasi 150 karakter", { install_location: "L".repeat(150) }],
]) {
    test(`${id} | UI menerima ${variation}`, async () => {
        await deviceForm(true);
        api.createDeviceApi.mockResolvedValue({ api_token: "synthetic-device-token" });
        const values = { device_code: "NEW-01", device_name: "Meter Baru", ...overrides };
        fireEvent.changeText(screen.getByPlaceholderText(messages.devices.deviceCodePlaceholder), values.device_code);
        fireEvent.changeText(screen.getByPlaceholderText(messages.devices.deviceNamePlaceholder), values.device_name);
        if (values.install_location) fireEvent.changeText(screen.getByPlaceholderText(messages.devices.locationPlaceholder), values.install_location);
        fireEvent.press(screen.getByText(messages.devices.createDevice));
        await screen.findByText(messages.devices.tokenTitle);
        expect(api.createDeviceApi).toHaveBeenCalledWith(token, expect.objectContaining(values));
        observe(id, variation, "Masukan diteruskan tanpa pemotongan; dialog token tampil setelah respons berhasil.");
    });
}
test("BB-DEV-009 | pesan kode perangkat duplikat pada UI", async () => {
    await deviceForm(true);
    api.createDeviceApi.mockRejectedValue(new Error(messages.devices.duplicateDeviceCodeError));
    fireEvent.changeText(screen.getByPlaceholderText(messages.devices.deviceCodePlaceholder), "TEST-01");
    fireEvent.changeText(screen.getByPlaceholderText(messages.devices.deviceNamePlaceholder), "Meter Baru");
    fireEvent.press(screen.getByText(messages.devices.createDevice));
    expect(await screen.findByText(messages.devices.duplicateDeviceCodeError)).toBeTruthy();
    observe("BB-DEV-009", "kode duplikat", messages.devices.duplicateDeviceCodeError);
});
test("BB-DEV-013 | batal menghapus perangkat", async () => {
    await deviceForm();
    fireEvent.press(screen.getAllByText(messages.devices.deleteButton)[0]);
    fireEvent.press(screen.getByText(messages.devices.confirmNo));
    expect(api.deleteDeviceApi).not.toHaveBeenCalled();
    expect(screen.getByText("Meter Dapur")).toBeTruthy();
    observe("BB-DEV-013", "batal", "Meter Dapur tetap tampil; API delete tidak dipanggil.");
});
test("BB-DEV-016 | filter status online offline dan semua", async () => {
    await deviceForm();
    fireEvent.press(screen.getByRole("button", { name: messages.home.online }));
    expect(screen.getByText("Meter Dapur")).toBeTruthy();
    expect(screen.queryByText("Meter Taman")).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: messages.home.offline }));
    expect(screen.queryByText("Meter Dapur")).toBeNull();
    expect(screen.getByText("Meter Taman")).toBeTruthy();
    expect(screen.getByText("Meter Bebas")).toBeTruthy();
    fireEvent.press(screen.getAllByRole("button", { name: messages.home.all })[0]);
    expect(screen.getByText("Meter Dapur")).toBeTruthy();
    observe("BB-DEV-016", "All/Online/Offline", "Online: hanya Dapur; Offline: Taman dan Bebas; All memulihkan Dapur.");
});
test("BB-DEV-017 | filter Uncategorized", async () => {
    await deviceForm();
    fireEvent.press(screen.getByRole("button", { name: messages.devices.categoryFilterLabel }));
    fireEvent.press(screen.getByRole("button", { name: messages.devices.uncategorized }));
    expect(screen.getByText("Meter Bebas")).toBeTruthy();
    expect(screen.queryByText("Meter Dapur")).toBeNull();
    expect(screen.queryByText("Meter Taman")).toBeNull();
    observe("BB-DEV-017", "Uncategorized", "Hanya Meter Bebas tampil.");
});
test("BB-DEV-018 | kombinasi filter menghasilkan daftar kosong", async () => {
    await deviceForm();
    fireEvent.press(screen.getByRole("button", { name: messages.home.online }));
    fireEvent.press(screen.getByRole("button", { name: messages.devices.categoryFilterLabel }));
    fireEvent.press(screen.getByRole("button", { name: "Taman" }));
    expect(screen.queryByText("Meter Dapur")).toBeNull();
    expect(screen.queryByText("Meter Taman")).toBeNull();
    expect(screen.getByText(messages.devices.noDevicesYet)).toBeTruthy();
    observe("BB-DEV-018", "Online + Taman", messages.devices.noDevicesYet);
});
test("BB-DEV-010 | edit nama lokasi dan kategori", async () => {
    api.updateDeviceApi.mockResolvedValue({});
    render(<DeviceEditScreen route={{ params: { device: { ...devices[0], install_location: "Lokasi Lama" } } }} navigation={{ goBack: jest.fn() }} />);
    await screen.findByRole("button", { name: t("Category") });
    fireEvent.changeText(screen.getByPlaceholderText(t("e.g. Kitchen Faucet")), "Nama Baru");
    fireEvent.changeText(screen.getByPlaceholderText(t("e.g. Building A, 2nd Floor")), "");
    fireEvent.press(screen.getByRole("button", { name: t("Category") }));
    fireEvent.press(screen.getByRole("button", { name: "Taman" }));
    fireEvent.press(screen.getByText(t("Save Changes")));
    await waitFor(() => expect(api.updateDeviceApi).toHaveBeenCalledWith(token, 1, { device_name: "Nama Baru", install_location: null, category_id: 20 }));
    expect(await screen.findByText(t("Device updated successfully"))).toBeTruthy();
    observe("BB-DEV-010", "edit", "Pesan berhasil tampil; nama baru, lokasi null, kategori 20 dikirim.");
});
test("BB-DEV-011 | ubah kategori menjadi Uncategorized", async () => {
    api.updateDeviceApi.mockResolvedValue({});
    render(<DeviceEditScreen route={{ params: { device: devices[0] } }} navigation={{ goBack: jest.fn() }} />);
    await screen.findByRole("button", { name: t("Category") });
    fireEvent.press(screen.getByRole("button", { name: t("Category") }));
    fireEvent.press(screen.getByRole("button", { name: t("Uncategorized") }));
    fireEvent.press(screen.getByText(t("Save Changes")));
    await waitFor(() => expect(api.updateDeviceApi).toHaveBeenCalledWith(token, 1, expect.objectContaining({ category_id: null })));
    observe("BB-DEV-011", "Uncategorized", "Penyimpanan menggunakan category_id null.");
});
test("BB-PRO-001 | identitas pada Profil", () => {
    render(<ProfileScreen />);
    expect(screen.getByText("Pengguna Uji")).toBeTruthy();
    expect(screen.getByText("uji@example.test")).toBeTruthy();
    observe("BB-PRO-001", "identitas", "Pengguna Uji dan uji@example.test tampil.");
});

for (const value of [0.5, 10]) {
    test(`BB-BIL-001 | simpan harga ${value} pada UI`, async () => {
        api.billingSettingsApi.mockResolvedValue({ price_per_liter: null });
        api.upsertBillingSettingsApi.mockResolvedValue({ price_per_liter: value, currency: "IDR" });
        render(<BillingSettingsScreen />);
        const input = await screen.findByPlaceholderText(messages.billingSettings.placeholder);
        fireEvent.changeText(input, String(value));
        fireEvent.press(screen.getByText(messages.billingSettings.save));
        expect(await screen.findByText(messages.billingSettings.saveSuccess)).toBeTruthy();
        expect(api.upsertBillingSettingsApi).toHaveBeenCalledWith(token, { price_per_liter: value, currency: "IDR" });
        observe("BB-BIL-001", `harga ${value}`, messages.billingSettings.saveSuccess);
    });
}
for (const value of ["", "0", "-1", "abc"]) {
    test(`BB-BIL-002 | pesan penolakan harga ${value || "kosong"}`, async () => {
        api.billingSettingsApi.mockResolvedValue({ price_per_liter: null });
        api.upsertBillingSettingsApi.mockRejectedValue(new Error(t("invalidInput")));
        render(<BillingSettingsScreen />);
        fireEvent.changeText(await screen.findByPlaceholderText(messages.billingSettings.placeholder), value);
        fireEvent.press(screen.getByText(messages.billingSettings.save));
        expect(await screen.findByText(t("invalidInput"))).toBeTruthy();
        expect(screen.queryByText(messages.billingSettings.saveSuccess)).toBeNull();
        observe("BB-BIL-002", value || "kosong", t("invalidInput"));
    });
}

for (const [variation, email, password] of [["email kosong", "", "validpass"], ["format email salah", "invalid", "validpass"], ["password kosong", "uji@example.test", ""]]) {
    test(`BB-AUT-003 | UI menampilkan penolakan ${variation}`, async () => {
        const login = jest.fn().mockRejectedValue(new Error(t("invalidInput")));
        auth({ login });
        render(<LoginScreen navigation={{ navigate: jest.fn() }} route={{}} />);
        fireEvent.changeText(screen.getByPlaceholderText(messages.auth.emailPlaceholder), email);
        fireEvent.changeText(screen.getByPlaceholderText(messages.auth.passwordPlaceholder), password);
        fireEvent.press(screen.getByText(messages.auth.loginButton));
        expect(await screen.findByText(t("invalidInput"))).toBeTruthy();
        observe("BB-AUT-003", variation, t("invalidInput"));
    });
}
