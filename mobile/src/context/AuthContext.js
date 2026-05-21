import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { clearAccessToken, getAccessToken, saveAccessToken } from "../services/storage";
import { loginApi, meApi, registerApi } from "../services/api";
import messages from "../constants/messages";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isBooting, setIsBooting] = useState(true);
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    async function restore() {
      try {
        const storedToken = await getAccessToken();
        if (!storedToken) return;

        const currentUser = await meApi(storedToken);
        setToken(storedToken);
        setUser(currentUser);
      } catch {
        await clearAccessToken();
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
    const result = await registerApi({ full_name: fullName, email, password });
    await saveAccessToken(result.access_token);
    setToken(result.access_token);
    setUser(result.user);
  }

  async function logout() {
    await clearAccessToken();
    setToken(null);
    setUser(null);
  }

  const value = useMemo(
    () => ({
      isBooting,
      isAuthenticated: Boolean(token),
      token,
      user,
      login,
      register,
      logout,
    }),
    [isBooting, token, user]
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
