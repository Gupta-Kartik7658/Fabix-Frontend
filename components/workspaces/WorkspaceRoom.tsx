'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowLeft,
  Bot,
  ChevronDown,
  CircleHelp,
  Link2,
  ListChecks,
  MessagesSquare,
  Paperclip,
  Pencil,
  Settings2,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import {
  api,
  getWorkspaceMessageStreamUrl,
  normalizeWorkspaceMessage,
  type WorkspaceAgentKeyResponse,
  type WorkspaceAgentStatus,
  type WorkspaceDetail,
  type WorkspaceFileRef,
  type WorkspaceMessage,
  type WorkspacePerson,
  type WorkspacePointerStatus,
  type WorkspaceSummary,
} from '@/lib/api';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/components/ui/ThemeToggle';
import { Skeleton } from '@/components/ui/Skeleton';
import { useUser } from '@/lib/hooks';
import { cn, formatCompactNumber } from '@/lib/utils';
import { AgentChat } from './AgentChat';
import { AgentKeyDialog } from './AgentKeyDialog';
import { AgentRoster } from './AgentRoster';
import { Composer } from './Composer';
import { AgentGlyph, MentionText, AgentHueProvider } from './agent-visuals';
import { UserMenu } from '@/components/ui/UserMenu';
import { EditWorkspaceDialog } from './CreateWorkspaceDialog';
import { FilesPanel } from './FilesPanel';
import { WorkspaceSettingsPanel } from './WorkspaceSettingsPanel';
import { SampleDataChip, useIsDemo } from './WorkspaceDemoGate';
import { DEMO_VIEWER } from '@/lib/workspace-preview';
import { recordRecentWorkspace, resolveRecentWorkspaces } from '@/lib/recentWorkspaces';
import { TaskChecklist } from './TaskChecklist';
import { RoomSidebar, type SiblingMeta } from './RoomSidebar';
import { InlineEdit } from './InlineEdit';
import { ShortcutsDialog, useWorkspaceShortcuts } from './shortcuts';
import { WorkspaceAgentsMdDialog } from './WorkspaceAgentsMdDialog';
import { InviteWorkspaceDialog } from './InviteWorkspaceDialog';
import { WorkspaceRunsPanel } from './WorkspaceRunsPanel';
import { WorkspaceOnboardingProvider } from '@/components/guided-tour/WorkspaceOnboardingProvider';
import { requestGuidedTour } from '@/lib/guided-tour';

type Tab = 'conversation' | 'agents' | 'tasks' | 'runs' | 'settings' | 'files';

const TABS: Tab[] = ['conversation', 'agents', 'tasks', 'runs', 'settings', 'files'];

/** `?tab=` values accepted from links; `executions` is an alias for runs. */
function tabFromParam(value: string | null): Tab {
  if (value === 'executions') return 'runs';
  return TABS.includes(value as Tab) ? (value as Tab) : 'conversation';
}

/** Reduces a workspace detail to what the room switcher needs. */
function metaFrom(d: WorkspaceDetail): SiblingMeta {
  const pointers = d.pointers ?? [];
  return {
    agents: d.agents,
    done: pointers.filter((p) => p.status === 'done').length,
    total: pointers.length,
  };
}

