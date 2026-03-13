import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { loadStoredUsername, saveStoredUsername } from '@/lib/auth-storage';
import { getLoggedUser, loginWithPassword, logoutFromSession } from '@/services/auth';

type AuthContextValue = {
  isReady: boolean;
  isAuthenticated: boolean;
  username: string | null;
  signIn: (params: { username: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [username, setUsername] = useState<string | null>(() => loadStoredUsername());

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const currentUser = await getLoggedUser();
      if (!cancelled) {
        setUsername(currentUser);
        saveStoredUsername(currentUser);
        setIsReady(true);
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = async ({ username, password }: { username: string; password: string }) => {
    await loginWithPassword({ username, password });
    const currentUser = (await getLoggedUser()) || username;
    setUsername(currentUser);
    saveStoredUsername(currentUser);
  };

  const signOut = async () => {
    await logoutFromSession();
    setUsername(null);
    saveStoredUsername(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isReady,
        isAuthenticated: Boolean(username),
        username,
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
