import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { listDevicesApi } from "../services/api";

// Re-fetch ownership before opening a notification, including cold-start responses.
export default function NotificationNavigation({ navigationRef, token, ready }) {
    const handled = useRef(new Set());
    useEffect(() => {
        if (!token || !ready) return;
        let mounted = true;
        async function open(response) {
            const request = response?.notification?.request;
            const code = request?.content?.data?.deviceCode;
            if (typeof code !== "string" || code.length > 50 || handled.current.has(request.identifier)) return;
            handled.current.add(request.identifier);
            try {
                const data = await listDevicesApi(token);
                const device = data?.items?.find(item => item.device_code === code);
                if (mounted && device && navigationRef.current?.isReady()) navigationRef.current.navigate("DeviceDashboard", { device });
            } catch { handled.current.delete(request.identifier); }
        }
        Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
        const listener = Notifications.addNotificationResponseReceivedListener(open);
        return () => { mounted = false; listener.remove(); };
    }, [navigationRef, token, ready]);
    return null;
}
