import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { registerPushTokenApi, unregisterPushTokenApi } from "./api";
import { getPushToken, savePushToken, clearPushToken } from "./storage";
import { t } from "./i18n";

export const USAGE_CHANNEL_ID = "usage-alerts";
let activeAuthToken = null;
let generation = 0;
let work = Promise.resolve();

function enqueue(operation) {
    const next = work.then(operation, operation);
    work = next.catch(() => {});
    return next;
}

export function startPushSession(authToken) { activeAuthToken = authToken; generation++; }
export function endPushSession(authToken) {
    if (activeAuthToken === authToken) { activeAuthToken = null; generation++; }
}

export function syncPushRegistration(authToken, locale, { requestPermission = false } = {}) {
    const version = generation;
    const isCurrent = () => activeAuthToken === authToken && generation === version;
    return enqueue(async () => {
        if (Platform.OS !== "android" || !isCurrent()) return;
        await Notifications.setNotificationChannelAsync(USAGE_CHANNEL_ID, {
            name: t("Usage Alerts", {}, locale), importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250], lightColor: "#0f62fe",
        });
        let permission = await Notifications.getPermissionsAsync();
        if (!permission.granted && requestPermission && permission.canAskAgain !== false) {
            permission = await Notifications.requestPermissionsAsync();
        }
        if (!isCurrent()) return;
        if (!permission.granted) {
            const previous = await getPushToken();
            if (previous) { await unregisterPushTokenApi(authToken, previous); await clearPushToken(); }
            return;
        }
        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
        if (!projectId) throw new Error("PUSH_PROJECT_MISSING");
        const pushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        if (!isCurrent()) return;
        // Save before the request: logout can revoke even if its response gets lost.
        await savePushToken(pushToken);
        if (!isCurrent()) return;
        await registerPushTokenApi(authToken, pushToken, locale);
    });
}

export function unregisterCurrentPush(authToken) {
    endPushSession(authToken);
    return enqueue(async () => {
        const token = await getPushToken();
        if (!token) return;
        try {
            await unregisterPushTokenApi(authToken, token);
            await clearPushToken();
        } catch (error) {
            if (error.status === 401 || error.status === 404 || error.code === "PUSH_NOT_READY") {
                await clearPushToken(); return;
            }
            activeAuthToken = authToken;
            throw error;
        }
    });
}