function mergeMessage(messages: WorkspaceMessage[], incoming: WorkspaceMessage): WorkspaceMessage[] {
  const index = messages.findIndex((message) => message.id === incoming.id);
  const next =
    index >= 0
      ? messages.map((message) => (message.id === incoming.id ? incoming : message))
      : [...messages, incoming];

  return next.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function WorkspaceRoom({ workspaceId }: { workspaceId: string }) {
  const { theme, setTheme } = useTheme();
  const isDemo = useIsDemo();
  const { user } = useUser();
  const [detail, setDetail] = useState<WorkspaceDetail | null>(null);
  const [siblings, setSiblings] = useState<WorkspaceSummary[]>([]);
  const [siblingMeta, setSiblingMeta] = useState<Record<string, SiblingMeta>>({});
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('conversation');
  const [senderId, setSenderId] = useState<string | null>(null);
  const [issued, setIssued] = useState<WorkspaceAgentKeyResponse | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [agentsMdOpen, setAgentsMdOpen] = useState(false);
  const [inviteLinkOpen, setInviteLinkOpen] = useState(false);
  const [composerFocus, setComposerFocus] = useState(0);
  const [taskFocus, setTaskFocus] = useState(0);
  const [inviteOpen, setInviteOpen] = useState(0);
  const [titleEdit, setTitleEdit] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [taskDraft, setTaskDraft] = useState('');
  const [runsAgent, setRunsAgent] = useState('');
  const [runsTotal, setRunsTotal] = useState<number | null>(null);
  const [people, setPeople] = useState<WorkspacePerson[]>([]);
  const [focusMessageId, setFocusMessageId] = useState<string | null>(null);
  const [recentTick, setRecentTick] = useState(0);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [d, list, nextPeople] = await Promise.all([
        api.getWorkspace(workspaceId),
        api.getWorkspaces(),
        api.getWorkspacePeople(workspaceId).catch(() => [] as WorkspacePerson[]),
      ]);
      setDetail(d);
      setSiblings(list);
      setPeople(nextPeople);
      setSenderId(() => {
        const viewerId = isDemo ? DEMO_VIEWER.userId : user?.id;
        const mine = d.agents.find(
          (a) => a.status === 'active' && viewerId && a.user_id === viewerId,
        );
        return mine?.id ?? d.agents.find((a) => a.status === 'active')?.id ?? null;
      });

      const entries = await Promise.all(
        list.map(async (s) => {
          if (s.id === workspaceId) return [s.id, metaFrom(d)] as const;
          try {
            return [s.id, metaFrom(await api.getWorkspace(s.id))] as const;
          } catch {
            return [
              s.id,
              { agents: [], done: 0, total: s.pointer_count ?? 0 } as SiblingMeta,
            ] as const;
          }
        }),
      );
      setSiblingMeta(Object.fromEntries(entries));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this workspace.');
    }
  }, [workspaceId, user?.id, isDemo]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setTab(tabFromParam(params.get('tab')));
    setRunsTotal(null);
    setFocusMessageId(params.get('message'));
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!detail?.workspace) return;
    recordRecentWorkspace(detail.workspace.id, detail.workspace.title);
    setRecentTick((n) => n + 1);
  }, [detail?.workspace.id, detail?.workspace.title]);

  useEffect(() => {
    if (isDemo) return;

    const es = new EventSource(getWorkspaceMessageStreamUrl(workspaceId), {
      withCredentials: true,
    });

    es.onmessage = (event) => {
      if (!event.data) return;

      try {
        const incoming = normalizeWorkspaceMessage(JSON.parse(event.data));
        if (!incoming?.id) return;
        if (incoming.workspace_id && incoming.workspace_id !== workspaceId) return;

        setDetail((current) =>
          current
            ? {
                ...current,
                messages: mergeMessage(current.messages, incoming),
              }
            : current,
        );
      } catch {
        // Ignore malformed keepalive or diagnostic events from the stream.
      }
    };

    return () => {
      es.close();
    };
  }, [isDemo, workspaceId]);

  const agents = useMemo(() => detail?.agents ?? [], [detail?.agents]);
  const pointers = useMemo(
    () => (detail?.pointers ?? []).slice().sort((a, b) => a.sort_order - b.sort_order),
    [detail?.pointers],
  );
  const activeCount = agents.filter((a) => a.status === 'active').length;
  const viewerAgentIds = useMemo(() => {
    const viewerId = isDemo ? DEMO_VIEWER.userId : user?.id;
    return agents
      .filter((a) => a.status === 'active' && viewerId && a.user_id === viewerId)
      .map((a) => a.id);
  }, [agents, isDemo, user?.id]);
  const summary = siblings.find((s) => s.id === workspaceId);
  const runCount = summary?.run_count ?? 0;
  const tokenCount = summary?.total_tokens ?? 0;
  const handles = agents.map((a) => a.handle);
  const recents = useMemo(
    () => resolveRecentWorkspaces(siblings),
    [siblings, recentTick],
  );

  const sendMessage = async (
    text: string,
    files: WorkspaceFileRef[],
    pingUserIds: string[] = [],
  ) => {
    if (!senderId) return;
    const sender = agents.find((a) => a.id === senderId);
    const ids = new Set(pingUserIds);
    const tokens = Array.from((text || '').matchAll(/@([a-z0-9_-]+)/gi)).map((m) =>
      m[1].toLowerCase(),
    );
    for (const person of people) {
      const handle = person.ping_handle?.trim().toLowerCase();
      if (handle && tokens.includes(handle)) ids.add(person.user_id);
    }
    if (tokens.includes('owner')) {
      const owner = people.find((person) => person.is_owner);
      if (owner) ids.add(owner.user_id);
    }
    if (tokens.includes('user') && sender?.user_id) ids.add(sender.user_id);
    try {
      const resolved = await api.resolveWorkspaceMentions(workspaceId, {
        message_text: text,
        sender_member_id: senderId,
      });
      for (const ping of resolved.pinged_users ?? []) {
        if (ping.user_id) ids.add(ping.user_id);
      }
    } catch {
      // Older APIs still accept ping_user_ids computed locally.
    }
    await api.createWorkspaceMessage(workspaceId, {
      sender_member_id: senderId,
      message_text: text || null,
      file_refs: files,
      ping_user_ids: ids.size ? [...ids] : undefined,
    });
    await load();
  };

  const createPointer = async (title: string, assigneeMemberId?: string | null) => {
    await api.createWorkspacePointer(workspaceId, {
      title,
      created_by_member_id: senderId,
      ...(assigneeMemberId ? { assignee_member_id: assigneeMemberId } : {}),
    });
    await load();
  };

  const updatePointer = async (
    id: string,
    payload: { status?: WorkspacePointerStatus; assignee_member_id?: string | null },
  ) => {
    await api.updateWorkspacePointer(workspaceId, id, payload);
    await load();
  };

  const deletePointer = async (id: string) => {
    await api.deleteWorkspacePointer(workspaceId, id);
    await load();
  };

  const inviteAgent = async (handle: string, roleLabel: string) => {
    const response = await api.createWorkspaceAgent(workspaceId, {
      handle,
      role_label: roleLabel || null,
    });
    setIssued(response);
    await load();
  };

  const rotateKey = async (agentId: string) => {
    const response = await api.rotateWorkspaceAgentKey(workspaceId, agentId);
    setIssued(response);
  };

  const removeAgent = async (agentId: string) => {
    await api.updateWorkspaceAgent(workspaceId, agentId, { status: 'removed' });
    await load();
  };

  const updateAgent = async (
    agentId: string,
    payload: { handle?: string; role_label?: string | null; status?: WorkspaceAgentStatus },
  ) => {
    await api.updateWorkspaceAgent(workspaceId, agentId, payload);
    await load();
  };

  const saveBrief = async (payload: { title?: string; task?: string | null }) => {
    await api.updateWorkspace(workspaceId, payload);
    await load();
  };

  useWorkspaceShortcuts(
    {
      focusComposer: () => {
        setTab('conversation');
        setComposerFocus((n) => n + 1);
      },
      newTask: () => {
        setTaskDraft('');
        setTab('tasks');
        setTaskFocus((n) => n + 1);
      },
      inviteAgent: () => {
        setTab('agents');
        setInviteOpen((n) => n + 1);
      },
      toggleHelp: () => setHelpOpen((open) => !open),
      closeOverlays: () => {
        setHelpOpen(false);
        setInviteLinkOpen(false);
      },
    },
    !issued && !agentsMdOpen,
  );

  const shellHeight = 'h-[calc(100dvh-48px)] lg:h-dvh';

  if (!detail && !error) {
    return (
      <div className={cn('workspace-room flex flex-col bg-[var(--bg-app)]', shellHeight)}>
        <div className="flex h-[56px] shrink-0 items-center border-b border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] px-4 sm:px-6">
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="px-4 pt-5 sm:px-6">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="mt-3 h-4 w-full max-w-[560px]" />
          <Skeleton className="mt-4 h-4 w-72" />
          <div className="mt-6 flex gap-5 pb-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-4 w-20" />
            ))}
          </div>
        </div>
        <div className="flex-1 border-t border-[var(--stroke-soft-200)] px-4 py-6 sm:px-6">
          <Skeleton className="h-14 w-full max-w-[880px]" />
          <Skeleton className="mt-3 h-14 w-3/4 max-w-[680px]" />
        </div>
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className={cn('workspace-room bg-[var(--bg-app)]', shellHeight)}>
        <div className="mx-auto max-w-[640px] px-6 py-10">
          <ErrorBanner message={error} onDismiss={() => setError(null)} onRetry={load} />
          <Link
            href="/dashboard/workspaces"
            className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-[var(--primary-dark)] hover:underline"
          >
            <ArrowLeft size={14} /> Back to workspaces
          </Link>
        </div>
      </div>
    );
  }

  const workspace = detail!.workspace;
  const doneCount = pointers.filter((p) => p.status === 'done').length;
  const activeAgents = agents.filter((a) => a.status === 'active');
  const fileCount = detail!.messages.reduce((n, m) => n + m.file_refs.length, 0);
  const runsShown = runsTotal ?? runCount;
  const tabs: Array<{ key: Tab; label: string; icon: LucideIcon; count?: number | string }> = [
    { key: 'conversation', label: 'Conversation', icon: MessagesSquare, count: detail!.messages.length },
    { key: 'agents', label: 'Agents', icon: Bot, count: activeCount },
    {
      key: 'tasks',
      label: 'Tasks',
      icon: ListChecks,
      count: pointers.length ? `${doneCount}/${pointers.length}` : 0,
    },
    { key: 'runs', label: 'Runs', icon: Activity, count: formatCompactNumber(runsShown) },
    { key: 'settings', label: 'Settings', icon: Settings2 },
    { key: 'files', label: 'Files', icon: Paperclip, count: fileCount },
  ];

  const openAddAgent = () => {
    setTab('agents');
    setInviteOpen((n) => n + 1);
  };

  return (
    <AgentHueProvider handles={agents.map((a) => a.handle)}>
      <div className={cn('workspace-room flex min-w-0 flex-col bg-[var(--bg-app)]', shellHeight)}>
        <div className="flex h-[56px] shrink-0 items-center gap-2 border-b border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] px-4 sm:px-6">
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center text-[14px] tracking-[-0.02em]">
            <Link
              href="/dashboard/workspaces"
              className="shrink-0 font-medium text-[var(--neutral-soft-400)] transition-colors hover:text-[var(--neutral-strong-950)]"
            >
              Workspaces
            </Link>
            <span className="mx-[7px] text-[var(--neutral-soft-400)]" aria-hidden>
              ·
            </span>
            <WorkspaceSwitcher
              title={workspace.title}
              workspaces={siblings}
              meta={siblingMeta}
              currentId={workspaceId}
              recents={recents}
            />
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <span className="hidden sm:contents">
              <SampleDataChip />
            </span>
            <button
              type="button"
              onClick={() => requestGuidedTour()}
              aria-label="Guided tour of this section"
              title="Guided tour of this section"
              className="flex size-8 items-center justify-center rounded-[8px] text-[var(--neutral-sub-600)] outline-none transition-colors hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)] focus-visible:ring-2 focus-visible:ring-[var(--primary-alpha-24)]"
            >
              <CircleHelp size={16} />
            </button>
            <UserMenu />
          </div>
        </div>

        <header data-tour="ws-header" className="shrink-0 px-4 pt-5 sm:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-6">
            <div className="min-w-0 flex-1">
              <h1 data-tour="ws-title" className="text-[22px] font-semibold leading-[1.3] tracking-[-0.022em] text-[var(--neutral-strong-950)]">
                <InlineEdit
                  value={workspace.title}
                  ariaLabel="Workspace name"
                  placeholder="Untitled workspace"
                  onCommit={(title) => saveBrief({ title: title || 'Untitled workspace' })}
                  className="w-full text-[22px] font-semibold tracking-[-0.022em]"
                  readClassName="whitespace-normal! [overflow-wrap:anywhere]"
                  editSignal={titleEdit}
                />
              </h1>
              <div data-tour="ws-goal" className="mt-1 max-w-[88ch] text-[13.5px] leading-[1.6] text-[var(--neutral-sub-600)]">
                <InlineEdit
                  value={workspace.task ?? ''}
                  ariaLabel="Workspace goal"
                  placeholder="No goal defined. Click to add one."
                  multiline
                  onCommit={(task) => saveBrief({ task: task || null })}
                  className="text-[13.5px] leading-[1.6]"
                  readClassName="max-md:line-clamp-2"
                  renderRead={(text) => <MentionText text={text} knownHandles={handles} />}
                />
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={<Pencil size={12} />}
                onClick={() => setTitleEdit((n) => n + 1)}
              >
                Rename
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={<Link2 size={13} />}
                onClick={() => setInviteLinkOpen(true)}
              >
                Invite
              </Button>
              <Button variant="primary" size="sm" leadingIcon={<UserPlus size={13} />} onClick={openAddAgent}>
                Add agent
              </Button>
            </div>
          </div>

          <div data-tour="ws-stats" className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-[var(--neutral-sub-600)]">
            <button
              type="button"
              onClick={() => setTab('agents')}
              className="flex items-center gap-2 rounded-[6px] outline-none transition-colors hover:text-[var(--neutral-strong-950)] focus-visible:ring-2 focus-visible:ring-[var(--primary-alpha-24)]"
              title={activeAgents.map((a) => `@${a.handle}${a.role_label ? ` · ${a.role_label}` : ''}`).join('\n') || 'No agents yet'}
            >
              {activeAgents.length > 0 && (
                <span className="flex items-center">
                  {activeAgents.slice(0, 5).map((a, i) => (
                    <span
                      key={a.id}
                      className="overflow-hidden rounded-[6px] ring-2 ring-[var(--bg-app)]"
                      style={{ marginLeft: i === 0 ? 0 : -6, zIndex: 5 - i }}
                    >
                      <AgentGlyph handle={a.handle} roleLabel={a.role_label} size="sm" />
                    </span>
                  ))}
                  {activeAgents.length > 5 && (
                    <span className="ml-1.5 tabular-nums text-[var(--neutral-soft-400)]">+{activeAgents.length - 5}</span>
                  )}
                </span>
              )}
              <HeaderStat value={String(activeCount)} label={activeCount === 1 ? 'agent' : 'agents'} />
            </button>
            <button
              type="button"
              onClick={() => setTab('runs')}
              className="rounded-[6px] outline-none transition-colors hover:text-[var(--neutral-strong-950)] focus-visible:ring-2 focus-visible:ring-[var(--primary-alpha-24)]"
            >
              <HeaderStat value={formatCompactNumber(runsShown)} label={runsShown === 1 ? 'run' : 'runs'} />
            </button>
            <span title={`${tokenCount.toLocaleString()} tokens`}>
              <HeaderStat value={formatCompactNumber(tokenCount)} label="tokens" />
            </span>
            {people.length > 0 && (
              <span title={people.map((p) => p.name).join(', ')}>
                <HeaderStat value={String(people.length)} label={people.length === 1 ? 'person' : 'people'} />
              </span>
            )}
          </div>
        </header>

        <nav
          data-tour="ws-sections"
          aria-label="Workspace sections"
          className="mt-3 flex shrink-0 items-center gap-1 overflow-x-auto border-b border-[var(--stroke-soft-200)] px-2 [scrollbar-width:none] sm:px-4"
        >
          {tabs.map((item) => {
            const Icon = item.icon;
            const selected = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                aria-current={selected ? 'page' : undefined}
                className={cn(
                  'relative flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-t-[6px] px-2.5 text-[13px] font-medium outline-none transition-colors focus-visible:bg-[var(--neutral-weak-50)]',
                  selected
                    ? 'text-[var(--neutral-strong-950)]'
                    : 'text-[var(--neutral-sub-600)] hover:text-[var(--neutral-strong-950)]',
                )}
              >
                <Icon
                  size={15}
                  strokeWidth={1.9}
                  className={selected ? 'text-[var(--neutral-strong-950)]' : 'text-[var(--neutral-soft-400)]'}
                />
                {item.label}
                {item.count !== undefined && (
                  <span className="rounded-full bg-[var(--neutral-weak-50)] px-1.5 text-[11px] leading-[18px] tabular-nums text-[var(--neutral-sub-600)]">
                    {item.count}
                  </span>
                )}
                {selected && (
                  <span aria-hidden className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-[var(--primary-base)]" />
                )}
              </button>
            );
          })}
        </nav>

        {error && (
          <div className="px-4 pt-3 sm:px-6">
            <ErrorBanner message={error} onDismiss={() => setError(null)} onRetry={load} />
          </div>
        )}

        <div className="relative min-h-0 flex-1">
          {tab === 'conversation' && (
            <div className="flex h-full min-h-0 flex-col">
              <AgentChat
                messages={detail!.messages}
                agents={agents}
                people={people}
                viewerAgentIds={viewerAgentIds}
                workspaceTitle={workspace.title}
                focusMessageId={focusMessageId}
                onCreateTask={(message) => {
                  setTaskDraft(taskTitleFrom(message.message_text));
                  setTab('tasks');
                  setTaskFocus((n) => n + 1);
                }}
                onViewRuns={(handle) => {
                  setRunsAgent(handle);
                  setTab('runs');
                }}
              />
              <div data-tour="ws-composer" className="shrink-0 border-t border-[var(--stroke-soft-200)] bg-[var(--bg-app)]">
                <Composer
                  agents={agents}
                  people={people}
                  senderId={senderId}
                  onSend={sendMessage}
                  focusSignal={composerFocus}
                />
              </div>
            </div>
          )}

          <div className={cn('h-full min-h-0 overflow-hidden', tab !== 'agents' && 'hidden')}>
            <AgentRoster
              workspaceId={workspaceId}
              workspaceTitle={detail!.workspace.title}
              agents={agents}
              onInvite={inviteAgent}
              onRotate={rotateKey}
              onRemove={removeAgent}
              onUpdate={updateAgent}
              openInviteSignal={inviteOpen}
            />
          </div>

          <div className={cn('h-full min-h-0 overflow-hidden', tab !== 'tasks' && 'hidden')}>
            <TaskChecklist
              pointers={pointers}
              agents={agents}
              viewerAgentIds={viewerAgentIds}
              onCreate={createPointer}
              onUpdate={updatePointer}
              onDelete={deletePointer}
              focusSignal={taskFocus}
              focusDraft={taskDraft}
            />
          </div>

          <div className={cn('h-full min-h-0 overflow-y-auto', tab !== 'runs' && 'hidden')}>
            <WorkspaceRunsPanel
              workspaceId={workspaceId}
              onTotalChange={setRunsTotal}
              agentFilter={runsAgent}
              onAgentFilterChange={setRunsAgent}
            />
          </div>

          {tab === 'settings' && (
            <WorkspaceSettingsPanel
              workspace={workspace}
              people={people}
              theme={theme}
              onThemeChange={setTheme}
              onEditDetails={() => setEditOpen(true)}
              onOpenAgentsMd={() => setAgentsMdOpen(true)}
              onInvitePeople={() => setInviteLinkOpen(true)}
              onAddAgent={openAddAgent}
            />
          )}

          {tab === 'files' && (
            <FilesPanel
              messages={detail!.messages}
              agents={agents}
              onOpenConversation={() => setTab('conversation')}
            />
          )}
        </div>

        <WorkspaceOnboardingProvider workspaceId={workspaceId} section={tab} ready={Boolean(detail)} />
        <AgentKeyDialog open={!!issued} onOpenChange={(open) => !open && setIssued(null)} issued={issued} />
        <WorkspaceAgentsMdDialog open={agentsMdOpen} onOpenChange={setAgentsMdOpen} />
        <ShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
        <InviteWorkspaceDialog
          workspaceId={workspaceId}
          workspaceTitle={workspace.title}
          open={inviteLinkOpen}
          onOpenChange={setInviteLinkOpen}
        />
        <EditWorkspaceDialog
          workspace={editOpen ? workspace : null}
          onOpenChange={(open) => !open && setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            void load();
          }}
        />
      </div>
    </AgentHueProvider>
  );
}

