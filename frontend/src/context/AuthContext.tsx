import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { logoutOnServer, refreshTokens, register as registerApi, login as loginApi, type TokenPairResponse } from "../api/auth";

const STORAGE = {
  access: "access_token",
  refresh: "refresh_token",
  email: "user_email",
} as const;

type AuthContextValue = {
  email: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const accessRef = useRef<string | null>(null);
  const refreshRef = useRef<string | null>(null);
  const refreshMutex = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    const a = localStorage.getItem(STORAGE.access);
    const r = localStorage.getItem(STORAGE.refresh);
    const e = localStorage.getItem(STORAGE.email);
    accessRef.current = a;
    refreshRef.current = r;
    setAccessToken(a);
    setEmail(e);
    setHydrated(true);
  }, []);

  const persist = useCallback((tokens: TokenPairResponse, em: string) => {
    localStorage.setItem(STORAGE.access, tokens.access_token);
    localStorage.setItem(STORAGE.refresh, tokens.refresh_token);
    localStorage.setItem(STORAGE.email, em);
    accessRef.current = tokens.access_token;
    refreshRef.current = tokens.refresh_token;
    setAccessToken(tokens.access_token);
    setEmail(em);
  }, []);

  const persistTokensOnly = useCallback((tokens: TokenPairResponse) => {
    localStorage.setItem(STORAGE.access, tokens.access_token);
    localStorage.setItem(STORAGE.refresh, tokens.refresh_token);
    accessRef.current = tokens.access_token;
    refreshRef.current = tokens.refresh_token;
    setAccessToken(tokens.access_token);
  }, []);

  const logout = useCallback(() => {
    const rt = refreshRef.current ?? localStorage.getItem(STORAGE.refresh);
    if (rt) void logoutOnServer(rt).catch(() => {});
    localStorage.removeItem(STORAGE.access);
    localStorage.removeItem(STORAGE.refresh);
    localStorage.removeItem(STORAGE.email);
    accessRef.current = null;
    refreshRef.current = null;
    setAccessToken(null);
    setEmail(null);
  }, []);

  const refreshOnce = useCallback(async (): Promise<boolean> => {
    if (refreshMutex.current) return refreshMutex.current;
    refreshMutex.current = (async () => {
      try {
        const rt = refreshRef.current ?? localStorage.getItem(STORAGE.refresh);
        if (!rt) return false;
        const data = await refreshTokens(rt);
        persistTokensOnly(data);
        return true;
      } catch {
        logout();
        return false;
      }
    })().finally(() => {
      refreshMutex.current = null;
    });
    return refreshMutex.current;
  }, [persistTokensOnly, logout]);

  const authFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : String(input);
      const headers = new Headers(init?.headers);
      const access = accessRef.current ?? localStorage.getItem(STORAGE.access);
      if (access) headers.set("Authorization", `Bearer ${access}`);

      let res = await fetch(url, { ...init, headers });
      const hasRefresh = refreshRef.current ?? localStorage.getItem(STORAGE.refresh);
      if (res.status === 401 && hasRefresh) {
        const ok = await refreshOnce();
        if (ok) {
          const h2 = new Headers(init?.headers);
          const newAccess = accessRef.current ?? localStorage.getItem(STORAGE.access);
          if (newAccess) h2.set("Authorization", `Bearer ${newAccess}`);
          res = await fetch(url, { ...init, headers: h2 });
        }
      }
      return res;
    },
    [refreshOnce],
  );

  const login = useCallback(
    async (em: string, password: string) => {
      const tokens = await loginApi(em, password);
      persist(tokens, em.trim());
    },
    [persist],
  );

  const register = useCallback(
    async (em: string, password: string) => {
      const tokens = await registerApi(em, password);
      persist(tokens, em.trim());
    },
    [persist],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      email,
      isAuthenticated: Boolean(accessToken),
      isHydrated: hydrated,
      login,
      register,
      logout,
      authFetch,
    }),
    [email, accessToken, hydrated, login, register, logout, authFetch],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
