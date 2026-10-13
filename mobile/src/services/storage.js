import AsyncStorage from "@react-native-async-storage/async-storage";

const ACCESS_TOKEN_KEY = "wm_access_token";
const APP_LOCALE_KEY = "wm_app_locale";
const NOTIFIED_ALERT_IDS_KEY = "wm_notified_alert_ids";
const DEVICE_TUTORIAL_SEEN_KEY = "wm_device_tutorial_seen_v1";

export async function getDeviceTutorialSeen() {
    return (await AsyncStorage.getItem(DEVICE_TUTORIAL_SEEN_KEY)) === "true";
}

export async function saveDeviceTutorialSeen() {
    await AsyncStorage.setItem(DEVICE_TUTORIAL_SEEN_KEY, "true");
}

export async function saveAccessToken(token) {
    await AsyncStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export async function getAccessToken() {
    return AsyncStorage.getItem(ACCESS_TOKEN_KEY);
}

export async function clearAccessToken() {
    await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
}

export async function saveAppLocale(locale) {
    await AsyncStorage.setItem(APP_LOCALE_KEY, locale);
}

export async function getAppLocale() {
    return AsyncStorage.getItem(APP_LOCALE_KEY);
}

export async function saveNotifiedAlertIds(ids) {
    await AsyncStorage.setItem(NOTIFIED_ALERT_IDS_KEY, JSON.stringify(ids));
}

export async function getNotifiedAlertIds() {
    const raw = await AsyncStorage.getItem(NOTIFIED_ALERT_IDS_KEY);
    if (!raw) return [];

    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}
