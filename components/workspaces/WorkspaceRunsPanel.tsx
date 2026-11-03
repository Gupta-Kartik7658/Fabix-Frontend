'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronRight, Loader2, Search, X, Zap } from 'lucide-react';
import { api, type WorkspaceRun } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import CopyButton from '@/components/ui/CopyButton';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { cn, formatCompactNumber, formatExecutionTimeMs } from '@/lib/utils';
import { PanelEmpty } from './PanelEmpty';

type StatusKind = 'success' | 'failed' | 'running' | 'other';

function statusKind(status: string): StatusKind {
  const key = status.toLowerCase();
  if (key === 'success' || key === 'ok' || key === 'completed') return 'success';
  if (key === 'failed' || key === 'error' || key === 'denied') return 'failed';
  if (key === 'running' || key === 'in_progress' || key === 'pending') return 'running';
  return 'other';
}

const STATUS_STYLE: Record<StatusKind, { dot: string; text: string }> = {
  success: { dot: 'bg-[var(--success)]', text: 'text-[var(--success-dark)]' },
  failed: { dot: 'bg-[var(--error)]', text: 'text-[var(--error-dark)]' },
  running: { dot: 'bg-[var(--warning)]', text: 'text-[var(--warning-dark)]' },
  other: { dot: 'bg-[var(--neutral-soft-400)]', text: 'text-[var(--neutral-sub-600)]' },
};

const STATUS_FILTERS: Array<{ key: StatusKind | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'success', label: 'Success' },
  { key: 'failed', label: 'Failed' },
  { key: 'running', label: 'Running' },
];

function prettyJson(value: unknown) {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function runError(run: WorkspaceRun): string | null {
  if (run.error_message) return run.error_message;
  const payload = run.result_payload;
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const error = (payload as Record<string, unknown>).error;
    if (typeof error === 'string' && error.trim()) return error;
  }
  return null;
}

