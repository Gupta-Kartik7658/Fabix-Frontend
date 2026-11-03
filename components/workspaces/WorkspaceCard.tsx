'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AtSign, ExternalLink, Link2, MoreHorizontal, Pencil, UserPlus } from 'lucide-react';
import type { WorkspaceAgent, WorkspaceSummary } from '@/lib/api';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { cn, formatCompactNumber, formatRelativeTime } from '@/lib/utils';
import { AgentGlyph, AgentHueProvider, MentionText } from './agent-visuals';
import {
  ACTIVITY_HINT,
  ACTIVITY_LABEL,
  formatCreatedDate,
  lastActivityAt,
  type WorkspaceActivity,
} from './workspace-list-model';

const DESKTOP_SLOTS = 5;
const MOBILE_SLOTS = 3;

export function ActivityBadge({ activity }: { activity: WorkspaceActivity }) {
  return (
    <span
      title={ACTIVITY_HINT[activity]}
      className={cn(
        'inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full border border-[var(--ws-border)] bg-[var(--ws-surface-2)] px-2 text-[11.5px] font-medium',
        activity === 'active' ? 'text-[var(--ws-text)]' : 'text-[var(--ws-text-2)]',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'size-1.5 rounded-full',
          activity === 'active' && 'bg-[var(--ws-success)]',
          activity === 'idle' && 'bg-[var(--ws-text-3)]',
          activity === 'unused' && 'border border-[var(--ws-text-3)]',
        )}
      />
      {ACTIVITY_LABEL[activity]}
    </span>
  );
}

export type CardActions = {
  onEdit: () => void;
  onInvite: () => void;
  onCopyLink: () => void;
  onRequestAgents: () => void;
};

