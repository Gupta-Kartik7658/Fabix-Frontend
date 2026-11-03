'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { BookOpen, Link2, Pencil, Pin, PinOff, Plus, SearchX, Share2 } from 'lucide-react';
import { RelativeTime } from '@/components/ui/RelativeTime';
import type { Memory } from '@/lib/types';
import { cn } from '@/lib/utils';
import { plainTextFromMarkdown, type MemoryDensity } from './memory-model';

export function MemoryExplorer({
  pinned,
  rest,
  total,
  selectedId,
  shareCounts,
  density,
  busyIds,
  loading,
  query,
  filtered,
  onSelect,
  onPin,
  onEdit,
  onShare,
  onCreate,
  onClearFilters,
}: {
  pinned: Memory[];
  rest: Memory[];
  total: number;
  selectedId: string | null;
  shareCounts: Record<string, number>;
  density: MemoryDensity;
  busyIds: Set<string>;
  loading: boolean;
  query: string;
  filtered: boolean;
  onSelect: (memory: Memory) => void;
  onPin: (memory: Memory) => void;
  onEdit: (memory: Memory) => void;
  onShare: (memory: Memory) => void;
  onCreate: () => void;
  onClearFilters: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedId) return;
    const node = listRef.current?.querySelector<HTMLElement>(`[data-memory-id="${CSS.escape(selectedId)}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  const shown = pinned.length + rest.length;

  return (
    <section
      aria-label="Memory explorer"
      className="flex min-h-0 flex-col overflow-hidden rounded-[12px] border border-[var(--mm-border)] bg-[var(--mm-panel)] lg:h-full"
    >
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--mm-border)] px-4">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--mm-text)]">Library</h2>
        {!loading && (
          <span className="text-[12px] tabular-nums text-[var(--mm-muted)]">
            {filtered ? `${shown.toLocaleString()} of ${total.toLocaleString()}` : `${total.toLocaleString()} total`}
          </span>
        )}
      </header>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
        {loading && <ExplorerSkeleton />}

        {!loading && total === 0 && (
          <ExplorerEmpty
            icon={<BookOpen size={17} />}
            title="Start your memory library"
            body="Save rules, decisions and context once. Your agents can recall them in every session."
            action={
              <button
                type="button"
                onClick={onCreate}
                className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-[8px] bg-[var(--mm-green)] px-3 text-[12.5px] font-semibold text-[#04130c] transition-colors duration-150 hover:bg-[var(--mm-mint)]"
              >
                <Plus size={14} />
                New memory
              </button>
            }
          />
        )}

        {!loading && total > 0 && shown === 0 && (
          <ExplorerEmpty
            icon={<SearchX size={17} />}
            title="No memories match"
            body={
              query.trim()
                ? `Nothing in your titles or content matches “${query.trim()}”.`
                : 'No memories match this filter.'
            }
            action={
              <button
                type="button"
                onClick={onClearFilters}
                className="mt-3 text-[12.5px] font-medium text-[var(--mm-mint)] transition-colors duration-150 hover:text-[var(--mm-text)]"
              >
                Clear search and filters
              </button>
            }
          />
        )}

        {!loading && pinned.length > 0 && (
          <ExplorerGroup label="Pinned" count={pinned.length}>
            {pinned.map((memory) => (
              <MemoryListRow
                key={memory.id}
                memory={memory}
                selected={memory.id === selectedId}
                shareCount={shareCounts[memory.id]}
                density={density}
                busy={busyIds.has(memory.id)}
                onSelect={onSelect}
                onPin={onPin}
                onEdit={onEdit}
                onShare={onShare}
              />
            ))}
          </ExplorerGroup>
        )}

        {!loading && rest.length > 0 && (
          <ExplorerGroup label={pinned.length > 0 ? 'Everything else' : 'All memories'} count={rest.length}>
            {rest.map((memory) => (
              <MemoryListRow
                key={memory.id}
                memory={memory}
                selected={memory.id === selectedId}
                shareCount={shareCounts[memory.id]}
                density={density}
                busy={busyIds.has(memory.id)}
                onSelect={onSelect}
                onPin={onPin}
                onEdit={onEdit}
                onShare={onShare}
              />
            ))}
          </ExplorerGroup>
        )}
      </div>
    </section>
  );
}

function ExplorerGroup({ label, count, children }: { label: string; count: number; children: ReactNode }) {
  return (
    <div>
      <div className="sticky top-0 z-[1] flex items-center gap-2 bg-[var(--mm-panel)] px-4 pb-1.5 pt-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--mm-muted)]">{label}</span>
        <span className="text-[11px] tabular-nums text-[var(--mm-muted)]">{count}</span>
      </div>
      <ul role="listbox" aria-label={label} className="px-2 pb-1">
        {children}
      </ul>
    </div>
  );
}

function MemoryListRow({
  memory,
  selected,
  shareCount,
  density,
  busy,
  onSelect,
  onPin,
  onEdit,
  onShare,
}: {
  memory: Memory;
  selected: boolean;
  shareCount: number | undefined;
  density: MemoryDensity;
  busy: boolean;
  onSelect: (memory: Memory) => void;
  onPin: (memory: Memory) => void;
  onEdit: (memory: Memory) => void;
  onShare: (memory: Memory) => void;
}) {
  const preview = plainTextFromMarkdown(memory.memory);
  const shared = typeof shareCount === 'number' && shareCount > 0;
  const timestamp = memory.updated_at ?? memory.created_at;

  return (
    <li
      role="option"
      aria-selected={selected}
      data-memory-id={memory.id}
      className={cn(
        'group relative border-b border-[var(--mm-border)] last:border-b-0',
        busy && 'opacity-60',
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(memory)}
        className={cn(
          'my-0.5 block w-full rounded-[9px] px-3 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgba(0,184,121,0.45)]',
          density === 'compact' ? 'py-2' : 'py-3',
          selected ? 'bg-[var(--mm-selected)]' : 'hover:bg-[rgba(242,247,243,0.03)]',
        )}
      >
        <div className="flex items-center gap-2">
          {memory.is_pinned && (
            <Pin size={12} aria-label="Pinned" className="shrink-0 rotate-45 text-[var(--mm-mint)]" />
          )}
          <h3 className="min-w-0 flex-1 truncate text-[14px] font-semibold tracking-[-0.01em] text-[var(--mm-text)]">
            {memory.title}
          </h3>
          <span className="flex shrink-0 items-center gap-2 text-[11.5px] text-[var(--mm-muted)] transition-opacity duration-150 md:group-hover:opacity-0 md:group-focus-within:opacity-0">
            {shared && (
              <span className="inline-flex items-center gap-1 text-[var(--mm-text-2)]" title={`${shareCount} active share ${shareCount === 1 ? 'link' : 'links'}`}>
                <Link2 size={12} />
                <span className="tabular-nums">{shareCount}</span>
              </span>
            )}
            {timestamp && <RelativeTime timestamp={timestamp} />}
          </span>
        </div>
        {density === 'comfortable' && preview && (
          <p className="mt-1 line-clamp-2 text-[13px] leading-[1.5] text-[var(--mm-text-2)]">{preview}</p>
        )}
      </button>

      <div className="pointer-events-none absolute right-2.5 top-2.5 hidden items-center gap-0.5 rounded-[7px] bg-[var(--mm-elevated)] p-0.5 opacity-0 ring-1 ring-inset ring-[var(--mm-border)] transition-opacity duration-150 md:flex md:group-hover:pointer-events-auto md:group-hover:opacity-100 md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100">
        <QuickAction
          label={memory.is_pinned ? 'Unpin' : 'Pin'}
          disabled={busy}
          onClick={() => onPin(memory)}
        >
          {memory.is_pinned ? <PinOff size={13} /> : <Pin size={13} />}
        </QuickAction>
        <QuickAction label="Edit" disabled={busy} onClick={() => onEdit(memory)}>
          <Pencil size={13} />
        </QuickAction>
        <QuickAction label="Share" disabled={busy} onClick={() => onShare(memory)}>
          <Share2 size={13} />
        </QuickAction>
      </div>
    </li>
  );
}

function QuickAction({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="flex size-6 items-center justify-center rounded-[5px] text-[var(--mm-muted)] transition-colors duration-150 hover:bg-[var(--mm-border)] hover:text-[var(--mm-text)] disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function ExplorerEmpty({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="flex size-9 items-center justify-center rounded-[9px] bg-[var(--mm-elevated)] text-[var(--mm-mint)]">
        {icon}
      </span>
      <p className="mt-3.5 text-[14px] font-semibold text-[var(--mm-text)]">{title}</p>
      <p className="mt-1 max-w-[300px] text-[12.5px] leading-[1.55] text-[var(--mm-muted)]">{body}</p>
      {action}
    </div>
  );
}

function ExplorerSkeleton() {
  return (
    <div aria-hidden className="px-2 pt-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="border-b border-[var(--mm-border)] px-3 py-3.5 last:border-b-0">
          <div className="flex items-center justify-between gap-3">
            <div className="h-3.5 w-36 animate-pulse rounded-[4px] bg-[var(--mm-elevated)] motion-reduce:animate-none" />
            <div className="h-3 w-10 animate-pulse rounded-[4px] bg-[var(--mm-elevated)] motion-reduce:animate-none" />
          </div>
          <div className="mt-2.5 h-3 w-full animate-pulse rounded-[4px] bg-[var(--mm-elevated)] motion-reduce:animate-none" />
          <div className="mt-1.5 h-3 w-2/3 animate-pulse rounded-[4px] bg-[var(--mm-elevated)] motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}
