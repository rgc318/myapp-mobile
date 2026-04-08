import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import {
  getAppPreferences,
  getDefaultPreferences,
  getStoredAppPreferences,
  replaceAppPreferences,
  setAppPreferences,
  type AppPreferences,
} from '@/lib/app-preferences';
import {
  loadStoredAuthMode,
  loadStoredToken,
  loadStoredUsername,
  saveStoredAuthMode,
  saveStoredCsrfToken,
  saveStoredToken,
  saveStoredUsername,
} from '@/lib/auth-storage';
import { getLoggedUser, loginWithPassword, logoutFromSession, type AuthMode } from '@/services/auth';
import {
  getCurrentUserProfile,
  getCurrentUserRoles,
  getCurrentUserWorkspacePreferences,
  updateCurrentUserWorkspacePreferences,
  type UserProfile,
} from '@/services/user';

type AuthContextValue = {
  isReady: boolean;
  isAuthenticated: boolean;
  username: string | null;
  authMode: AuthMode;
  profile: UserProfile | null;
  roles: string[];
  workspacePreferences: AppPreferences;
  signIn: (params: { username: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  saveWorkspacePreferences: (next: Partial<AppPreferences>) => Promise<AppPreferences>;
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
  const [workspacePreferences, setWorkspacePreferences] = useState<AppPreferences>(() => getAppPreferences());

  const resolveWorkspacePreferences = useCallback(
    async (currentUser: string | null, token?: string | null) => {
      if (!currentUser) {
        const next = getAppPreferences({ owner: null });
        setWorkspacePreferences(next);
        return next;
      }

      const remotePreferences = await getCurrentUserWorkspacePreferences(token);
      const storedPreferences = getStoredAppPreferences({ owner: currentUser });
      const fallbackDefaults = getDefaultPreferences();
      const resolved = {
        defaultCompany:
          remotePreferences.defaultCompany || storedPreferences?.defaultCompany || fallbackDefaults.defaultCompany,
        defaultWarehouse:
          remotePreferences.defaultWarehouse || storedPreferences?.defaultWarehouse || fallbackDefaults.defaultWarehouse,
      } satisfies AppPreferences;

      replaceAppPreferences(resolved, { owner: currentUser });
      setWorkspacePreferences(resolved);

      const shouldMigrateStoredPreferences =
        Boolean(storedPreferences) &&
        (!remotePreferences.defaultCompany || !remotePreferences.defaultWarehouse);

      if (shouldMigrateStoredPreferences) {
        try {
          const migrated = await updateCurrentUserWorkspacePreferences(resolved, token);
          replaceAppPreferences(migrated, { owner: currentUser });
          setWorkspacePreferences(migrated);
          return migrated;
        } catch {
          return resolved;
        }
      }

      return resolved;
    },
    [],
  );

  const refreshSession = useCallback(async () => {
    const currentUser = await getLoggedUser(authToken);
    const [currentProfile, currentRoles] = currentUser
      ? await Promise.all([
          getCurrentUserProfile(currentUser, authToken),
          getCurrentUserRoles(authToken),
        ])
      : [null, []];

    setUsername(currentUser);
    setProfile(currentProfile);
    setRoles(currentRoles);
    await resolveWorkspacePreferences(currentUser, authToken);
    saveStoredUsername(currentUser);
    if (!currentUser) {
      setAuthToken(null);
      saveStoredToken(null);
      saveStoredCsrfToken(null);
      setAuthMode('session');
      saveStoredAuthMode('session');
      setProfile(null);
      setRoles([]);
      setWorkspacePreferences(getAppPreferences({ owner: null }));
    }
  }, [authToken, resolveWorkspacePreferences]);

  const saveWorkspacePreferences = useCallback(
    async (next: Partial<AppPreferences>) => {
      if (!username) {
        const saved = setAppPreferences(next, { owner: null });
        setWorkspacePreferences(saved);
        return saved;
      }

      const saved = await updateCurrentUserWorkspacePreferences(
        {
          defaultCompany: next.defaultCompany,
          defaultWarehouse: next.defaultWarehouse,
        },
        authToken,
      );
      replaceAppPreferences(saved, { owner: username });
      setWorkspacePreferences(saved);
      return saved;
    },
    [authToken, username],
  );

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
      const nextPreferences = await resolveWorkspacePreferences(currentUser, authToken);
      if (!cancelled) {
        setUsername(currentUser);
        setProfile(currentProfile);
        setRoles(currentRoles);
        setWorkspacePreferences(nextPreferences);
        saveStoredUsername(currentUser);
        if (!currentUser) {
          setAuthToken(null);
          saveStoredToken(null);
          saveStoredCsrfToken(null);
          setAuthMode('session');
          saveStoredAuthMode('session');
          setProfile(null);
          setRoles([]);
          setWorkspacePreferences(getAppPreferences({ owner: null }));
        }
        setIsReady(true);
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [authToken, resolveWorkspacePreferences]);

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
    const nextPreferences = await resolveWorkspacePreferences(currentUser, result.token);
    setUsername(currentUser);
    setProfile(currentProfile);
    setRoles(currentRoles);
    setWorkspacePreferences(nextPreferences);
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
    saveStoredCsrfToken(null);
    setAuthMode('session');
    saveStoredAuthMode('session');
    setWorkspacePreferences(getAppPreferences({ owner: null }));
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
        workspacePreferences,
        signIn,
        signOut,
        refreshSession,
        saveWorkspacePreferences,
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
