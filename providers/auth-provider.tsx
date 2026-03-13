import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import {
  loadStoredAuthMode,
  loadStoredToken,
  loadStoredUsername,
  saveStoredAuthMode,
  saveStoredToken,
  saveStoredUsername,
} from '@/lib/auth-storage';
import { getLoggedUser, loginWithPassword, logoutFromSession, type AuthMode } from '@/services/auth';

type AuthContextValue = {
  isReady: boolean;
  isAuthenticated: boolean;
  username: string | null;
  authMode: AuthMode;
  signIn: (params: { username: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [username, setUsername] = useState<string | null>(() => loadStoredUsername());
  const [authMode, setAuthMode] = useState<AuthMode>(() => {
    const storedMode = loadStoredAuthMode();
    return storedMode === 'token' ? 'token' : 'session';
  });
  const [authToken, setAuthToken] = useState<string | null>(() => loadStoredToken());

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const currentUser = await getLoggedUser(authToken);
      if (!cancelled) {
        setUsername(currentUser);
        saveStoredUsername(currentUser);
        if (!currentUser) {
          setAuthToken(null);
          saveStoredToken(null);
          setAuthMode('session');
          saveStoredAuthMode('session');
        }
        setIsReady(true);
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [authToken]);

  const signIn = async ({ username, password }: { username: string; password: string }) => {
    const result = await loginWithPassword({ username, password });
    setAuthMode(result.mode);
    saveStoredAuthMode(result.mode);
    setAuthToken(result.token);
    saveStoredToken(result.token);
    const currentUser = (await getLoggedUser(result.token)) || username;
    setUsername(currentUser);
    saveStoredUsername(currentUser);
  };

  const signOut = async () => {
    await logoutFromSession(authToken);
    setUsername(null);
    saveStoredUsername(null);
    setAuthToken(null);
    saveStoredToken(null);
    setAuthMode('session');
    saveStoredAuthMode('session');
  };

  return (
    <AuthContext.Provider
      value={{
        isReady,
        isAuthenticated: Boolean(username),
        username,
        authMode,
        signIn,
        signOut,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return context;
}