function taskTitleFrom(text: string | null) {
  const flat = (text ?? '').replace(/\s+/g, ' ').trim();
  return flat.length > 120 ? `${flat.slice(0, 117).trimEnd()}…` : flat;
}

function HeaderStat({ value, label }: { value: string; label: string }) {
  return (
    <span>
      <span className="font-medium tabular-nums text-[var(--neutral-strong-950)]">{value}</span> {label}
    </span>
  );
}

function WorkspaceSwitcher({
  title,
  workspaces,
  meta,
  currentId,
  recents,
}: {
  title: string;
  workspaces: WorkspaceSummary[];
  meta: Record<string, SiblingMeta>;
  currentId: string;
  recents: ReturnType<typeof resolveRecentWorkspaces>;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Switch workspace, current: ${title}`}
        onClick={() => setOpen((v) => !v)}
        className="-mx-1.5 flex min-w-0 items-center gap-1 rounded-[7px] px-1.5 py-1 font-semibold text-[var(--neutral-strong-950)] outline-none transition-colors hover:bg-[var(--neutral-weak-50)] focus-visible:bg-[var(--neutral-weak-50)]"
      >
        <span className="truncate">{title}</span>
        <ChevronDown size={14} className={cn('shrink-0 text-[var(--neutral-soft-400)] transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div
          role="menu"
          onClick={(event) => {
            if ((event.target as HTMLElement).closest('a')) setOpen(false);
          }}
          className="absolute left-0 top-[calc(100%+8px)] z-40 flex max-h-[min(480px,70vh)] w-[300px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] text-[13px] tracking-normal shadow-[0_12px_32px_rgba(0,0,0,0.28)]"
        >
          <RoomSidebar workspaces={workspaces} meta={meta} currentId={currentId} recents={recents} />
        </div>
      )}
    </div>
  );
}
