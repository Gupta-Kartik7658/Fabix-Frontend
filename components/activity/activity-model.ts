import type {
  RunRecord,
  WorkspaceInvite,
  WorkspaceTaskPointer,
} from '@/lib/api';
import { CONNECTORS } from '@/components/ui/ConnectorMark';
import {
  connectorNeedsAttention,
  isKnownConnectorId,
} from '@/lib/connectorCredentials';
import type {
  ConnectorCatalogItem,
  PrivateConnectorCredentialStatus,
  UserNotification,
} from '@/lib/types';

export type ActivityCategory = 'mention' | 'task' | 'workspace' | 'system';

export type ActivityFilter = 'all' | ActivityCategory;

export type ActivityAction = {
  label: string;
  href: string;
};

export type ActivityItem = {
  key: string;
  id: string;
  category: ActivityCategory;
  actor: string;
  /** True when the actor is an agent handle, so it renders as `@handle`. */
  actorIsHandle: boolean;
  typeLabel: string;
  message: string;
  workspaceId: string | null;
  workspaceTitle: string | null;
  createdAt: string | null;
  /** NEW section: unread pings, open tasks, pending invites, open connector issues. */
  isNew: boolean;
  /** Only PING notifications have a server-side read flag. */
  markable: boolean;
  primaryAction: ActivityAction | null;
  menuActions: ActivityAction[];
};

export type ConnectorRow = {
  key: string;
  name: string;
  status: PrivateConnectorCredentialStatus;
};

export const INTERNAL_CONNECTOR_KEYS = new Set(['memory', 'workspace']);

export const ACTIVITY_FILTERS: { id: ActivityFilter; label: string }[] = [
  { id: 'all', label: 'All activity' },
  { id: 'mention', label: 'Mentions' },
  { id: 'task', label: 'Task assignments' },
  { id: 'workspace', label: 'Workspace updates' },
  { id: 'system', label: 'System activity' },
];

export function leadingHandle(text: string | null | undefined): string | null {
  const match = /^@([a-z0-9_-]+)/i.exec((text ?? '').trim());
  return match ? match[1] : null;
}

