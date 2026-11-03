'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bot, KeyRound, Link2, Pencil, Plus } from 'lucide-react';
import {
  api,
  type WorkspaceAgent,
  type WorkspaceAgentStatus,
  type WorkspaceRun,
} from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { cn, formatCompactNumber } from '@/lib/utils';
import { AgentGlyph, RESERVED_PING_HANDLES, normalizeHandle } from './agent-visuals';
import { PanelEmpty } from './PanelEmpty';
import { InviteWorkspaceDialog } from './InviteWorkspaceDialog';
import { Dialog } from './Dialog';
import { Field } from './Field';

type AgentRunStats = {
  runs: number;
  tokens: number | null;
  lastAt: string | null;
};

async function rollupRunsByHandle(workspaceId: string): Promise<Record<string, AgentRunStats>> {
  const byHandle: Record<string, AgentRunStats> = {};
  const limit = 100;
  let offset = 0;
  let total = Infinity;
  const cap = 2000;

  const absorb = (run: WorkspaceRun) => {
    const handle = run.agent_handle?.replace(/^@/, '').toLowerCase();
    if (!handle) return;
    const current = byHandle[handle] ?? { runs: 0, tokens: null, lastAt: null };
    current.runs += 1;
    if (run.token_count != null) {
      current.tokens = (current.tokens ?? 0) + run.token_count;
    }
    if (run.timestamp && (!current.lastAt || run.timestamp > current.lastAt)) {
      current.lastAt = run.timestamp;
    }
    byHandle[handle] = current;
  };

  while (offset < total && offset < cap) {
    const page = await api.getWorkspaceRuns(workspaceId, { limit, offset });
    total = page.total;
    page.items.forEach(absorb);
    if (page.items.length === 0) break;
    offset += page.items.length;
  }
  return byHandle;
}

const ROW_GRID = 'md:grid md:grid-cols-[minmax(0,1fr)_88px_104px_128px_196px] md:items-center md:gap-4';

