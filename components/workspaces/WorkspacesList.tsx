'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import { ChevronDown, MessagesSquare, Plus, Search } from 'lucide-react';
import { api, type WorkspaceAgent, type WorkspaceSummary } from '@/lib/api';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { DUR, EASE } from '@/lib/motion';
import { cn, formatCompactNumber } from '@/lib/utils';
import { CreateWorkspaceDialog, EditWorkspaceDialog } from './CreateWorkspaceDialog';
import { InviteWorkspaceDialog } from './InviteWorkspaceDialog';
import { SampleDataChip } from './WorkspaceDemoGate';
import { WorkspaceCard } from './WorkspaceCard';
import {
  ACTIVITY_LABEL,
  WORKSPACES_THEME,
  WORKSPACE_SORTS,
  matchesWorkspaceQuery,
  sortWorkspaces,
  workspaceActivity,
  type WorkspaceActivity,
  type WorkspaceFilter,
  type WorkspaceSort,
} from './workspace-list-model';

const FILTERS: WorkspaceFilter[] = ['all', 'active', 'idle', 'unused'];

export function WorkspacesList() {
  const router = useRouter();
  const toast = useToast();
  const reduce = useReducedMotion();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[] | null>(null);
  const [agentsById, setAgentsById] = useState<Record<string, WorkspaceAgent[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<WorkspaceSummary | null>(null);
  const [inviting, setInviting] = useState<WorkspaceSummary | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<WorkspaceFilter>('all');
  const [sort, setSort] = useState<WorkspaceSort>('recent');
  const requested = useRef(new Set<string>());
  const searchRef = useRef<HTMLInputElement>(null);

  const loadAgents = useCallback(async (workspaceId: string) => {
    if (requested.current.has(workspaceId)) return null;
    requested.current.add(workspaceId);
    try {
      const detail = await api.getWorkspace(workspaceId);
      const active = detail.agents.filter((agent) => agent.status === 'active');
      setAgentsById((prev) => ({ ...prev, [workspaceId]: active }));
      return active;
    } catch {
      requested.current.delete(workspaceId);
      return null;
    }
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await api.getWorkspaces();
      setWorkspaces(list);
      // Older list payloads omit handles; fetch members for those rooms.
      const missing = list.filter((w) => !w.agent_handles?.length && w.agent_count > 0);
      const loaded = await Promise.all(
        missing.map(async (w) => [w.id, await loadAgents(w.id)] as const),
      );
      if (loaded.length) {
        const handlesById = Object.fromEntries(
          loaded.filter(([, agents]) => agents).map(([id, agents]) => [id, agents!.map((a) => a.handle)]),
        );
        setWorkspaces((prev) =>
          prev?.map((w) => (handlesById[w.id] ? { ...w, agent_handles: handlesById[w.id] } : w)) ?? prev,
        );
      }
    } catch (e) {
      setWorkspaces([]);
      setError(e instanceof Error ? e.message : 'Could not load workspaces.');
    }
  }, [loadAgents]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.key !== '/' || target?.closest('input, textarea, [contenteditable=true]')) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const [now] = useState(() => Date.now());
  const withActivity = useMemo(
    () => (workspaces ?? []).map((w) => ({ w, activity: workspaceActivity(w, now) })),
    [workspaces, now],
  );

  const counts = useMemo(() => {
    const c: Record<WorkspaceFilter, number> = { all: 0, active: 0, idle: 0, unused: 0 };
    for (const { activity } of withActivity) {
      c.all += 1;
      c[activity] += 1;
    }
    return c;
  }, [withActivity]);

  const visible = useMemo(() => {
    const activityOf = new Map(withActivity.map(({ w, activity }) => [w.id, activity]));
    const filtered = withActivity
      .filter(({ w, activity }) => (filter === 'all' || activity === filter) && matchesWorkspaceQuery(w, query))
      .map(({ w }) => w);
    return sortWorkspaces(filtered, sort).map((w) => ({ w, activity: activityOf.get(w.id)! }));
  }, [withActivity, filter, query, sort]);

  const totals = useMemo(() => {
    const list = workspaces ?? [];
    return {
      workspaces: list.length,
      agents: list.reduce((sum, w) => sum + (w.agent_count ?? 0), 0),
      executions: list.reduce((sum, w) => sum + (w.run_count ?? 0), 0),
      active: counts.active,
    };
  }, [workspaces, counts.active]);

  const copyLink = async (w: WorkspaceSummary) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/workspaces/${w.id}`);
      toast.success('Workspace link copied');
    } catch {
      toast.error('Could not copy the link');
    }
  };

  const loading = workspaces === null;
  const empty = !loading && workspaces.length === 0 && !error;

  return (
    <div style={WORKSPACES_THEME} className="min-h-[calc(100dvh-56px)] bg-[var(--ws-bg)] text-[var(--ws-text)]">
      <div className="mx-auto w-full max-w-[1240px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-[24px] font-semibold tracking-[-0.025em] text-[var(--ws-text)]">Workspaces</h1>
              <SampleDataChip />
            </div>
            <p className="mt-1 text-[13.5px] text-[var(--ws-text-2)]">
              Where your agents collaborate and get work done.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            data-tour="new-workspace"
            className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[var(--ws-primary)] px-3.5 text-[13px] font-medium text-white outline-none transition-colors hover:bg-[#1A9660] active:bg-[#12744A] focus-visible:ring-2 focus-visible:ring-[rgba(57,185,130,0.45)]"
          >
            <Plus className="size-3.5" strokeWidth={2.2} />
            Create workspace
          </button>
        </header>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <SummaryStat
            label="Workspaces"
            value={loading ? null : totals.workspaces}
            detail={`${totals.active} active in the last 24h`}
          />
          <SummaryStat
            label="Agents involved"
            shortLabel="Agents"
            value={loading ? null : totals.agents}
            detail="Active members across workspaces"
          />
          <SummaryStat
            label="Executions"
            value={loading ? null : totals.executions}
            detail="Tool runs recorded in workspaces"
          />
        </div>

        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} onRetry={load} />}

        {!empty && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div
              role="tablist"
              aria-label="Filter by activity"
              className="flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-[9px] border border-[var(--ws-border)] bg-[var(--ws-surface)] p-0.5 [scrollbar-width:none]"
            >
              {FILTERS.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={filter === value}
                  onClick={() => setFilter(value)}
                  className={cn(
                    'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[7px] px-2.5 text-[12.5px] font-medium outline-none transition-colors focus-visible:ring-1 focus-visible:ring-[var(--ws-accent)]',
                    filter === value
                      ? 'bg-[var(--ws-surface-2)] text-[var(--ws-text)]'
                      : 'text-[var(--ws-text-2)] hover:text-[var(--ws-text)]',
                  )}
                >
                  {value === 'all' ? 'All' : ACTIVITY_LABEL[value as WorkspaceActivity]}
                  <span className="text-[11.5px] tabular-nums text-[var(--ws-text-3)]">{loading ? '–' : counts[value]}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div
                data-input-shell
                className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-[8px] border border-[var(--ws-border)] bg-[var(--ws-surface)] px-2.5 focus-within:border-[#2F7A57] sm:w-[240px] sm:flex-none"
              >
                <Search className="size-3.5 shrink-0 text-[var(--ws-text-3)]" strokeWidth={2} />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search workspaces"
                  aria-label="Search workspaces"
                  className="h-full min-w-0 flex-1 text-[12.5px] outline-none placeholder:text-[var(--ws-text-3)]"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    boxShadow: 'none',
                    color: '#F0F3F1',
                    WebkitTextFillColor: '#F0F3F1',
                  }}
                />
                <kbd className="hidden rounded-[4px] border border-[var(--ws-border)] px-1 font-mono text-[10px] text-[var(--ws-text-3)] sm:inline">/</kbd>
              </div>
              <label className="relative flex h-8 shrink-0 items-center rounded-[8px] border border-[var(--ws-border)] bg-[var(--ws-surface)] hover:border-[var(--ws-border-strong)]">
                <span className="sr-only">Sort workspaces</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as WorkspaceSort)}
                  className="h-full cursor-pointer appearance-none rounded-[8px] pl-2.5 pr-7 text-[12.5px] outline-none"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    boxShadow: 'none',
                    color: '#F0F3F1',
                  }}
                >
                  {WORKSPACE_SORTS.map((s) => (
                    <option key={s.value} value={s.value} style={{ background: '#171C19' }}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-[var(--ws-text-3)]" strokeWidth={2} />
              </label>
            </div>
          </div>
        )}

        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-[12px] border border-[var(--ws-border)] bg-[var(--ws-surface)]">
                <div className="space-y-2.5 p-5">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-36" />
                  <Skeleton className="h-3 w-full max-w-[520px]" />
                </div>
                <div className="grid grid-cols-2 gap-3 border-t border-[var(--ws-border)] px-5 py-3.5 lg:grid-cols-5">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Skeleton key={j} className="h-9 rounded-md" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {empty && (
          <div className="flex flex-col items-center rounded-[12px] border border-[var(--ws-border)] bg-[var(--ws-surface)] px-6 py-12 text-center">
            <span className="flex size-10 items-center justify-center rounded-[10px] border border-[var(--ws-border)] bg-[var(--ws-surface-2)]">
              <MessagesSquare className="size-[18px] text-[var(--ws-text-2)]" strokeWidth={1.75} />
            </span>
            <h2 className="mt-4 text-[15px] font-semibold text-[var(--ws-text)]">No workspaces yet</h2>
            <p className="mt-1.5 max-w-[46ch] text-[13px] leading-[1.55] text-[var(--ws-text-2)]">
              Create a workspace, invite agents with a link, and give them a goal to work on together.
            </p>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[var(--ws-primary)] px-3.5 text-[13px] font-medium text-white hover:bg-[#1A9660]"
            >
              <Plus className="size-3.5" strokeWidth={2.2} />
              Create workspace
            </button>
          </div>
        )}

        {!loading && !empty && visible.length === 0 && (
          <div className="rounded-[12px] border border-[var(--ws-border)] bg-[var(--ws-surface)] px-5 py-8 text-center">
            <p className="text-[13.5px] font-medium text-[var(--ws-text)]">No workspaces match</p>
            <p className="mt-1 text-[12.5px] text-[var(--ws-text-2)]">
              {query.trim() ? `Nothing matches “${query.trim()}”` : 'Nothing in this filter'}
              {filter !== 'all' ? ` with status ${ACTIVITY_LABEL[filter as WorkspaceActivity]}.` : '.'}
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setFilter('all');
              }}
              className="mt-3 text-[12.5px] font-medium text-[var(--ws-text-2)] underline underline-offset-4 hover:text-[var(--ws-text)]"
            >
              Clear search and filters
            </button>
          </div>
        )}

        {visible.length > 0 && (
          <ul className="space-y-3">
            {visible.map(({ w, activity }, index) => (
              <motion.li
                key={w.id}
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: DUR.default, ease: EASE.out, delay: reduce ? 0 : Math.min(index, 8) * 0.03 }}
              >
                <WorkspaceCard
                  workspace={w}
                  activity={activity}
                  agents={agentsById[w.id]}
                  actions={{
                    onEdit: () => setEditing(w),
                    onInvite: () => setInviting(w),
                    onCopyLink: () => void copyLink(w),
                    onRequestAgents: () => void loadAgents(w.id),
                  }}
                />
              </motion.li>
            ))}
          </ul>
        )}
      </div>

      <CreateWorkspaceDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(detail) => router.push(`/workspaces/${detail.workspace.id}`)}
      />
      <EditWorkspaceDialog
        workspace={editing}
        onOpenChange={(open) => !open && setEditing(null)}
        onSaved={(record) => {
          setWorkspaces((prev) =>
            prev?.map((w) => (w.id === record.id ? { ...w, title: record.title, task: record.task } : w)) ?? prev,
          );
          toast.success('Workspace updated');
        }}
      />
      <InviteWorkspaceDialog
        workspaceId={inviting?.id ?? ''}
        workspaceTitle={inviting?.title ?? ''}
        open={!!inviting}
        onOpenChange={(open) => !open && setInviting(null)}
      />
    </div>
  );
}

function SummaryStat({
  label,
  shortLabel,
  value,
  detail,
}: {
  label: string;
  shortLabel?: string;
  value: number | null;
  detail: string;
}) {
  return (
    <div className="min-w-0 rounded-[12px] border border-[var(--ws-border)] bg-[var(--ws-surface)] px-3 py-3 sm:px-4 sm:py-3.5">
      <p className="truncate text-[12px] font-medium text-[var(--ws-text-2)]">
        {shortLabel ? (
          <>
            <span className="sm:hidden">{shortLabel}</span>
            <span className="hidden sm:inline">{label}</span>
          </>
        ) : (
          label
        )}
      </p>
      <p className="mt-1.5 text-[20px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-[var(--ws-text)] sm:text-[22px]">
        {value === null ? (
          <span className="inline-block h-5 w-8 animate-pulse rounded bg-[var(--ws-surface-2)]" />
        ) : (
          formatCompactNumber(value)
        )}
      </p>
      <p className="mt-1.5 hidden truncate text-[12px] text-[var(--ws-text-3)] sm:block">{detail}</p>
    </div>
  );
}
