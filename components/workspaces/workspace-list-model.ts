import type { CSSProperties } from 'react';
import type { WorkspaceSummary } from '@/lib/api';
import { parseApiUtcTimestamp } from '@/lib/utils';

export const WORKSPACES_THEME = {
  '--ws-bg': '#090B0A',
  '--ws-surface': '#111513',
  '--ws-surface-2': '#171C19',
  '--ws-hover': '#141916',
  '--ws-border': '#252B27',
  '--ws-border-strong': '#303833',
  '--ws-text': '#F0F3F1',
  '--ws-text-2': '#A1AAA4',
  '--ws-text-3': '#737D76',
  '--ws-accent': '#39B982',
  '--ws-primary': '#168653',
  '--ws-success': '#42B883',
  '--ws-warning': '#E5AD59',
  '--ws-error': '#E47777',
  '--white-0': '#111513',
  '--bg-surface': '#111513',
  '--bg-app': '#090B0A',
  '--neutral-weak-50': '#171C19',
  '--neutral-soft-200': '#252B27',
  '--neutral-soft-400': '#737D76',
  '--neutral-sub-600': '#A1AAA4',
  '--neutral-strong-950': '#F0F3F1',
  '--stroke-soft-200': '#252B27',
  '--stroke-sub-300': '#303833',
  '--primary-base': '#39B982',
  '--primary-dark': '#56C58D',
  '--primary-alpha-10': 'rgba(57, 185, 130, 0.10)',
  '--primary-alpha-16': 'rgba(57, 185, 130, 0.16)',
  '--primary-alpha-24': 'rgba(57, 185, 130, 0.26)',
  '--error': '#E47777',
  '--error-dark': '#E47777',
  '--error-lighter': 'rgba(228, 119, 119, 0.12)',
  '--btn-primary-bg': '#168653',
  '--btn-primary-bg-hover': '#1A9660',
  '--btn-primary-bg-active': '#12744A',
  '--btn-primary-border': '#12744A',
  '--btn-primary-shadow': 'none',
} as CSSProperties;

export type WorkspaceActivity = 'active' | 'idle' | 'unused';

/** Activity in this window counts as "Active"; older activity is "Idle". */
export const ACTIVE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isUnusedWorkspace(w: WorkspaceSummary): boolean {
  return (
    w.agent_count === 0 &&
    w.message_count === 0 &&
    (w.pointer_count ?? 0) === 0 &&
    (w.run_count ?? 0) === 0 &&
    (w.total_tokens ?? 0) === 0
  );
}

function timeOf(timestamp: string | null | undefined): number | null {
  if (!timestamp) return null;
  const t = parseApiUtcTimestamp(timestamp).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Last recorded activity, or null when the room has never been used.
 *  A last_activity_at equal to created_at is the creation itself. */
export function lastActivityAt(w: WorkspaceSummary): string | null {
  if (!w.last_activity_at) return null;
  if (w.last_activity_at === w.created_at && w.message_count === 0 && (w.run_count ?? 0) === 0) {
    return null;
  }
  return w.last_activity_at;
}

export function workspaceActivity(w: WorkspaceSummary, now = Date.now()): WorkspaceActivity {
  if (isUnusedWorkspace(w)) return 'unused';
  const last = timeOf(lastActivityAt(w));
  if (last !== null && now - last <= ACTIVE_WINDOW_MS) return 'active';
  return 'idle';
}

export const ACTIVITY_LABEL: Record<WorkspaceActivity, string> = {
  active: 'Active',
  idle: 'Idle',
  unused: 'Unused',
};

export const ACTIVITY_HINT: Record<WorkspaceActivity, string> = {
  active: 'Activity in the last 24 hours',
  idle: 'No activity in the last 24 hours',
  unused: 'No agents, messages, tasks or executions yet',
};

export type WorkspaceFilter = 'all' | WorkspaceActivity;
export type WorkspaceSort = 'recent' | 'created' | 'executions';

export const WORKSPACE_SORTS: Array<{ value: WorkspaceSort; label: string }> = [
  { value: 'recent', label: 'Recently active' },
  { value: 'created', label: 'Newest first' },
  { value: 'executions', label: 'Most executions' },
];

export function sortWorkspaces(list: WorkspaceSummary[], sort: WorkspaceSort): WorkspaceSummary[] {
  const created = (w: WorkspaceSummary) => timeOf(w.created_at) ?? 0;
  const recent = (w: WorkspaceSummary) => timeOf(lastActivityAt(w)) ?? created(w);
  return list.slice().sort((a, b) => {
    if (sort === 'executions') {
      return (b.run_count ?? 0) - (a.run_count ?? 0) || recent(b) - recent(a);
    }
    if (sort === 'created') return created(b) - created(a);
    return recent(b) - recent(a);
  });
}

export function matchesWorkspaceQuery(w: WorkspaceSummary, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [w.title, w.task ?? '', ...(w.agent_handles ?? []).map((h) => `@${h}`)]
    .join(' ')
    .toLowerCase()
    .includes(q);
}

export function formatCreatedDate(timestamp: string): string | null {
  const t = timeOf(timestamp);
  if (t === null) return null;
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