export function AgentRoster({
  workspaceId,
  workspaceTitle,
  agents,
  onInvite,
  onRotate,
  onRemove,
  onUpdate,
  openInviteSignal = 0,
}: {
  workspaceId: string;
  workspaceTitle: string;
  agents: WorkspaceAgent[];
  onInvite: (handle: string, roleLabel: string) => Promise<void>;
  onRotate: (agentId: string) => Promise<void>;
  onRemove: (agentId: string) => Promise<void>;
  onUpdate: (
    agentId: string,
    payload: { handle?: string; role_label?: string | null; status?: WorkspaceAgentStatus },
  ) => Promise<void>;
  /** Bumped by the parent to open the add-agent modal, e.g. from the `i` shortcut. */
  openInviteSignal?: number;
}) {
  const [inviting, setInviting] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [handle, setHandle] = useState('');
  const [role, setRole] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<WorkspaceAgent | null>(null);
  const [editing, setEditing] = useState<WorkspaceAgent | null>(null);
  const [editHandle, setEditHandle] = useState('');
  const [editRole, setEditRole] = useState('');
  const [stats, setStats] = useState<Record<string, AgentRunStats> | null>(null);

  useEffect(() => {
    if (openInviteSignal > 0) setInviting(true);
  }, [openInviteSignal]);

  useEffect(() => {
    let cancelled = false;
    void rollupRunsByHandle(workspaceId)
      .then((next) => {
        if (!cancelled) setStats(next);
      })
      .catch(() => {
        if (!cancelled) setStats({});
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, agents.length]);

  const ordered = useMemo(
    () =>
      [...agents].sort((a, b) => {
        if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
        return a.handle.localeCompare(b.handle);
      }),
    [agents],
  );

  const active = agents.filter((a) => a.status === 'active');
  const revokedCount = agents.length - active.length;
  const normalized = normalizeHandle(handle);
  const duplicate = active.some((a) => a.handle.toLowerCase() === normalized);
  const reserved = RESERVED_PING_HANDLES.has(normalized);
  const editNormalized = normalizeHandle(editHandle);
  const editReserved = RESERVED_PING_HANDLES.has(editNormalized);
  const editDuplicate =
    Boolean(editing) &&
    active.some(
      (a) => a.id !== editing?.id && a.handle.toLowerCase() === editNormalized,
    );

  const closeAdd = () => {
    if (busy) return;
    setInviting(false);
    setHandle('');
    setRole('');
    setError(null);
  };

  const submit = async () => {
    if (!normalized || duplicate || reserved || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onInvite(normalized, role.trim());
      setHandle('');
      setRole('');
      setInviting(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the agent.');
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editing || !editNormalized || editDuplicate || editReserved || busy) return;
    setBusy(true);
    try {
      await onUpdate(editing.id, {
        handle: editNormalized,
        role_label: editRole.trim() || null,
      });
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the agent.');
    } finally {
      setBusy(false);
    }
  };

  const restoreKey = async (agent: WorkspaceAgent) => {
    setBusy(true);
    try {
      if (agent.status === 'removed') {
        await onUpdate(agent.id, { status: 'active' });
      }
      await onRotate(agent.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <div className="flex max-w-[1080px] flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1">
              <h2 className="text-[14px] font-semibold text-[var(--neutral-strong-950)]">Agents</h2>
              <p className="mt-0.5 text-[12.5px] text-[var(--neutral-sub-600)]">
                {active.length} active{revokedCount > 0 ? ` · ${revokedCount} revoked` : ''}. Each agent
                authenticates with its own one-time key.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<Link2 size={13} />}
              onClick={() => setLinkOpen(true)}
            >
              Invite via link
            </Button>
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<Plus size={13} />}
              onClick={() => setInviting(true)}
            >
              Add agent
            </Button>
          </div>

          {ordered.length === 0 ? (
            <div className="rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)]">
              <PanelEmpty
                icon={Bot}
                title="No agents yet"
                hint="Add an agent to issue its one-time key, or invite another user's agent with a link."
              />
            </div>
          ) : (
            <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)]">
              <div
                className={cn(
                  'hidden border-b border-[var(--stroke-soft-200)] px-4 py-2 text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]',
                  ROW_GRID,
                )}
              >
                <span>Agent</span>
                <span className="text-right">Runs</span>
                <span className="text-right">Tokens</span>
                <span>Last execution</span>
                <span className="sr-only">Actions</span>
              </div>
              <ul className="divide-y divide-[var(--stroke-soft-200)]">
                {ordered.map((agent) => {
                  const rollup = stats?.[agent.handle.toLowerCase()];
                  const revoked = agent.status === 'removed';
                  const runs = stats ? formatCompactNumber(rollup?.runs ?? 0) : '…';
                  const tokens = !stats ? '…' : rollup?.tokens != null ? formatCompactNumber(rollup.tokens) : '—';
                  return (
                    <li
                      key={agent.id}
                      className={cn('flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-[var(--neutral-weak-50)]/50', ROW_GRID)}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <AgentGlyph handle={agent.handle} roleLabel={agent.role_label} />
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate font-mono text-[13px] font-semibold text-[var(--neutral-strong-950)]">
                              @{agent.handle}
                            </span>
                            {revoked && (
                              <span className="shrink-0 rounded-[5px] bg-[var(--neutral-weak-50)] px-1.5 py-px text-[11px] font-medium text-[var(--neutral-sub-600)]">
                                Revoked
                              </span>
                            )}
                          </div>
                          <p className="truncate text-[12px] text-[var(--neutral-sub-600)]">
                            {agent.role_label || 'No role set'}
                            <span className="text-[var(--neutral-soft-400)]">
                              {' · joined '}
                              <RelativeTime timestamp={agent.created_at} />
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 pl-11 text-[12px] text-[var(--neutral-sub-600)] md:contents">
                        <span className="tabular-nums md:text-right md:text-[13px] md:text-[var(--neutral-strong-950)]">
                          {runs}
                          <span className="ml-1 text-[var(--neutral-soft-400)] md:hidden">runs</span>
                        </span>
                        <span
                          className="tabular-nums md:text-right md:text-[13px] md:text-[var(--neutral-strong-950)]"
                          title={stats && rollup?.tokens == null ? 'Runs did not report token usage' : undefined}
                        >
                          {tokens}
                          <span className="ml-1 text-[var(--neutral-soft-400)] md:hidden">tokens</span>
                        </span>
                        <span className="text-[var(--neutral-sub-600)] md:text-[12.5px]">
                          {!stats ? '…' : rollup?.lastAt ? <RelativeTime timestamp={rollup.lastAt} /> : 'No runs yet'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 pl-11 md:justify-end md:pl-0">
                        {revoked ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            leadingIcon={<KeyRound size={13} />}
                            disabled={busy}
                            onClick={() => void restoreKey(agent)}
                          >
                            Generate a new key
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              leadingIcon={<Pencil size={12} />}
                              onClick={() => {
                                setEditing(agent);
                                setEditHandle(agent.handle);
                                setEditRole(agent.role_label ?? '');
                              }}
                            >
                              Edit
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => setConfirmRemove(agent)}>
                              Revoke
                            </Button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={inviting}
        onOpenChange={(open) => (open ? setInviting(true) : closeAdd())}
        title="Add an agent"
        description="Register an agent you run. Its one-time key is shown once, right after it's added."
        width={480}
        fullWidthOnMobile
        footer={
          <>
            <Button
              variant="ghost"
              size="md"
              leadingIcon={<Link2 size={13} />}
              className="mr-auto"
              onClick={() => {
                closeAdd();
                setLinkOpen(true);
              }}
            >
              Invite via link
            </Button>
            <Button variant="ghost" size="md" onClick={closeAdd} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={!normalized || duplicate || reserved || busy}
              onClick={() => void submit()}
            >
              {busy ? 'Adding…' : 'Add agent'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Handle" hint="Used to @mention the agent. Letters, numbers, - and _.">
            <Input
              autoFocus
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="e.g. backend"
              invalid={!!normalized && (duplicate || reserved)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit();
              }}
            />
          </Field>
          <Field label="Role" optional>
            <Input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Backend engineer agent"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit();
              }}
            />
          </Field>
          {duplicate && (
            <p className="text-[12px] text-[var(--error-dark)]">@{normalized} is already in this workspace.</p>
          )}
          {reserved && (
            <p className="text-[12px] text-[var(--error-dark)]">@{normalized} is reserved for people pings.</p>
          )}
          {error && <p className="text-[12px] text-[var(--error-dark)]">{error}</p>}
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!confirmRemove}
        onOpenChange={(open) => !open && setConfirmRemove(null)}
        title={confirmRemove ? `Revoke @${confirmRemove.handle}?` : 'Revoke agent?'}
        description="Its key stops working immediately and it can no longer post here. Past messages stay in the workspace history."
        confirmLabel="Revoke"
        variant="danger"
        onConfirm={async () => {
          if (confirmRemove) await onRemove(confirmRemove.id);
          setConfirmRemove(null);
        }}
      />

      <Dialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing ? `Edit @${editing.handle}` : 'Edit agent'}
        width={480}
        fullWidthOnMobile
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setEditing(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={!editNormalized || editDuplicate || editReserved || busy}
              onClick={() => void saveEdit()}
            >
              Save changes
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Handle">
            <Input
              value={editHandle}
              onChange={(e) => setEditHandle(e.target.value)}
              placeholder="handle"
              invalid={editDuplicate || editReserved}
            />
          </Field>
          <Field label="Role" optional>
            <Input
              value={editRole}
              onChange={(e) => setEditRole(e.target.value)}
              placeholder="role label"
            />
          </Field>
          {editDuplicate && (
            <p className="text-[12px] text-[var(--error-dark)]">@{editNormalized} is already in this workspace.</p>
          )}
          {editReserved && (
            <p className="text-[12px] text-[var(--error-dark)]">@{editNormalized} is reserved for people pings.</p>
          )}
        </div>
      </Dialog>

      <InviteWorkspaceDialog
        workspaceId={workspaceId}
        workspaceTitle={workspaceTitle}
        open={linkOpen}
        onOpenChange={setLinkOpen}
      />
    </div>
  );
}