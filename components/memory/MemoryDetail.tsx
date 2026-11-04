'use client';

import type { ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  FileText,
  Link2,
  Pencil,
  Pin,
  PinOff,
  Share2,
  Trash2,
} from 'lucide-react';
import { MarkdownContent } from '@/components/ui/MarkdownContent';
import { RelativeTime } from '@/components/ui/RelativeTime';
import type { Memory } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatDate } from './memory-model';

export function MemoryDetail({
  memory,
  shareCount,
  shareCountFailed,
  pinning,
  copied,
  hasMemories,
  onBack,
  onPin,
  onEdit,
  onCopy,
  onShare,
  onDelete,
}: {
  memory: Memory | null;
  shareCount: number | undefined;
  shareCountFailed: boolean;
  pinning: boolean;
  copied: boolean;
  hasMemories: boolean;
  onBack: () => void;
  onPin: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  if (!memory) {
    return (
      <section
        aria-label="Memory detail"
        className="hidden min-h-0 flex-col items-center justify-center rounded-[12px] border border-[var(--mm-border)] bg-[var(--mm-panel)] px-8 text-center lg:flex lg:h-full"
      >
        <span className="flex size-10 items-center justify-center rounded-[10px] bg-[var(--mm-elevated)] text-[var(--mm-mint)]">
          <FileText size={18} />
        </span>
        <p className="mt-4 text-[15px] font-semibold text-[var(--mm-text)]">
          {hasMemories ? 'Select a memory to read it' : 'Nothing to show yet'}
        </p>
        <p className="mt-1.5 max-w-[360px] text-[13px] leading-[1.6] text-[var(--mm-muted)]">
          {hasMemories
            ? 'Pick a memory from the library to read its full content, see who it is shared with, and edit or pin it.'
            : 'Memories you create or import will open here for reading and editing.'}
        </p>
        {hasMemories && (
          <p className="mt-5 flex items-center gap-1.5 text-[11.5px] text-[var(--mm-muted)]">
            <Kbd>
              <ArrowUp size={11} />
            </Kbd>
            <Kbd>
              <ArrowDown size={11} />
            </Kbd>
            to move through the list
            <span aria-hidden className="mx-1">·</span>
            <Kbd>/</Kbd>
            to search
          </p>
        )}
      </section>
    );
  }

  const created = formatDate(memory.created_at);
  const updated = memory.updated_at ?? null;
  const shared = typeof shareCount === 'number' && shareCount > 0;

  return (
    <section
      aria-label="Memory detail"
      className="flex min-h-0 flex-col overflow-hidden rounded-[12px] border border-[var(--mm-border)] bg-[var(--mm-panel)] lg:h-full"
    >
      <header className="shrink-0 border-b border-[var(--mm-border)] px-6 pb-4 pt-4">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="-ml-1.5 inline-flex h-7 items-center gap-1 rounded-[7px] px-1.5 text-[12.5px] font-medium text-[var(--mm-text-2)] transition-colors duration-150 hover:bg-[var(--mm-elevated)] hover:text-[var(--mm-text)] lg:hidden"
          >
            <ArrowLeft size={14} />
            Library
          </button>
          <div data-tour="memory-detail-actions" className="ml-auto flex items-center gap-1">
            <DetailAction
              label={memory.is_pinned ? 'Unpin' : 'Pin'}
              onClick={onPin}
              disabled={pinning}
              active={Boolean(memory.is_pinned)}
            >
              {memory.is_pinned ? <PinOff size={14} /> : <Pin size={14} />}
            </DetailAction>
            <DetailAction label={copied ? 'Copied' : 'Copy'} onClick={onCopy}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </DetailAction>
            <DetailAction label="Share" onClick={onShare}>
              <Share2 size={14} />
            </DetailAction>
            <DetailAction label="Delete" onClick={onDelete} danger>
              <Trash2 size={14} />
            </DetailAction>
            <button
              type="button"
              onClick={onEdit}
              className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-[8px] bg-[var(--mm-elevated)] px-3 text-[12.5px] font-medium text-[var(--mm-text)] ring-1 ring-inset ring-[var(--mm-border-strong)] transition-colors duration-150 hover:bg-[var(--mm-selected)]"
            >
              <Pencil size={13} />
              Edit
            </button>
          </div>
        </div>

        <h2 className="mt-3 break-words text-[22px] font-semibold leading-[1.25] tracking-[-0.02em] text-[var(--mm-text)]">
          {memory.title}
        </h2>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-[var(--mm-muted)]">
          {memory.is_pinned && (
            <span className="inline-flex h-5 items-center gap-1 rounded-[5px] bg-[rgba(0,184,121,0.12)] px-1.5 text-[11px] font-medium text-[var(--mm-mint)]">
              <Pin size={11} className="rotate-45" />
              Pinned
            </span>
          )}
          <span
            className={cn(
              'inline-flex h-5 items-center gap-1 rounded-[5px] px-1.5 text-[11px] font-medium',
              shared
                ? 'bg-[rgba(85,188,229,0.12)] text-[#7FCDEB]'
                : 'bg-[rgba(162,179,169,0.10)] text-[var(--mm-text-2)]',
            )}
          >
            <Link2 size={11} />
            {shareCount === undefined
              ? shareCountFailed
                ? 'Sharing status unavailable'
                : 'Checking sharing…'
              : shared
                ? `Shared · ${shareCount} active ${shareCount === 1 ? 'link' : 'links'}`
                : 'Private'}
          </span>
          {updated && (
            <span>
              Updated <RelativeTime timestamp={updated} />
            </span>
          )}
          {created && <span>Created {created}</span>}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="max-w-[72ch] text-[14px] [&_.markdown-content_p]:text-[14px] [&_.markdown-content_li]:text-[14px]">
          <MarkdownContent content={memory.memory} />
        </div>
      </div>
    </section>
  );
}

function DetailAction({
  label,
  onClick,
  disabled,
  danger,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2 text-[12.5px] font-medium transition-colors duration-150 disabled:opacity-50 xl:px-2.5',
        danger
          ? 'text-[var(--mm-muted)] hover:bg-[rgba(240,120,120,0.10)] hover:text-[var(--mm-red)]'
          : active
            ? 'text-[var(--mm-mint)] hover:bg-[var(--mm-elevated)]'
            : 'text-[var(--mm-text-2)] hover:bg-[var(--mm-elevated)] hover:text-[var(--mm-text)]',
      )}
    >
      {children}
      <span className="hidden xl:inline">{label}</span>
    </button>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] bg-[var(--mm-elevated)] px-1 text-[10.5px] text-[var(--mm-text-2)]">
      {children}
    </kbd>
  );
}
