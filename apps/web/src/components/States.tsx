import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { ApiClientError } from '../lib/api';

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-slate-500" role="status">
      <Loader2 className="size-4 animate-spin" aria-hidden /> {label}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  const requestId = error instanceof ApiClientError ? error.requestId : undefined;
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">
      <div className="flex items-center gap-2 font-medium">
        <AlertTriangle className="size-4" aria-hidden /> {message}
      </div>
      {requestId && <p className="mt-1 text-xs text-red-700">Request ID: {requestId}</p>}
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-3 rounded-md bg-white px-3 py-1 text-xs font-medium ring-1 ring-red-200">
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
      <Inbox className="mx-auto mb-2 size-6" aria-hidden />
      <p className="font-medium text-slate-700">{title}</p>
      {children}
    </div>
  );
}

export function Card({ title, children, aside }: { title?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {(title || aside) && (
        <div className="mb-4 flex items-center justify-between gap-4">
          {title && <h2 className="text-sm font-semibold text-navy">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{children}</dd>
    </div>
  );
}
