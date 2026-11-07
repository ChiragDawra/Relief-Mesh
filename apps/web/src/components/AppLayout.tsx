import { LogOut } from 'lucide-react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import type { Role } from '@reliefmesh/shared';
import { hasRole, useAuth } from '../lib/auth';
import { ROLE_LABELS } from '../lib/format';
import { ErrorState, Loading } from './States';

interface NavItem {
  to: string;
  label: string;
  roles?: readonly Role[];
}

const NAV: NavItem[] = [
  { to: '/app/overview', label: 'Overview' },
  { to: '/app/cases', label: 'Cases' },
  { to: '/app/cases/new', label: 'New request', roles: ['field_worker', 'admin'] },
  { to: '/app/review', label: 'Review queue', roles: ['ngo_reviewer', 'admin'] },
];

/** Authenticated shell. Navigation is role-aware for convenience; the API enforces access. */
export function AppLayout() {
  const { session, sessionLoading, me, meError, signOut } = useAuth();

  if (sessionLoading) return <Loading label="Checking session…" />;
  if (!session) return <Navigate to="/login" replace />;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-6">
          <span className="text-lg font-semibold text-navy">ReliefMesh</span>
          <nav className="flex gap-1 text-sm">
            {NAV.filter((item) => !item.roles || hasRole(me, item.roles)).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 ${isActive ? 'bg-navy text-white' : 'text-slate-600 hover:bg-slate-100'}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span>
            {me?.profile?.display_name ?? session.user.email}
            {me && ` · ${[...new Set(me.memberships.map((m) => ROLE_LABELS[m.role]))].join(', ')}`}
          </span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-slate-100"
          >
            <LogOut className="size-4" aria-hidden /> Sign out
          </button>
        </div>
      </header>
      {meError ? <ErrorState error={meError} /> : me ? <Outlet /> : <Loading label="Loading your roles…" />}
    </div>
  );
}