export function timeValue(value: string | null): number {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sortByTimeDesc(left: ActivityItem, right: ActivityItem): number {
  return timeValue(right.createdAt) - timeValue(left.createdAt);
}

function workspaceHref(workspaceId: string | null): string {
  return workspaceId ? `/workspaces/${encodeURIComponent(workspaceId)}` : '/dashboard/workspaces';
}

export function mentionToActivity(row: UserNotification): ActivityItem {
  const workspaceId = row.workspace_id ?? null;
  const conversation = workspaceHref(workspaceId);
  const replyHref =
    workspaceId && row.workspace_message_id
      ? `${conversation}?message=${encodeURIComponent(row.workspace_message_id)}`
      : conversation;
  const handle = leadingHandle(row.target_descriptor);

  return {
    key: `mention-${row.id}`,
    id: row.id,
    category: 'mention',
    actor: handle ?? 'agent',
    actorIsHandle: true,
    typeLabel: 'Mention',
    message: row.target_descriptor?.trim() || 'Pinged you in a workspace.',
    workspaceId,
    workspaceTitle: row.room_name?.trim() || null,
    createdAt: row.created_at,
    isNew: !row.is_read,
    markable: true,
    primaryAction: workspaceId ? { label: 'Reply in workspace', href: replyHref } : null,
    menuActions: workspaceId ? [{ label: 'View conversation', href: conversation }] : [],
  };
}

export function pointerToActivity(
  pointer: WorkspaceTaskPointer,
  workspaceId: string,
  workspaceTitle: string,
  agents: Map<string, { handle: string }>,
): ActivityItem {
  const author = pointer.created_by_member_id
    ? agents.get(pointer.created_by_member_id)
    : null;
  const tasksHref = `${workspaceHref(workspaceId)}?tab=tasks`;

  return {
    key: `task-${pointer.id}`,
    id: pointer.id,
    category: 'task',
    actor: author?.handle || pointer.assignee_handle || 'agent',
    actorIsHandle: true,
    typeLabel: pointer.status === 'review' ? 'Task · in review' : 'Task',
    message: `Pointed a task at you: ${pointer.title}`,
    workspaceId,
    workspaceTitle,
    createdAt: pointer.updated_at || pointer.created_at,
    isNew: true,
    markable: false,
    primaryAction: { label: 'Open task', href: tasksHref },
    menuActions: [{ label: 'View conversation', href: workspaceHref(workspaceId) }],
  };
}

export function inviteToActivity(invite: WorkspaceInvite): ActivityItem {
  const title = invite.workspace_title || 'a workspace';
  return {
    key: `invite-${invite.id || invite.invite_code}`,
    id: invite.id || invite.invite_code,
    category: 'workspace',
    actor: invite.suggested_handle || 'invite',
    actorIsHandle: Boolean(invite.suggested_handle),
    typeLabel: 'Invite',
    message: `Invited your agent${invite.suggested_handle ? ` as @${invite.suggested_handle}` : ''} to ${title}`,
    workspaceId: invite.workspace_id || null,
    workspaceTitle: invite.workspace_title || null,
    createdAt: invite.created_at,
    isNew: true,
    markable: false,
    primaryAction: {
      label: 'Join workspace',
      href: `/workspaces/join/${encodeURIComponent(invite.invite_code)}`,
    },
    menuActions: [],
  };
}

export function connectorDisplayName(
  key: string,
  item: ConnectorCatalogItem | undefined,
): string {
  if (item?.display_name?.trim()) return item.display_name.trim();
  if (isKnownConnectorId(key)) return CONNECTORS[key].name;
  return key;
}

export function connectorIssueToActivity(row: ConnectorRow): ActivityItem | null {
  if (!connectorNeedsAttention(row.status)) return null;
  const error = row.status.last_error?.trim();
  const href = `/dashboard/connectors/${encodeURIComponent(row.key)}`;

  return {
    key: `system-${row.key}`,
    id: row.key,
    category: 'system',
    actor: row.name,
    actorIsHandle: false,
    typeLabel: error ? 'Connector error' : 'Connector revoked',
    message: error || 'Connector credentials were revoked.',
    workspaceId: null,
    workspaceTitle: null,
    createdAt:
      row.status.revoked_at ||
      row.status.last_tested_at ||
      row.status.updated_at ||
      null,
    isNew: true,
    markable: false,
    primaryAction: { label: 'View connector', href },
    menuActions: [{ label: 'All connectors', href: '/dashboard/connectors' }],
  };
}

export function runStatusLabel(status: string): string {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'running':
      return 'Running';
    case 'queued':
      return 'Queued';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status || 'Unknown';
  }
}

export type Tone = 'green' | 'info' | 'warning' | 'error' | 'muted';

export function runStatusTone(status: RunRecord['status']): Tone {
  switch (status) {
    case 'completed':
      return 'green';
    case 'failed':
      return 'error';
    case 'running':
      return 'warning';
    case 'queued':
      return 'info';
    default:
      return 'muted';
  }
}

export function connectorStatus(status: PrivateConnectorCredentialStatus): {
  label: string;
  tone: Tone;
} {
  if (status.last_error?.trim()) return { label: 'Error', tone: 'error' };
  if (status.revoked_at) return { label: 'Revoked', tone: 'error' };
  if (status.is_enabled === false) return { label: 'Disabled', tone: 'muted' };
  if (status.configured) return { label: 'Connected', tone: 'green' };
  return { label: 'Not configured', tone: 'muted' };
}

export const CATEGORY_TONE: Record<ActivityCategory, Tone> = {
  mention: 'warning',
  task: 'info',
  workspace: 'muted',
  system: 'error',
};

export function finiteNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function usageRangeLabel(range: string): string {
  switch (range) {
    case 'today':
      return 'Today';
    case '7d':
      return 'Last 7 days';
    case '30d':
      return 'Last 30 days';
    case '90d':
      return 'Last 90 days';
    case 'all':
      return 'All time';
    case 'custom':
      return 'Custom range';
    default:
      return range;
  }
}

export function errorMessage(reason: unknown, fallback: string): string {
  return reason instanceof Error && reason.message ? reason.message : fallback;
}
