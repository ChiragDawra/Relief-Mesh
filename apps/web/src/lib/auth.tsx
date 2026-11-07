import type { Session } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { MeResponse, Membership, Role } from '@reliefmesh/shared';
import { apiFetch } from './api';
import { getSupabase } from './supabase';

interface AuthState {
  session: Session | null;
  sessionLoading: boolean;
  me: MeResponse | undefined;
  meError: Error | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  // Roles come from the API's verified membership lookup, never from token claims.
  const me = useQuery({
    queryKey: ['me', session?.user.id],
    queryFn: () => apiFetch<MeResponse>('/me'),
    enabled: Boolean(session),
  });

  const value: AuthState = {
    session,
    sessionLoading,
    me: me.data,
    meError: me.error,
    signOut: async () => {
      await getSupabase().auth.signOut();
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** UI convenience only; the API enforces every permission server-side. */
export function membershipsWithRole(me: MeResponse | undefined, roles: readonly Role[]): Membership[] {
  return me?.memberships.filter((m) => roles.includes(m.role)) ?? [];
}

export function hasRole(me: MeResponse | undefined, roles: readonly Role[], organizationId?: string | null): boolean {
  return membershipsWithRole(me, roles).some((m) => !organizationId || m.organization_id === organizationId);
}