function formatClock(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

const ROW_GRID =
  'md:grid md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_104px_96px_128px] md:items-center md:gap-4';

export function WorkspaceRunsPanel({
  workspaceId,
  onTotalChange,
  agentFilter = '',
  onAgentFilterChange,
}: {
  workspaceId: string;
  onTotalChange?: (total: number) => void;
  /** Agent handle without `@`; empty for all agents. */
  agentFilter?: string;
  onAgentFilterChange?: (handle: string) => void;
}) {
  const [items, setItems] = useState<WorkspaceRun[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, WorkspaceRun>>({});
  const [detailError, setDetailError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusKind | 'all'>('all');
  const limit = 20;

  const loadPage = useCallback(
    async (nextOffset: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const page = await api.getWorkspaceRuns(workspaceId, { limit, offset: nextOffset });
        setItems((current) => (append ? [...current, ...page.items] : page.items));
        setTotal(page.total);
        setOffset(nextOffset);
        onTotalChange?.(page.total);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load runs.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [workspaceId, onTotalChange],
  );

  useEffect(() => {
    setItems([]);
    setOpenId(null);
    setDetails({});
    void loadPage(0, false);
  }, [loadPage]);

  const openRun = async (id: string) => {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    setDetailError(null);
    if (details[id]) return;
    try {
      const row = await api.getWorkspaceRun(id);
      setDetails((current) => ({ ...current, [id]: row }));
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : 'Could not load run detail.');
    }
  };

  const agentOptions = useMemo(() => {
    const set = new Set<string>();
    for (const run of items) if (run.agent_handle) set.add(run.agent_handle.replace(/^@/, ''));
    if (agentFilter) set.add(agentFilter);
    return [...set].sort();
  }, [items, agentFilter]);

  const counts = useMemo(() => {
    const next: Record<StatusKind | 'all', number> = { all: items.length, success: 0, failed: 0, running: 0, other: 0 };
    for (const run of items) next[statusKind(run.status)] += 1;
    return next;
  }, [items]);

  const q = query.trim().toLowerCase();
  const visible = items.filter((run) => {
    const handle = run.agent_handle?.replace(/^@/, '') ?? '';
    if (agentFilter && handle.toLowerCase() !== agentFilter.toLowerCase()) return false;
    if (status !== 'all' && statusKind(run.status) !== status) return false;
    if (q && !`${run.tool_name} ${handle}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const filtering = Boolean(q || agentFilter || status !== 'all');

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-[13px] text-[var(--neutral-sub-600)]">
        <Loader2 size={14} className="animate-spin" />
        Loading runs…
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-6 sm:px-6">
        <p className="text-[13px] text-[var(--error-dark)]">{error}</p>
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => void loadPage(0, false)}>
          Retry
        </Button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <PanelEmpty
        icon={Zap}
        title="No runs yet"
        hint="Tool executions by agents in this workspace will show up here."
      />
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-[var(--stroke-soft-200)] bg-[var(--bg-app)] px-4 py-2.5 sm:px-6">
        <label
          data-input-shell
          className="flex h-8 w-full items-center gap-2 rounded-[8px] border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] px-2.5 sm:w-[240px]"
        >
          <Search size={14} className="shrink-0 text-[var(--neutral-soft-400)]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tool or agent"
            aria-label="Search runs"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--neutral-soft-400)]"
            style={{ background: 'transparent', border: 'none', boxShadow: 'none', color: 'var(--neutral-strong-950)', WebkitTextFillColor: 'var(--neutral-strong-950)' }}
          />
        </label>

        <div role="tablist" aria-label="Filter by status" className="flex h-8 items-center gap-0.5 rounded-[8px] border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] p-0.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={status === f.key}
              onClick={() => setStatus(f.key)}
              className={cn(
                'flex h-full items-center gap-1.5 rounded-[6px] px-2 text-[12.5px] font-medium transition-colors',
                status === f.key
                  ? 'bg-[var(--neutral-weak-50)] text-[var(--neutral-strong-950)]'
                  : 'text-[var(--neutral-sub-600)] hover:text-[var(--neutral-strong-950)]',
              )}
            >
              {f.label}
              <span className="tabular-nums text-[11px] text-[var(--neutral-soft-400)]">{counts[f.key]}</span>
            </button>
          ))}
        </div>

        {agentOptions.length > 1 || agentFilter ? (
          <select
            value={agentFilter}
            onChange={(e) => onAgentFilterChange?.(e.target.value)}
            aria-label="Filter by agent"
            className="h-8 rounded-[8px] border border-[var(--stroke-soft-200)] px-2 text-[12.5px] outline-none"
            style={{ background: 'var(--bg-surface)', color: 'var(--neutral-strong-950)', boxShadow: 'none' }}
          >
            <option value="">All agents</option>
            {agentOptions.map((handle) => (
              <option key={handle} value={handle}>
                @{handle}
              </option>
            ))}
          </select>
        ) : null}

        <p className="ml-auto text-[12px] tabular-nums text-[var(--neutral-soft-400)]">
          {filtering
            ? `${visible.length} of ${items.length} loaded`
            : `${items.length} of ${formatCompactNumber(total)}`}
        </p>
      </div>

      <div className={cn('hidden border-b border-[var(--stroke-soft-200)] px-6 py-2 pl-[52px] text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]', ROW_GRID)}>
        <span>Tool</span>
        <span>Agent</span>
        <span>Status</span>
        <span className="text-right">Duration</span>
        <span className="text-right">Time</span>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <p className="text-[13px] text-[var(--neutral-sub-600)]">No loaded runs match these filters.</p>
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<X size={13} />}
            onClick={() => {
              setQuery('');
              setStatus('all');
              onAgentFilterChange?.('');
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <ul>
          {visible.map((run) => {
            const open = openId === run.id;
            const detail = details[run.id] ?? run;
            const kind = statusKind(run.status);
            const style = STATUS_STYLE[kind];
            const errorText = runError(detail);
            const handle = run.agent_handle?.replace(/^@/, '');
            return (
              <li key={run.id} className="border-b border-[var(--stroke-soft-200)]">
                <button
                  type="button"
                  onClick={() => void openRun(run.id)}
                  aria-expanded={open}
                  className={cn(
                    'flex w-full items-start gap-3 px-4 py-2.5 text-left outline-none transition-colors hover:bg-[var(--neutral-weak-50)] focus-visible:bg-[var(--neutral-weak-50)] sm:px-6',
                    open && 'bg-[var(--neutral-weak-50)]',
                  )}
                >
                  <ChevronRight
                    size={14}
                    className={cn(
                      'mt-[3px] shrink-0 text-[var(--neutral-soft-400)] transition-transform md:mt-0 md:self-center',
                      open && 'rotate-90',
                    )}
                  />
                  <span className={cn('min-w-0 flex-1', ROW_GRID)}>
                    <span className="block truncate font-mono text-[12.5px] font-medium text-[var(--neutral-strong-950)]">
                      {run.tool_name}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-[var(--neutral-sub-600)] md:contents">
                      <span className="truncate font-mono md:block">{handle ? `@${handle}` : 'Unknown agent'}</span>
                      <span className={cn('inline-flex items-center gap-1.5 text-[12px] font-medium capitalize', style.text)}>
                        <span className={cn('size-1.5 shrink-0 rounded-full', style.dot)} />
                        {run.status}
                      </span>
                      <span className="tabular-nums md:text-right">
                        {run.execution_time_ms != null ? formatExecutionTimeMs(run.execution_time_ms) : '—'}
                      </span>
                      <span
                        className="tabular-nums text-[var(--neutral-soft-400)] md:text-right"
                        title={run.timestamp ? formatClock(run.timestamp) : undefined}
                      >
                        {run.timestamp ? <RelativeTime timestamp={run.timestamp} /> : '—'}
                      </span>
                    </span>
                  </span>
                </button>

                {open && (
                  <div className="px-4 pb-4 pl-[44px] sm:px-6 sm:pl-[52px]">
                    {detailError ? (
                      <p className="text-[12.5px] text-[var(--error-dark)]">{detailError}</p>
                    ) : (
                      <div className="space-y-3">
                        {errorText && (
                          <div className="flex items-start gap-2 rounded-[8px] border border-[var(--stroke-soft-200)] border-l-2 border-l-[var(--error)] bg-[var(--bg-surface)] px-3 py-2">
                            <AlertCircle size={14} className="mt-px shrink-0 text-[var(--error-dark)]" />
                            <div className="min-w-0">
                              <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">Error</p>
                              <p className="mt-0.5 break-words font-mono text-[12px] leading-[1.5] text-[var(--neutral-strong-950)]">{errorText}</p>
                            </div>
                          </div>
                        )}
                        <div className="grid gap-3 lg:grid-cols-2">
                          <CodeBlock label="Input arguments" value={prettyJson(detail.arguments)} />
                          <CodeBlock label="Output" value={prettyJson(detail.result_payload)} />
                        </div>
                        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-[8px] border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] px-3 py-2.5 sm:grid-cols-4">
                          <Meta label="Run ID">
                            <span className="flex min-w-0 items-center gap-1">
                              <span className="truncate font-mono">{run.id}</span>
                              <CopyButton text={run.id} />
                            </span>
                          </Meta>
                          <Meta label="Started">{detail.timestamp ? formatClock(detail.timestamp) : '—'}</Meta>
                          <Meta label="Duration">
                            {detail.execution_time_ms != null ? formatExecutionTimeMs(detail.execution_time_ms) : '—'}
                          </Meta>
                          <Meta label="Tokens">
                            {detail.token_count != null ? detail.token_count.toLocaleString() : 'Not reported'}
                          </Meta>
                        </dl>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {items.length < total && (
        <div className="px-4 py-3 sm:px-6">
          <Button
            variant="secondary"
            size="sm"
            disabled={loadingMore}
            onClick={() => void loadPage(offset + limit, true)}
          >
            {loadingMore ? 'Loading…' : `Load more (${items.length} of ${total})`}
          </Button>
        </div>
      )}
    </div>
  );
}

function CodeBlock({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0 rounded-[8px] border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--stroke-soft-200)] px-3 py-1.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">{label}</span>
        {value && <CopyButton text={value} />}
      </div>
      <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words px-3 py-2 font-mono text-[11.5px] leading-[1.55] text-[var(--neutral-strong-950)]">
        {value ?? <span className="text-[var(--neutral-soft-400)]">None</span>}
      </pre>
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-[var(--neutral-soft-400)]">{label}</dt>
      <dd className="mt-0.5 truncate text-[12px] tabular-nums text-[var(--neutral-strong-950)]">{children}</dd>
    </div>
  );
}
