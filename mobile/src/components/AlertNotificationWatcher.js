import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../services/i18n";
import { startPushSession, endPushSession, syncPushRegistration } from "../services/pushNotifications";

Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export default function AlertNotificationWatcher() {
    const locale = useLocale();
    const { token, isAuthenticated, isSigningOut } = useAuth();
    useEffect(() => {
        if (Platform.OS !== "android" || !isAuthenticated || !token || isSigningOut) return;
        startPushSession(token);
        const sync = (requestPermission = false) => {
            syncPushRegistration(token, locale, { requestPermission }).catch(() => {
                console.warn("Push registration unavailable; retry when the app resumes.");
            });
        };
        sync(true);
        const appState = AppState.addEventListener("change", state => { if (state === "active") sync(); });
        const tokenListener = Notifications.addPushTokenListener(() => sync());
        return () => { endPushSession(token); appState.remove(); tokenListener.remove(); };
    }, [isAuthenticated, token, locale, isSigningOut]);
    return null;
}
