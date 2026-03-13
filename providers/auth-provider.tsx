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
import { getCurrentUserProfile, getCurrentUserRoles, type UserProfile } from '@/services/user';

type AuthContextValue = {
  isReady: boolean;
  isAuthenticated: boolean;
  username: string | null;
  authMode: AuthMode;
  profile: UserProfile | null;
  roles: string[];
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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const currentUser = await getLoggedUser(authToken);
      const [currentProfile, currentRoles] = currentUser
        ? await Promise.all([
            getCurrentUserProfile(currentUser, authToken),
            getCurrentUserRoles(authToken),
          ])
        : [null, []];

      if (!cancelled) {
        setUsername(currentUser);
        setProfile(currentProfile);
        setRoles(currentRoles);
        saveStoredUsername(currentUser);
        if (!currentUser) {
          setAuthToken(null);
          saveStoredToken(null);
          setAuthMode('session');
          saveStoredAuthMode('session');
          setProfile(null);
          setRoles([]);
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
    const [currentProfile, currentRoles] = await Promise.all([
      getCurrentUserProfile(currentUser, result.token),
      getCurrentUserRoles(result.token),
    ]);
    setUsername(currentUser);
    setProfile(currentProfile);
    setRoles(currentRoles);
    saveStoredUsername(currentUser);
  };

  const signOut = async () => {
    await logoutFromSession(authToken);
    setUsername(null);
    setProfile(null);
    setRoles([]);
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
        profile,
        roles,
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
