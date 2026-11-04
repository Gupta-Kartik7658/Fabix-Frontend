'use client';

/**
 * Activity Center — `/dashboard/inbox`.
 *
 * The feed is composed client-side from real sources (there is no combined
 * inbox query): PING notifications, pointed_at_you pointers, pending
 * workspace invites, and configured connectors reporting last_error or
 * revoked_at. Only PINGs carry a server read flag; other items are "new"
 * while they are still open.
 *
 * Metrics and supporting panels read existing list/analytics endpoints and
 * render only fields those payloads include.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, Boxes, CheckCheck, CircleHelp, Coins, MessagesSquare, Settings2 } from 'lucide-react';
import { requestGuidedTour } from '@/lib/guided-tour';
import Topbar from '@/components/layout/Topbar';
import { useToast } from '@/components/ui/Toast';
import { WorkspaceDemoGate } from '@/components/workspaces/WorkspaceDemoGate';
import { ActivityFeed } from '@/components/activity/ActivityFeed';
import {
  ConnectorHealthPanel,
  ExecutionsPanel,
  UsagePanel,
} from '@/components/activity/ActivityPanels';
import {
  INTERNAL_CONNECTOR_KEYS,
  connectorDisplayName,
  connectorIssueToActivity,
  errorMessage,
  finiteNumber,
  inviteToActivity,
  mentionToActivity,
  pointerToActivity,
  usageRangeLabel,
  type ActivityItem,
  type ConnectorRow,
} from '@/components/activity/activity-model';
import { ACTIVITY_THEME, MetricCard } from '@/components/activity/activity-ui';
import {
  api,
  type RunRecord,
  type WorkspaceInvite,
  type WorkspaceSummary,
} from '@/lib/api';
import { connectorNeedsAttention } from '@/lib/connectorCredentials';
import { useUser } from '@/lib/hooks';
import { normalizeNotificationType } from '@/lib/notifications';
import type { TokenAnalyticsResponse, UserNotification } from '@/lib/types';

const NOTIFICATION_PAGE_SIZE = 25;

export default function DashboardInboxPage() {
  return (
    <>
      <Topbar title="Activity Center" crumb="Fabix" />
      <WorkspaceDemoGate>
        <ActivityCenter />
      </WorkspaceDemoGate>
    </>
  );
}

function ActivityCenter() {
  const toast = useToast();
  const { user } = useUser();

  const [notifications, setNotifications] = useState<UserNotification[] | null>(null);
  const [notificationTotal, setNotificationTotal] = useState(0);
  const [notificationOffset, setNotificationOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [autoLoad, setAutoLoad] = useState(true);
  const [taskItems, setTaskItems] = useState<ActivityItem[]>([]);
  const [inviteItems, setInviteItems] = useState<ActivityItem[]>([]);
  const [feedError, setFeedError] = useState<string | null>(null);

  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[] | null>(null);
  const [workspacesError, setWorkspacesError] = useState(false);
  const [runs, setRuns] = useState<RunRecord[] | null>(null);
  const [runTotal, setRunTotal] = useState<number | null>(null);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [usage, setUsage] = useState<TokenAnalyticsResponse | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [connectors, setConnectors] = useState<ConnectorRow[] | null>(null);
  const [connectorsError, setConnectorsError] = useState<string | null>(null);

  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const loadFeed = useCallback(async () => {
    setFeedError(null);
    const workspacesPromise = api.getWorkspaces().then(
      (rows) => {
        setWorkspacesError(false);
        setWorkspaces(rows);
        return rows;
      },
      () => {
        setWorkspacesError(true);
        setWorkspaces([]);
        return [] as WorkspaceSummary[];
      },
    );
    try {
      const [page, inviteRows, workspaceRows] = await Promise.all([
        api.getNotifications({ limit: NOTIFICATION_PAGE_SIZE, offset: 0 }),
        api.getWorkspaceInviteInbox().catch(() => [] as WorkspaceInvite[]),
        workspacesPromise,
      ]);

      const pointerBundles = await Promise.all(
        workspaceRows.map(async (workspace) => {
          try {
            const rows = await api.getWorkspacePointers(workspace.id);
            const mine = rows.filter(
              (pointer) => pointer.pointed_at_you === true && pointer.status !== 'done',
            );
            if (mine.length === 0) return [] as ActivityItem[];
            const detail = await api.getWorkspace(workspace.id).catch(() => null);
            const agents = new Map((detail?.agents ?? []).map((agent) => [agent.id, agent]));
            return mine.map((pointer) =>
              pointerToActivity(pointer, workspace.id, workspace.title, agents),
            );
          } catch {
            return [] as ActivityItem[];
          }
        }),
      );

      setNotifications(page.items);
      setNotificationTotal(page.total);
      setNotificationOffset(page.items.length);
      setTaskItems(pointerBundles.flat());
      setInviteItems(
        inviteRows.filter((invite) => invite.status === 'pending').map(inviteToActivity),
      );
    } catch (e) {
      setNotifications((prev) => prev ?? []);
      setFeedError(errorMessage(e, 'Could not load activity.'));
    }
  }, []);

  const loadInsights = useCallback(async () => {
    setRunsError(null);
    setUsageError(null);
    setConnectorsError(null);

    const [runsResult, usageResult, connectorsResult] = await Promise.allSettled([
      api.getRunsPage({ page: 1, page_size: 5 }),
      loadUsage(user?.id),
      loadConnectors(),
    ]);

    if (runsResult.status === 'fulfilled') {
      setRuns(runsResult.value.items);
      setRunTotal(runsResult.value.total);
    } else {
      setRuns([]);
      setRunTotal(null);
      setRunsError(errorMessage(runsResult.reason, 'Could not load executions.'));
    }

    if (usageResult.status === 'fulfilled') {
      setUsage(usageResult.value);
    } else {
      setUsage(null);
      setUsageError(errorMessage(usageResult.reason, 'Could not load usage.'));
    }

    if (connectorsResult.status === 'fulfilled') {
      setConnectors(connectorsResult.value);
    } else {
      setConnectors([]);
      setConnectorsError(errorMessage(connectorsResult.reason, 'Could not load connectors.'));
    }
  }, [user?.id]);

  const loadAll = useCallback(async () => {
    await Promise.all([loadFeed(), loadInsights()]);
  }, [loadFeed, loadInsights]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const hasMore = notifications !== null && notificationOffset < notificationTotal;

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const page = await api.getNotifications({
        limit: NOTIFICATION_PAGE_SIZE,
        offset: notificationOffset,
      });
      setNotifications((prev) => {
        const seen = new Set((prev ?? []).map((row) => row.id));
        return [...(prev ?? []), ...page.items.filter((row) => !seen.has(row.id))];
      });
      setNotificationOffset(notificationOffset + page.items.length);
      setNotificationTotal(page.items.length === 0 ? notificationOffset : page.total);
      setAutoLoad(true);
    } catch (e) {
      setAutoLoad(false);
      toast.error(errorMessage(e, 'Could not load older notifications.'));
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, notificationOffset, toast]);

  const mentionItems = useMemo(
    () =>
      (notifications ?? [])
        .filter((row) => normalizeNotificationType(row.notification_type) === 'PING')
        .map(mentionToActivity),
    [notifications],
  );

  const systemItems = useMemo(
    () =>
      (connectors ?? [])
        .map(connectorIssueToActivity)
        .filter((item): item is ActivityItem => item !== null),
    [connectors],
  );

  const feedItems = useMemo(
    () => [...mentionItems, ...taskItems, ...inviteItems, ...systemItems],
    [mentionItems, taskItems, inviteItems, systemItems],
  );

  const unreadMentions = mentionItems.filter((item) => item.isNew).length;

  const handleMarkRead = useCallback(
    async (id: string) => {
      if (markingId) return;
      setMarkingId(id);
      try {
        const updated = await api.markNotificationRead(id);
        setNotifications((prev) =>
          (prev ?? []).map((row) =>
            row.id === id ? { ...row, is_read: updated.is_read, read_at: updated.read_at } : row,
          ),
        );
      } catch (e) {
        toast.error(errorMessage(e, 'Could not mark as read.'));
      } finally {
        setMarkingId(null);
      }
    },
    [markingId, toast],
  );

  const handleMarkAllRead = async () => {
    if (markingAll || unreadMentions === 0) return;
    setMarkingAll(true);
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => (prev ?? []).map((row) => ({ ...row, is_read: true })));
      toast.success('All notifications marked as read');
    } catch (e) {
      toast.error(errorMessage(e, 'Could not mark all as read.'));
    } finally {
      setMarkingAll(false);
    }
  };

  const agentCount =
    workspaces && !workspacesError
      ? workspaces.reduce((sum, workspace) => sum + finiteNumber(workspace.agent_count), 0)
      : null;
  const connectedCount = connectors
    ? connectors.filter((row) => row.status.is_enabled !== false && !connectorNeedsAttention(row.status)).length
    : null;
  const attentionCount = connectors
    ? connectors.filter((row) => connectorNeedsAttention(row.status)).length
    : 0;

  return (
    <div style={ACTIVITY_THEME} className="min-h-[calc(100dvh-56px)]">
      <div className="mx-auto w-full max-w-[1320px] space-y-6 px-4 pb-12 pt-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[640px]">
            <h1 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.03em] text-[var(--ac-text)] sm:text-[30px]">
              Activity Center
            </h1>
            <p className="mt-2 text-[14px] leading-[1.55] text-[var(--ac-text-2)]">
              Stay updated on conversations, assigned tasks and everything happening across your
              workspaces.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => requestGuidedTour('activity-center')}
              className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-[var(--ac-card)] px-3 text-[12.5px] font-medium text-[var(--ac-text-2)] ring-1 ring-inset ring-[var(--ac-border)] transition-colors duration-150 hover:bg-[var(--ac-elevated)] hover:text-[var(--ac-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,184,121,0.45)]"
            >
              <CircleHelp size={14} />
              Guided tour
            </button>
            <Link
              href="/dashboard/settings#profile"
              className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-[var(--ac-card)] px-3 text-[12.5px] font-medium text-[var(--ac-text-2)] ring-1 ring-inset ring-[var(--ac-border)] transition-colors duration-150 hover:bg-[var(--ac-elevated)] hover:text-[var(--ac-text)]"
            >
              <Settings2 size={14} />
              Notification preferences
            </Link>
            <button
              type="button"
              onClick={() => void handleMarkAllRead()}
              disabled={markingAll || unreadMentions === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-[var(--ac-green)] px-3.5 text-[12.5px] font-semibold text-[#04130c] transition-colors duration-150 hover:bg-[var(--ac-mint)] disabled:cursor-not-allowed disabled:bg-[var(--ac-card)] disabled:text-[var(--ac-muted)] disabled:ring-1 disabled:ring-inset disabled:ring-[var(--ac-border)]"
            >
              <CheckCheck size={14} />
              {markingAll ? 'Marking…' : 'Mark all as read'}
            </button>
          </div>
        </header>

        <section
          aria-label="Overview"
          data-tour="activity-stats"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <MetricCard
            label="Workspaces"
            href="/dashboard/workspaces"
            tourId="activity-stat-workspaces"
            icon={<MessagesSquare size={16} />}
            loading={workspaces === null}
            value={workspaces && !workspacesError ? workspaces.length.toLocaleString() : '—'}
            description={
              agentCount === null
                ? 'Could not load workspaces'
                : `${agentCount.toLocaleString()} ${agentCount === 1 ? 'agent' : 'agents'} across workspaces`
            }
          />
          <MetricCard
            label="Total executions"
            href="/dashboard/runs"
            tourId="activity-stat-executions"
            icon={<Activity size={16} />}
            loading={runs === null && !runsError}
            value={runTotal === null ? '—' : runTotal.toLocaleString()}
            description={runTotal === null ? 'Could not load executions' : 'Recorded tool runs'}
          />
          <MetricCard
            label="Connected connectors"
            href="/dashboard/connectors"
            tourId="activity-stat-connectors"
            icon={<Boxes size={16} />}
            loading={connectors === null && !connectorsError}
            value={connectedCount === null || connectorsError ? '—' : connectedCount.toLocaleString()}
            description={
              connectorsError
                ? 'Could not load connectors'
                : attentionCount > 0
                  ? `${attentionCount.toLocaleString()} need attention`
                  : `${(connectors?.length ?? 0).toLocaleString()} configured`
            }
          />
          <MetricCard
            label="Token consumption"
            href="/dashboard/token-spenditure"
            tourId="activity-stat-tokens"
            icon={<Coins size={16} />}
            loading={usage === null && !usageError}
            value={usage ? finiteNumber(usage.summary.total_tokens).toLocaleString() : '—'}
            description={usage ? usageRangeLabel(usage.date_range) : 'Could not load usage'}
          />
        </section>

        <ActivityFeed
          items={feedItems}
          loading={notifications === null}
          error={feedError}
          onRetry={() => void loadFeed()}
          markingId={markingId}
          onMarkRead={(id) => void handleMarkRead(id)}
          onCopied={() => toast.success('Link copied')}
          hasMore={hasMore}
          loadingMore={loadingMore}
          autoLoad={autoLoad}
          onLoadMore={() => void loadMore()}
        />

        <section
          aria-label="Supporting panels"
          data-tour="activity-operational-panels"
          className="grid grid-cols-1 gap-4 pt-2 lg:grid-cols-3"
        >
          <ExecutionsPanel runs={runs} total={runTotal} error={runsError} onRetry={() => void loadInsights()} />
          <ConnectorHealthPanel connectors={connectors} error={connectorsError} onRetry={() => void loadInsights()} />
          <UsagePanel usage={usage} error={usageError} onRetry={() => void loadInsights()} />
        </section>
      </div>
    </div>
  );
}

async function loadUsage(userId: string | undefined): Promise<TokenAnalyticsResponse> {
  let id = userId;
  if (!id) {
    const details = await api.getUserDetails();
    id = details.id;
  }
  if (!id) throw new Error('Usage could not be loaded.');
  return api.getTokenUsageAnalytics(id, { date_range: '30d', allocation: 'both' });
}

async function loadConnectors(): Promise<ConnectorRow[]> {
  const [catalog, credentials] = await Promise.all([
    api.getConnectorCatalog(false),
    api.getPrivateConnectorCredentials(),
  ]);
  const catalogByKey = new Map(catalog.map((item) => [item.connector_key, item]));
  return credentials
    .filter((status) => status.configured && !INTERNAL_CONNECTOR_KEYS.has(status.connector_key))
    .map((status) => ({
      key: status.connector_key,
      name: connectorDisplayName(status.connector_key, catalogByKey.get(status.connector_key)),
      status,
    }))
    .sort((left, right) => {
      const leftAttention = connectorNeedsAttention(left.status);
      const rightAttention = connectorNeedsAttention(right.status);
      if (leftAttention !== rightAttention) return leftAttention ? -1 : 1;
      return left.name.localeCompare(right.name);
    });
}
