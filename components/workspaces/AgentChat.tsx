'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import { Activity, AtSign, ListPlus, MessagesSquare, Paperclip } from 'lucide-react';
import type { WorkspaceAgent, WorkspaceMessage, WorkspacePerson } from '@/lib/api';
import { cn } from '@/lib/utils';
import { AgentGlyph, MentionText } from './agent-visuals';

function dayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(date, today)) return 'Today';
  if (same(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function fullTimeLabel(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Consecutive messages from one sender within this window share a header. */
const GROUP_WINDOW_MS = 5 * 60_000;

function pingChipLabel(
  pingedYou: boolean,
  mentionedYou: boolean,
  mentionedUserIds: string[],
  peopleById: Map<string, WorkspacePerson>,
): string | null {
  if (pingedYou || mentionedYou) return 'Mentioned you';
  if (mentionedUserIds.length === 0) return null;
  if (mentionedUserIds.length === 1) {
    const name = peopleById.get(mentionedUserIds[0])?.name?.trim();
    return name ? `Pinged ${name}` : 'Pinged a member';
  }
  return `Pinged ${mentionedUserIds.length} people`;
}

export function AgentChat({
  messages,
  agents,
  people = [],
  viewerAgentIds = [],
  workspaceTitle,
  focusMessageId = null,
  onCreateTask,
  onViewRuns,
}: {
  messages: WorkspaceMessage[];
  agents: WorkspaceAgent[];
  people?: WorkspacePerson[];
  viewerAgentIds?: string[];
  workspaceTitle: string;
  focusMessageId?: string | null;
  /** Opens the task composer seeded from this message. */
  onCreateTask?: (message: WorkspaceMessage) => void;
  /** Opens the Runs tab filtered to this agent. */
  onViewRuns?: (handle: string) => void;
}) {
  const reduce = useReducedMotion();
  const bottomRef = useRef<HTMLDivElement>(null);
  const byId = new Map(agents.map((a) => [a.id, a]));
  const peopleById = new Map(people.map((person) => [person.user_id, person]));
  const handles = agents.map((a) => a.handle);
  const peopleHandles = [
    'user',
    'owner',
    ...people.map((person) => person.ping_handle).filter(Boolean),
  ];

  useEffect(() => {
    if (focusMessageId) {
      const el = document.getElementById(`workspace-msg-${focusMessageId}`);
      el?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'end' });
  }, [messages.length, reduce, focusMessageId]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="max-w-[380px] text-center">
          <span className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] text-[var(--neutral-sub-600)]">
            <MessagesSquare size={18} />
          </span>
          <h3 className="text-[14px] font-semibold text-[var(--neutral-strong-950)]">
            This is the start of {workspaceTitle}
          </h3>
          <p className="mt-1 text-[12.5px] leading-[1.6] text-[var(--neutral-sub-600)]">
            Message the workspace, or @mention an agent to hand work to it.
          </p>
        </div>
      </div>
    );
  }

  const mentionsYou = (message: WorkspaceMessage) =>
    (viewerAgentIds ?? []).some((id) => message.mentioned_member_ids.includes(id));
  const needsAttention = (message: WorkspaceMessage) =>
    message.pinged_you === true || mentionsYou(message);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="w-full max-w-[960px] px-1 py-3 sm:px-3">
        {messages.map((message, index) => {
          const previous = index > 0 ? messages[index - 1] : null;
          const day = dayLabel(message.created_at);
          const showDay = !previous || dayLabel(previous.created_at) !== day;
          const sender = byId.get(message.sender_member_id);
          const mentionedYou = mentionsYou(message);
          const pingedYou = message.pinged_you === true;
          const mentionedUserIds = message.mentioned_user_ids ?? [];
          const isYou = Boolean(sender && (viewerAgentIds ?? []).includes(sender.id));
          const attention = pingedYou || mentionedYou;
          const continued =
            !showDay &&
            !attention &&
            previous !== null &&
            !needsAttention(previous) &&
            previous.sender_member_id === message.sender_member_id &&
            new Date(message.created_at).getTime() - new Date(previous.created_at).getTime() <
              GROUP_WINDOW_MS;

          return (
            <div key={message.id}>
              {showDay && (
                <div className="my-2 flex items-center gap-3 px-3 py-1">
                  <span className="h-px flex-1 bg-[var(--stroke-soft-200)]" />
                  <span className="rounded-full border border-[var(--stroke-soft-200)] bg-[var(--bg-app)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--neutral-sub-600)]">
                    {day}
                  </span>
                  <span className="h-px flex-1 bg-[var(--stroke-soft-200)]" />
                </div>
              )}
              <MessageRow
                message={message}
                sender={sender}
                handles={handles}
                peopleHandles={peopleHandles}
                pingLabel={pingChipLabel(pingedYou, mentionedYou, mentionedUserIds, peopleById)}
                attention={attention}
                isYou={isYou}
                continued={continued}
                focused={focusMessageId === message.id}
                onCreateTask={onCreateTask}
                onViewRuns={onViewRuns}
              />
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function MessageRow({
  message,
  sender,
  handles,
  peopleHandles,
  pingLabel,
  attention,
  isYou,
  continued,
  focused,
  onCreateTask,
  onViewRuns,
}: {
  message: WorkspaceMessage;
  sender?: WorkspaceAgent;
  handles: string[];
  peopleHandles: string[];
  pingLabel: string | null;
  attention: boolean;
  isYou: boolean;
  continued: boolean;
  focused: boolean;
  onCreateTask?: (message: WorkspaceMessage) => void;
  onViewRuns?: (handle: string) => void;
}) {
  const handle = sender?.handle ?? 'unknown';
  const relation = isYou ? 'You' : sender?.role_label || null;
  const actions = (
    <>
      {onCreateTask && (
        <ActionButton icon={ListPlus} label="Create task" onClick={() => onCreateTask(message)} />
      )}
      {onViewRuns && sender && (
        <ActionButton icon={Activity} label={`Runs by @${handle}`} onClick={() => onViewRuns(handle)} />
      )}
    </>
  );

  return (
    <div
      id={`workspace-msg-${message.id}`}
      className={cn(
        'group relative flex gap-3 rounded-[10px] px-3 transition-colors',
        continued ? 'py-0.5' : 'mt-1 pb-1.5 pt-2.5',
        attention
          ? 'my-1.5 bg-[rgba(229,173,89,0.03)] pb-2.5'
          : 'hover:bg-[var(--bg-surface)]',
        focused && 'ring-1 ring-[var(--warning)]/60',
      )}
    >
      {attention && (
        <span aria-hidden className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-[var(--warning)]" />
      )}

      <div className="w-8 shrink-0">
        {continued ? (
          <span className="block pt-[3px] text-right text-[10.5px] tabular-nums text-[var(--neutral-soft-400)] opacity-0 group-hover:opacity-100">
            {timeLabel(message.created_at)}
          </span>
        ) : (
          <AgentGlyph handle={handle} roleLabel={sender?.role_label} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        {!continued && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-mono text-[13px] font-semibold text-[var(--neutral-strong-950)]">
              @{handle}
            </span>
            {relation && <span className="text-[12px] text-[var(--neutral-sub-600)]">{relation}</span>}
            <time
              dateTime={message.created_at}
              title={fullTimeLabel(message.created_at)}
              className="text-[11.5px] tabular-nums text-[var(--neutral-soft-400)]"
            >
              {timeLabel(message.created_at)}
            </time>
            {pingLabel && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-[5px] px-1.5 py-px text-[11px] font-medium',
                  attention
                    ? 'bg-[rgba(229,173,89,0.12)] text-[var(--warning-dark)]'
                    : 'bg-[var(--neutral-weak-50)] text-[var(--neutral-sub-600)]',
                )}
              >
                <AtSign size={10} strokeWidth={2.4} />
                {pingLabel}
              </span>
            )}
            {sender?.status === 'removed' && (
              <span className="rounded-[5px] bg-[var(--neutral-weak-50)] px-1.5 py-px text-[11px] text-[var(--neutral-sub-600)]">
                Revoked
              </span>
            )}
          </div>
        )}

        {message.message_text && (
          <p className="mt-0.5 max-w-[76ch] whitespace-pre-wrap break-words text-[13.5px] leading-[1.65] text-[var(--neutral-strong-950)]">
            <MentionText
              text={message.message_text}
              knownHandles={handles}
              peopleHandles={peopleHandles}
              tone="primary"
            />
          </p>
        )}

        {message.file_refs.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.file_refs.map((f) => {
              const linkable = Boolean(f.url && f.url !== '#');
              const body = (
                <>
                  <Paperclip size={12} className="shrink-0 text-[var(--neutral-soft-400)]" />
                  <span className="max-w-[28ch] truncate font-mono text-[var(--neutral-strong-950)]">{f.filename}</span>
                  <span className="tabular-nums text-[var(--neutral-soft-400)]">{formatSize(f.size)}</span>
                </>
              );
              const cls =
                'inline-flex items-center gap-1.5 rounded-[7px] border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] px-2 py-1 text-[11.5px]';
              return linkable ? (
                <a
                  key={f.file_id ?? f.filename}
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(cls, 'transition-colors hover:border-[var(--stroke-sub-300)]')}
                >
                  {body}
                </a>
              ) : (
                <span key={f.file_id ?? f.filename} className={cls}>
                  {body}
                </span>
              );
            })}
          </div>
        )}

        {attention && <div className="mt-2 flex flex-wrap items-center gap-1">{actions}</div>}
      </div>

      {!attention && (
        <div className="absolute -top-3 right-3 z-[2] hidden items-center gap-0.5 rounded-[8px] border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] p-0.5 shadow-[0_4px_12px_rgba(0,0,0,0.18)] group-focus-within:flex group-hover:flex">
          {actions}
        </div>
      )}
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof ListPlus;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-7 items-center gap-1.5 rounded-[6px] px-2 text-[12px] text-[var(--neutral-sub-600)] outline-none transition-colors hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)] focus-visible:bg-[var(--neutral-weak-50)] focus-visible:text-[var(--neutral-strong-950)]"
    >
      <Icon size={13} />
      {label}
    </button>
  );
}
