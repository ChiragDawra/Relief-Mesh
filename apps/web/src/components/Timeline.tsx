import { ExternalLink, Link2, Sparkles, UserRound } from 'lucide-react';
import type { ActorKind, PublicTimelineEntry, TimelineEntry } from '@reliefmesh/shared';
import { explorerTxUrl, formatDateTime, humanize, ROLE_LABELS } from '../lib/format';

const KIND: Record<ActorKind, { icon: typeof UserRound; label: string; tone: string }> = {
  human: { icon: UserRound, label: 'Human action', tone: 'bg-slate-100 text-slate-700' },
  ai: { icon: Sparkles, label: 'AI-assisted suggestion', tone: 'bg-violet-100 text-violet-800' },
  chain: { icon: Link2, label: 'Devnet confirmation', tone: 'bg-sky-100 text-sky-800' },
};

type Entry = TimelineEntry | PublicTimelineEntry;

export function Timeline({ entries }: { entries: Entry[] }) {
  if (entries.length === 0) return <p className="text-sm text-slate-500">No events recorded yet.</p>;
  return (
    <ol className="space-y-4">
      {entries.map((entry, index) => {
        const kind = KIND[entry.actor_kind];
        const Icon = kind.icon;
        return (
          <li key={'id' in entry ? entry.id : `${entry.event_type}-${index}`} className="flex gap-3">
            <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${kind.tone}`}>
              <Icon className="size-3.5" aria-label={kind.label} />
            </span>
            <div className="min-w-0 text-sm">
              <p className="font-medium capitalize text-ink">{humanize(entry.event_type)}</p>
              <p className="text-xs text-slate-500">
                {formatDateTime(entry.created_at)} · {kind.label}
                {'actor_role' in entry && ` · ${ROLE_LABELS[entry.actor_role] ?? entry.actor_role}`}
              </p>
              {'payload' in entry && typeof entry.payload['to'] === 'string' && (
                <p className="text-xs text-slate-600">
                  Status → {humanize(entry.payload['to'])}
                  {typeof entry.payload['reason_code'] === 'string' && ` (${humanize(entry.payload['reason_code'])})`}
                </p>
              )}
              {'internal_note' in entry && entry.internal_note && (
                <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">Private note: {entry.internal_note}</p>
              )}
              {entry.transaction_signature && (
                <a
                  href={explorerTxUrl(entry.transaction_signature)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 break-all font-mono text-xs text-sky-700 underline"
                >
                  {entry.transaction_signature.slice(0, 16)}… <ExternalLink className="size-3" aria-hidden />
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
