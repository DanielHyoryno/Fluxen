import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { clearAccessToken, getAccessToken, getAppLocale, saveAccessToken, saveAppLocale } from "../services/storage";
import { loginApi, meApi, registerApi } from "../services/api";
import messages, { DEFAULT_LOCALE, getMessages } from "../constants/messages";
import { setLanguage } from "../services/i18n";
import { unregisterCurrentPush } from "../services/pushNotifications";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [isBooting, setIsBooting] = useState(true);
    const [token, setToken] = useState(null);
    const [user, setUser] = useState(null);
    const [locale, setLocale] = useState(DEFAULT_LOCALE);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const logoutRequest = useRef(null);

    useEffect(() => {
        async function restore() {
            let storedToken = null;
            try {
                const storedLocale = await getAppLocale();
                if (storedLocale) {
                    setLanguage(storedLocale);
                    setLocale(storedLocale);
                }

                storedToken = await getAccessToken();
                if (!storedToken) return;

                const currentUser = await meApi(storedToken);
                setToken(storedToken);
                setUser(currentUser);
            } catch (error) {
                // A network outage must not masquerade as logout while push is still subscribed.
                if (error.status === 401) await clearAccessToken();
                else if (storedToken) setToken(storedToken);
            } finally {
                setIsBooting(false);
            }
        }

        restore();
    }, []);

    async function login(email, password) {
        const result = await loginApi({ email, password });
        await saveAccessToken(result.access_token);
        setToken(result.access_token);
        setUser(result.user);
    }

    async function register(fullName, email, password) {
        return registerApi({ full_name: fullName, email, password });
    }

    function logout() {
        if (logoutRequest.current) return logoutRequest.current;
        setIsSigningOut(true);
        logoutRequest.current = (async () => {
            // Do not report logout as successful while this phone remains subscribed.
            if (token) await unregisterCurrentPush(token);
            await clearAccessToken();
            setToken(null);
            setUser(null);
        })().finally(() => { logoutRequest.current = null; setIsSigningOut(false); });
        return logoutRequest.current;
    }

    async function changeLocale(nextLocale) {
        await saveAppLocale(nextLocale);
        setLanguage(nextLocale);
        setLocale(nextLocale);
    }

    const activeMessages = useMemo(() => getMessages(locale), [locale]);

    const value = useMemo(
        () => ({
            isBooting,
            isAuthenticated: Boolean(token),
            isSigningOut,
            token,
            user,
            locale,
            messages: activeMessages,
            login,
            register,
            logout,
            setLocale: changeLocale,
        }),
        [activeMessages, isBooting, isSigningOut, locale, token, user]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error(messages.auth.authProviderError);
    }
    return ctx;
}
