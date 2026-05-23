import AsyncStorage from "@react-native-async-storage/async-storage";

const ACCESS_TOKEN_KEY = "wm_access_token";
const APP_LOCALE_KEY = "wm_app_locale";

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
