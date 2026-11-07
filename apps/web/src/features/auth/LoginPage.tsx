import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Card, ErrorState } from '../../components/States';
import { useAuth } from '../../lib/auth';
import { getSupabase } from '../../lib/supabase';

const DEMO_ACCOUNTS = [
  ['Field volunteer', 'fieldworker@demo.reliefmesh.test'],
  ['NGO reviewer', 'reviewer@demo.reliefmesh.test'],
  ['Donor', 'donor@demo.reliefmesh.test'],
  ['Supplier', 'supplier@demo.reliefmesh.test'],
] as const;

export function LoginPage() {
  const { session } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<Error | null>(null);
  const [pending, setPending] = useState(false);

  if (session) return <Navigate to="/app/overview" replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const { error: signInError } = await getSupabase().auth.signInWithPassword({ email, password });
    if (signInError) setError(new Error(signInError.message));
    setPending(false);
  }

  return (
    <div className="mx-auto mt-16 w-full max-w-md px-6">
      <h1 className="mb-1 text-2xl font-semibold text-navy">ReliefMesh</h1>
      <p className="mb-6 text-sm text-slate-600">Sign in with a synthetic demo account.</p>
      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm">
            <span className="font-medium">Email</span>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          {error && <ErrorState error={error} />}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-navy px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </Card>
      <div className="mt-6 text-xs text-slate-500">
        <p className="mb-1 font-medium">Demo accounts (password set by the demo seed):</p>
        <ul className="space-y-0.5">
          {DEMO_ACCOUNTS.map(([role, address]) => (
            <li key={address}>
              <button type="button" className="underline" onClick={() => setEmail(address)}>
                {address}
              </button>{' '}
              — {role}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
