import { Platform } from "react-native";

const isDev = typeof __DEV__ !== "undefined" ? __DEV__ : process.env.NODE_ENV !== "production";

const MOBILE_API_BASE_URL =
    process.env.EXPO_PUBLIC_API_BASE_URL_MOBILE ||
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    (isDev ? "http://192.168.1.9:8080/api/v1" : "");

const WEB_API_BASE_URL_FROM_ENV =
    process.env.EXPO_PUBLIC_API_BASE_URL_WEB || process.env.EXPO_PUBLIC_API_BASE_URL || "";

const WEB_HOST =
    typeof window !== "undefined" && window.location && window.location.hostname
        ? window.location.hostname
        : "localhost";

const WEB_API_BASE_URL = WEB_API_BASE_URL_FROM_ENV || (isDev ? `http://${WEB_HOST}:8080/api/v1` : "");

export const API_BASE_URL = Platform.OS === "web" ? WEB_API_BASE_URL : MOBILE_API_BASE_URL;

if (!API_BASE_URL) {
    throw new Error("API_BASE_URL is missing. Set EXPO_PUBLIC_API_BASE_URL (or platform-specific vars).");
}
