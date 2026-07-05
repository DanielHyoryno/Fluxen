import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useAuth } from "../context/AuthContext";
import { usageAlertsAllApi } from "../services/api";
import { getNotifiedAlertIds, saveNotifiedAlertIds } from "../services/storage";

const POLL_INTERVAL_MS = 15000;
const MAX_TRACKED_ALERT_IDS = 200;
const CHANNEL_ID = "usage-alerts";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function trimIds(ids) {
  return ids.slice(-MAX_TRACKED_ALERT_IDS);
}

export default function AlertNotificationWatcher() {
  const { token, isAuthenticated } = useAuth();
  const notifiedIdsRef = useRef(new Set());
  const initializedRef = useRef(false);
  const bootstrapReadyRef = useRef(false);
  const intervalRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const permissionReadyRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      initializedRef.current = false;
      bootstrapReadyRef.current = false;
      permissionReadyRef.current = false;
      notifiedIdsRef.current = new Set();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    let mounted = true;

    async function setupNotifications() {
      if (Platform.OS !== "android") {
        permissionReadyRef.current = true;
        return;
      }

      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: "Usage Alerts",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#0f62fe",
      });

      const permission = await Notifications.getPermissionsAsync();
      if (!permission.granted) {
        const requested = await Notifications.requestPermissionsAsync();
        permissionReadyRef.current = Boolean(requested.granted);
      } else {
        permissionReadyRef.current = true;
      }
    }

    async function bootstrapSeenIds() {
      const saved = await getNotifiedAlertIds();
      if (!mounted) return;
      notifiedIdsRef.current = new Set(saved.map((id) => Number(id)).filter((id) => Number.isFinite(id)));
      bootstrapReadyRef.current = true;
    }

    async function pollAlerts() {
      if (Platform.OS !== "android") return;
      if (!bootstrapReadyRef.current) return;
      if (!permissionReadyRef.current) return;

      try {
        const data = await usageAlertsAllApi(token, "active", 50);
        const items = Array.isArray(data?.items) ? data.items : [];
        const currentIds = items.map((item) => Number(item.id)).filter((id) => Number.isFinite(id));

        if (!initializedRef.current) {
          notifiedIdsRef.current = new Set(currentIds);
          initializedRef.current = true;
          await saveNotifiedAlertIds(trimIds(currentIds));
          return;
        }

        const newAlerts = items.filter((item) => !notifiedIdsRef.current.has(Number(item.id)));

        for (const alert of newAlerts) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: alert.title || "Usage alert",
              body: alert.message || `${alert.device_name || alert.device_code || "Device"} has a new usage alert`,
              data: {
                alertId: alert.id,
                deviceCode: alert.device_code,
                alertType: alert.alert_type,
              },
              sound: true,
            },
            trigger: null,
          });

          notifiedIdsRef.current.add(Number(alert.id));
        }

        const nextIds = trimIds(Array.from(new Set([...Array.from(notifiedIdsRef.current), ...currentIds])));
        notifiedIdsRef.current = new Set(nextIds);
        await saveNotifiedAlertIds(nextIds);
      } catch {
        // silent by design: polling should not break the app shell
      }
    }

    Promise.all([setupNotifications(), bootstrapSeenIds()])
      .then(() => {
        if (!mounted) return;
        pollAlerts();
        intervalRef.current = setInterval(pollAlerts, POLL_INTERVAL_MS);
      })
      .catch(() => {});

    const sub = AppState.addEventListener("change", (nextState) => {
      const wasBackground = /inactive|background/.test(appStateRef.current);
      appStateRef.current = nextState;
      if (wasBackground && nextState === "active") {
        pollAlerts();
      }
    });

    return () => {
      mounted = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      sub.remove();
    };
  }, [isAuthenticated, token]);

  return null;
}
