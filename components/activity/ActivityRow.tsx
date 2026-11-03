'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Link2, MailPlus, MoreHorizontal, Plug } from 'lucide-react';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { AgentGlyph } from '@/components/workspaces/agent-visuals';
import { cn } from '@/lib/utils';
import { CATEGORY_TONE, type ActivityItem } from './activity-model';
import { ToneBadge } from './activity-ui';

export function ActivityRow({
  item,
  marking,
  onMarkRead,
  onCopied,
}: {
  item: ActivityItem;
  marking: boolean;
  onMarkRead: (id: string) => void;
  onCopied: () => void;
}) {
  const unread = item.isNew;

  return (
    <li className="group relative">
      <div
        className={cn(
          'flex gap-3.5 px-4 py-4 transition-colors duration-150 hover:bg-[rgba(242,247,243,0.025)]',
        )}
      >
        <span className="flex w-2 shrink-0 justify-center pt-[13px]" aria-hidden>
          <span
            className={cn(
              'size-[7px] rounded-full transition-opacity duration-200',
              unread ? 'bg-[var(--ac-green)]' : 'opacity-0',
            )}
          />
        </span>
        {unread && <span className="sr-only">Unread.</span>}

        <div className={cn('shrink-0 pt-0.5', !unread && 'opacity-60')}>
          <ActivityAvatar item={item} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={cn(
                'truncate text-[13.5px] font-semibold',
                item.actorIsHandle && 'font-mono text-[13px]',
                unread ? 'text-[var(--ac-text)]' : 'text-[var(--ac-text-2)]',
              )}
            >
              {item.actorIsHandle ? `@${item.actor}` : item.actor}
            </span>
            <ToneBadge tone={unread ? CATEGORY_TONE[item.category] : 'muted'}>{item.typeLabel}</ToneBadge>
            {item.workspaceTitle && (
              <span className="flex min-w-0 items-center gap-2 text-[12px] text-[var(--ac-muted)]">
                <span aria-hidden>·</span>
                <span className="truncate">{item.workspaceTitle}</span>
              </span>
            )}
          </div>

          <p
            className={cn(
              'mt-1 line-clamp-2 text-[13.5px] leading-[1.5]',
              unread ? 'text-[var(--ac-text)]' : 'text-[var(--ac-muted)]',
            )}
          >
            {item.message}
          </p>

          {(item.primaryAction || (item.markable && unread)) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              {item.primaryAction && (
                <Link
                  href={item.primaryAction.href}
                  className={cn(
                    'inline-flex items-center gap-1 text-[12.5px] font-medium transition-colors duration-150',
                    unread
                      ? 'text-[var(--ac-mint)] hover:text-[var(--ac-text)]'
                      : 'text-[var(--ac-text-2)] hover:text-[var(--ac-text)]',
                  )}
                >
                  {item.primaryAction.label}
                  <ArrowRight size={13} className="transition-transform duration-150 group-hover:translate-x-0.5" />
                </Link>
              )}
              {item.markable && unread && (
                <button
                  type="button"
                  onClick={() => onMarkRead(item.id)}
                  disabled={marking}
                  className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--ac-muted)] transition-colors duration-150 hover:text-[var(--ac-text)] disabled:opacity-40"
                >
                  <Check size={13} strokeWidth={2.25} />
                  {marking ? 'Marking…' : 'Mark read'}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <RelativeTime
            timestamp={item.createdAt}
            className="whitespace-nowrap text-[12px] text-[var(--ac-muted)]"
          />
          <RowMenu item={item} marking={marking} onMarkRead={onMarkRead} onCopied={onCopied} />
        </div>
      </div>
    </li>
  );
}

function ActivityAvatar({ item }: { item: ActivityItem }) {
  if (item.category === 'system') {
    return (
      <span className="flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-[rgba(240,120,120,0.10)] text-[var(--ac-red)]">
        <Plug size={15} strokeWidth={2} />
      </span>
    );
  }
  if (!item.actorIsHandle) {
    return (
      <span className="flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-[var(--ac-elevated)] text-[var(--ac-text-2)]">
        <MailPlus size={15} strokeWidth={2} />
      </span>
    );
  }
  return <AgentGlyph handle={item.actor} size="md" />;
}

function RowMenu({
  item,
  marking,
  onMarkRead,
  onCopied,
}: {
  item: ActivityItem;
  marking: boolean;
  onMarkRead: (id: string) => void;
  onCopied: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const copyHref = item.primaryAction?.href ?? item.menuActions[0]?.href ?? null;
  const canMark = item.markable && item.isNew;
  if (item.menuActions.length === 0 && !copyHref && !canMark) return null;

  const copyLink = async () => {
    if (!copyHref) return;
    try {
      await navigator.clipboard.writeText(new URL(copyHref, window.location.origin).toString());
      onCopied();
    } catch {
      // Clipboard can be blocked outside secure contexts.
    }
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'flex size-7 items-center justify-center rounded-[7px] text-[var(--ac-muted)] transition-all duration-150 hover:bg-[var(--ac-elevated)] hover:text-[var(--ac-text)] focus-visible:opacity-100',
          open
            ? 'bg-[var(--ac-elevated)] text-[var(--ac-text)] opacity-100'
            : 'opacity-100 md:opacity-0 md:group-hover:opacity-100',
        )}
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-8 z-30 w-[200px] overflow-hidden rounded-[10px] border border-[var(--ac-border)] bg-[var(--ac-elevated)] py-1"
        >
          {canMark && (
            <MenuButton
              onClick={() => {
                onMarkRead(item.id);
                setOpen(false);
              }}
              disabled={marking}
            >
              <Check size={13} /> Mark as read
            </MenuButton>
          )}
          {item.menuActions.map((action) => (
            <Link
              key={action.href + action.label}
              role="menuitem"
              href={action.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-1.5 text-[12.5px] text-[var(--ac-text-2)] transition-colors duration-150 hover:bg-[var(--ac-card)] hover:text-[var(--ac-text)]"
            >
              <ArrowRight size={13} /> {action.label}
            </Link>
          ))}
          {copyHref && (
            <MenuButton onClick={() => void copyLink()}>
              <Link2 size={13} /> Copy link
            </MenuButton>
          )}
        </div>
      )}
    </div>
  );
}

function MenuButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] text-[var(--ac-text-2)] transition-colors duration-150 hover:bg-[var(--ac-card)] hover:text-[var(--ac-text)] disabled:opacity-40"
    >
      {children}
    </button>
  );
}