export function WorkspaceCard({
  workspace,
  activity,
  agents,
  actions,
}: {
  workspace: WorkspaceSummary;
  activity: WorkspaceActivity;
  /** Full member records when loaded; handles from the summary otherwise. */
  agents: WorkspaceAgent[] | undefined;
  actions: CardActions;
}) {
  const href = `/workspaces/${workspace.id}`;
  const handles = workspace.agent_handles ?? agents?.filter((a) => a.status === 'active').map((a) => a.handle) ?? [];
  const unread = workspace.unread_mention_count ?? 0;
  const failed = workspace.failed_run_count ?? 0;
  const last = lastActivityAt(workspace);
  const created = formatCreatedDate(workspace.created_at);

  const metrics = [
    { label: 'Messages', value: workspace.message_count },
    { label: 'Task pointers', value: workspace.pointer_count ?? 0 },
    { label: 'Executions', value: workspace.run_count ?? 0 },
    { label: 'Tokens', value: workspace.total_tokens ?? 0 },
  ];

  return (
    <article
      className="group relative rounded-[12px] border border-[var(--ws-border)] bg-[var(--ws-surface)] transition-colors hover:border-[var(--ws-border-strong)]"
      data-workspace-id={workspace.id}
    >
      <div className="px-4 pb-4 pt-4 sm:px-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
              <h3 className="min-w-0 max-w-full">
                <Link
                  href={href}
                  className="block truncate text-[15px] font-semibold tracking-[-0.015em] text-[var(--ws-text)] outline-none after:absolute after:inset-0 after:rounded-[12px] after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-[rgba(57,185,130,0.45)]"
                >
                  {workspace.title}
                </Link>
              </h3>
              <ActivityBadge activity={activity} />
              {unread > 0 && (
                <span
                  className="inline-flex h-[22px] items-center gap-1 rounded-full border border-[var(--ws-border)] px-2 text-[11.5px] font-medium tabular-nums text-[var(--ws-warning)]"
                  title={`${unread} unread mention${unread === 1 ? '' : 's'}`}
                >
                  <AtSign className="size-3" strokeWidth={2.2} />
                  {unread}
                </span>
              )}
              {failed > 0 && (
                <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full border border-[var(--ws-border)] px-2 text-[11.5px] font-medium tabular-nums text-[var(--ws-error)]">
                  <span aria-hidden className="size-1.5 rounded-full bg-[var(--ws-error)]" />
                  {failed} failed
                </span>
              )}
            </div>
            <p className="mt-1 text-[12px] text-[var(--ws-text-3)]">
              {created ? `Created ${created}` : 'Created'}
              <span aria-hidden> · </span>
              {last ? (
                <>
                  Last activity <RelativeTime timestamp={last} />
                </>
              ) : (
                'No activity yet'
              )}
            </p>
          </div>

          <div className="relative z-10 flex shrink-0 items-center gap-1.5">
            <Link
              href={href}
              tabIndex={-1}
              className="hidden h-8 items-center rounded-[8px] border border-[var(--ws-border)] bg-[var(--ws-surface)] px-3 text-[12.5px] font-medium text-[var(--ws-text)] transition-colors hover:border-[var(--ws-border-strong)] hover:bg-[var(--ws-surface-2)] sm:inline-flex"
            >
              Open
            </Link>
            <CardMenu workspace={workspace} href={href} actions={actions} />
          </div>
        </div>

        <div className="relative mt-3 max-w-[90ch]">
          {workspace.task?.trim() ? (
            <p className="line-clamp-2 min-h-[39px] text-[13px] leading-[1.5] text-[var(--ws-text-2)]">
              <MentionText text={workspace.task} knownHandles={handles} />
            </p>
          ) : (
            <p className="flex min-h-[39px] items-start gap-2 text-[13px] leading-[1.5] text-[var(--ws-text-3)]">
              No goal defined
              <button
                type="button"
                onClick={actions.onEdit}
                className="relative z-10 rounded-[5px] text-[12.5px] font-medium text-[var(--ws-text-2)] underline-offset-4 outline-none hover:text-[var(--ws-text)] hover:underline focus-visible:underline"
              >
                Add goal
              </button>
            </p>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[var(--ws-border)] px-4 py-3.5 sm:grid-cols-3 sm:px-5 lg:grid-cols-5">
        <div className="col-span-2 min-w-0 sm:col-span-1">
          <dt className="text-[11.5px] text-[var(--ws-text-3)]">Agents</dt>
          <dd className="mt-1.5 flex items-center gap-2">
            <span className="text-[15px] font-semibold tabular-nums text-[var(--ws-text)]">
              {formatCompactNumber(workspace.agent_count)}
            </span>
            {handles.length > 0 && (
              <AgentStack
                handles={handles}
                agents={agents}
                onRequestAgents={actions.onRequestAgents}
              />
            )}
          </dd>
        </div>
        {metrics.map((m) => (
          <div key={m.label} className="min-w-0">
            <dt className="truncate text-[11.5px] text-[var(--ws-text-3)]">{m.label}</dt>
            <dd
              className={cn(
                'mt-1.5 text-[15px] font-semibold leading-[22px] tabular-nums',
                m.value > 0 ? 'text-[var(--ws-text)]' : 'text-[var(--ws-text-2)]',
              )}
              title={m.value.toLocaleString()}
            >
              {formatCompactNumber(m.value)}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function AgentStack({
  handles,
  agents,
  onRequestAgents,
}: {
  handles: string[];
  agents: WorkspaceAgent[] | undefined;
  onRequestAgents: () => void;
}) {
  const [open, setOpen] = useState(false);
  const shown = handles.slice(0, DESKTOP_SLOTS);
  const desktopOverflow = handles.length - shown.length;
  const mobileOverflow = handles.length - Math.min(handles.length, MOBILE_SLOTS);
  const byHandle = new Map((agents ?? []).map((a) => [a.handle.toLowerCase(), a]));

  const show = () => {
    setOpen(true);
    onRequestAgents();
  };

  return (
    <AgentHueProvider handles={handles}>
      <span
        className="relative z-10 inline-flex"
        onMouseEnter={show}
        onMouseLeave={() => setOpen(false)}
      >
        <button
          type="button"
          onFocus={show}
          onBlur={() => setOpen(false)}
          onClick={() => (open ? setOpen(false) : show())}
          aria-expanded={open}
          aria-label={`Agents: ${handles.map((h) => `@${h}`).join(', ')}`}
          className="flex h-[22px] items-center rounded-[7px] outline-none focus-visible:ring-2 focus-visible:ring-[rgba(57,185,130,0.45)]"
        >
          {shown.map((handle, index) => (
            <span
              key={handle}
              className={cn(
                'overflow-hidden rounded-[6px] ring-2 ring-[var(--ws-surface)]',
                index >= MOBILE_SLOTS && 'hidden sm:block',
              )}
              style={{ marginLeft: index === 0 ? 0 : -6, zIndex: shown.length - index }}
            >
              <AgentGlyph handle={handle} size="sm" />
            </span>
          ))}
          {mobileOverflow > 0 && (
            <span className="ml-1.5 text-[11.5px] tabular-nums text-[var(--ws-text-2)] sm:hidden">+{mobileOverflow}</span>
          )}
          {desktopOverflow > 0 && (
            <span className="ml-1.5 hidden text-[11.5px] tabular-nums text-[var(--ws-text-2)] sm:inline">+{desktopOverflow}</span>
          )}
        </button>

        {open && (
          <div
            role="tooltip"
            className="absolute left-0 top-full z-30 w-[260px] pt-2"
          >
            <div className="rounded-[10px] border border-[var(--ws-border)] bg-[var(--ws-surface-2)] p-1.5 shadow-[0_12px_28px_rgba(0,0,0,0.35)]">
              <p className="px-2 pb-1 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--ws-text-3)]">
                {handles.length} agent{handles.length === 1 ? '' : 's'} in this workspace
              </p>
              <ul className="max-h-[220px] overflow-y-auto">
                {handles.map((handle) => {
                  const agent = byHandle.get(handle.toLowerCase());
                  return (
                    <li key={handle} className="flex items-center gap-2.5 rounded-[7px] px-2 py-1.5">
                      <AgentGlyph handle={handle} roleLabel={agent?.role_label} size="md" />
                      <div className="min-w-0">
                        <p className="truncate font-mono text-[12px] text-[var(--ws-text)]">@{handle}</p>
                        <p className="truncate text-[11.5px] text-[var(--ws-text-3)]">
                          {agent
                            ? [agent.role_label, `joined ${formatRelativeTime(agent.created_at)}`]
                                .filter(Boolean)
                                .join(' · ')
                            : agents
                              ? 'Active member'
                              : 'Loading details…'}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </span>
    </AgentHueProvider>
  );
}

function CardMenu({
  workspace,
  href,
  actions,
}: {
  workspace: WorkspaceSummary;
  href: string;
  actions: CardActions;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  const item =
    'flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-2 text-left text-[12.5px] text-[var(--ws-text)] outline-none hover:bg-[var(--ws-hover)] focus-visible:bg-[var(--ws-hover)]';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`More options for ${workspace.title}`}
        className={cn(
          'flex size-8 items-center justify-center rounded-[8px] text-[var(--ws-text-2)] outline-none transition-colors hover:bg-[var(--ws-surface-2)] hover:text-[var(--ws-text)] focus-visible:ring-2 focus-visible:ring-[rgba(57,185,130,0.45)]',
          open && 'bg-[var(--ws-surface-2)] text-[var(--ws-text)]',
        )}
      >
        <MoreHorizontal className="size-4" strokeWidth={2} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1.5 w-[210px] rounded-[10px] border border-[var(--ws-border)] bg-[var(--ws-surface-2)] p-1 shadow-[0_12px_28px_rgba(0,0,0,0.35)]"
        >
          <Link role="menuitem" href={href} className={item} onClick={() => setOpen(false)}>
            <ExternalLink className="size-3.5 text-[var(--ws-text-3)]" strokeWidth={2} />
            Open workspace
          </Link>
          <button type="button" role="menuitem" className={item} onClick={run(actions.onEdit)}>
            <Pencil className="size-3.5 text-[var(--ws-text-3)]" strokeWidth={2} />
            Edit name and goal
          </button>
          <button type="button" role="menuitem" className={item} onClick={run(actions.onInvite)}>
            <UserPlus className="size-3.5 text-[var(--ws-text-3)]" strokeWidth={2} />
            Invite people
          </button>
          <button type="button" role="menuitem" className={item} onClick={run(actions.onCopyLink)}>
            <Link2 className="size-3.5 text-[var(--ws-text-3)]" strokeWidth={2} />
            Copy link
          </button>
        </div>
      )}
    </div>
  );
}
