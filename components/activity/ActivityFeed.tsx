'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Inbox, Search, SearchX, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ActivityRow } from './ActivityRow';
import {
  ACTIVITY_FILTERS,
  sortByTimeDesc,
  type ActivityFilter,
  type ActivityItem,
} from './activity-model';
import { ACSkeleton } from './activity-ui';

type ReadState = 'all' | 'unread';

export function ActivityFeed({
  items,
  loading,
  error,
  onRetry,
  markingId,
  onMarkRead,
  onCopied,
  hasMore,
  loadingMore,
  autoLoad,
  onLoadMore,
}: {
  items: ActivityItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  markingId: string | null;
  onMarkRead: (id: string) => void;
  onCopied: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  /** Off after a failed page so the scroll sentinel does not retry in a loop. */
  autoLoad: boolean;
  onLoadMore: () => void;
}) {
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [readState, setReadState] = useState<ReadState>('all');
  const [workspace, setWorkspace] = useState<string>('all');
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;
      if (event.key === '/' && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const workspaceOptions = useMemo(() => {
    const titles = new Map<string, string>();
    for (const item of items) {
      if (item.workspaceId && item.workspaceTitle) titles.set(item.workspaceId, item.workspaceTitle);
    }
    return [...titles.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  const activeWorkspace = workspaceOptions.some(([id]) => id === workspace) ? workspace : 'all';

  const unreadByFilter = useMemo(() => {
    const counts: Record<ActivityFilter, number> = { all: 0, mention: 0, task: 0, workspace: 0, system: 0 };
    for (const item of items) {
      if (!item.isNew) continue;
      counts.all += 1;
      counts[item.category] += 1;
    }
    return counts;
  }, [items]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items
      .filter((item) => filter === 'all' || item.category === filter)
      .filter((item) => readState === 'all' || item.isNew)
      .filter((item) => activeWorkspace === 'all' || item.workspaceId === activeWorkspace)
      .filter((item) => {
        if (!needle) return true;
        return [item.actor, item.message, item.workspaceTitle ?? '', item.typeLabel]
          .join(' ')
          .toLowerCase()
          .includes(needle);
      })
      .sort(sortByTimeDesc);
  }, [items, filter, readState, activeWorkspace, query]);

  const newItems = visible.filter((item) => item.isNew);
  const earlierItems = visible.filter((item) => !item.isNew);
  const anchorKey = newItems[0]?.key ?? earlierItems[0]?.key ?? null;
  const filtersActive =
    filter !== 'all' || readState !== 'all' || activeWorkspace !== 'all' || query.trim() !== '';

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || loadingMore || !autoLoad) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
      },
      { rootMargin: '240px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, autoLoad, onLoadMore]);

  const resetFilters = () => {
    setFilter('all');
    setReadState('all');
    setWorkspace('all');
    setQuery('');
  };

  return (
    <section aria-labelledby="activity-feed-heading" data-tour="activity-feed">
      <div className="flex items-baseline gap-2.5">
        <h2
          id="activity-feed-heading"
          className="text-[16px] font-semibold tracking-[-0.01em] text-[var(--ac-text)]"
        >
          Notifications
        </h2>
        {!loading && (
          <span className="text-[12px] tabular-nums text-[var(--ac-muted)]">
            {unreadByFilter.all.toLocaleString()} unread
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-3 border-b border-[var(--ac-border)] pb-3 xl:flex-row xl:items-center xl:justify-between">
        <div
          role="tablist"
          aria-label="Activity type"
          data-tour="activity-tabs"
          className="-mx-1 flex min-w-0 gap-0.5 overflow-x-auto px-1"
        >
          {ACTIVITY_FILTERS.map((option) => {
            const selected = filter === option.id;
            const count = unreadByFilter[option.id];
            return (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={selected}
                data-tour={`activity-tab-${option.id}`}
                onClick={() => setFilter(option.id)}
                className={cn(
                  'flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] px-2.5 text-[13px] font-medium transition-colors duration-150',
                  selected
                    ? 'bg-[var(--ac-elevated)] text-[var(--ac-text)]'
                    : 'text-[var(--ac-muted)] hover:bg-[rgba(242,247,243,0.03)] hover:text-[var(--ac-text-2)]',
                )}
              >
                {option.label}
                {!loading && count > 0 && (
                  <span
                    className={cn(
                      'min-w-[18px] rounded-full px-1.5 text-center text-[11px] tabular-nums leading-[18px]',
                      selected
                        ? 'bg-[rgba(0,184,121,0.18)] text-[var(--ac-mint)]'
                        : 'bg-[rgba(162,179,169,0.10)] text-[var(--ac-text-2)]',
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div data-tour="activity-filters" className="flex flex-wrap items-center gap-2 xl:shrink-0 xl:flex-nowrap">
          <div
            role="radiogroup"
            aria-label="Read state"
            data-tour="activity-filter-read"
            className="flex h-8 items-center rounded-[8px] bg-[var(--ac-card)] p-0.5 ring-1 ring-inset ring-[var(--ac-border)]"
          >
            {(['all', 'unread'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={readState === value}
                onClick={() => setReadState(value)}
                className={cn(
                  'h-full rounded-[6px] px-2 text-[12px] font-medium transition-colors duration-150',
                  readState === value
                    ? 'bg-[var(--ac-elevated)] text-[var(--ac-text)]'
                    : 'text-[var(--ac-muted)] hover:text-[var(--ac-text)]',
                )}
              >
                {value === 'all' ? 'All' : 'Unread'}
              </button>
            ))}
          </div>

          <div className="relative" data-tour="activity-filter-workspace">
            <label className="sr-only" htmlFor="activity-workspace">
              Workspace
            </label>
            <select
              id="activity-workspace"
              value={activeWorkspace}
              onChange={(event) => setWorkspace(event.target.value)}
              disabled={workspaceOptions.length === 0}
              className="h-8 max-w-[180px] appearance-none rounded-[8px] border-0 bg-[var(--ac-card)] pl-3 pr-8 text-[12.5px] text-[var(--ac-text-2)] ring-1 ring-inset ring-[var(--ac-border)] transition-colors duration-150 hover:text-[var(--ac-text)] focus:outline-none focus-visible:ring-[rgba(0,184,121,0.5)] disabled:opacity-50"
            >
              <option value="all">All workspaces</option>
              {workspaceOptions.map(([id, title]) => (
                <option key={id} value={id}>
                  {title}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--ac-muted)]"
            />
          </div>

          <div data-input-shell data-tour="activity-filter-search" className="flex h-8 w-full items-center rounded-[8px] bg-[var(--ac-card)] ring-1 ring-inset ring-[var(--ac-border)] transition-shadow duration-150 focus-within:ring-[rgba(0,184,121,0.5)] sm:w-[200px]">
            <Search size={14} className="ml-2.5 shrink-0 text-[var(--ac-muted)]" />
            <label htmlFor="activity-search" className="sr-only">
              Search notifications
            </label>
            <input
              id="activity-search"
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setQuery('');
                  event.currentTarget.blur();
                }
              }}
              placeholder="Search notifications"
              style={{ background: 'transparent', border: 0 }}
              className="h-full min-w-0 flex-1 px-2 text-[12.5px] text-[var(--ac-text)] placeholder:text-[var(--ac-muted)] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery('')}
                className="mr-1.5 flex size-5 items-center justify-center rounded-[5px] text-[var(--ac-muted)] hover:text-[var(--ac-text)]"
              >
                <X size={13} />
              </button>
            ) : (
              <kbd className="mr-2 rounded-[4px] bg-[var(--ac-elevated)] px-1.5 text-[10.5px] leading-[18px] text-[var(--ac-muted)]">
                /
              </kbd>
            )}
          </div>
        </div>
      </div>

      {loading && (
        <ul aria-hidden className="divide-y divide-[var(--ac-border)]">
          {Array.from({ length: 5 }).map((_, index) => (
            <li key={index} className="flex gap-3.5 px-4 py-4">
              <span className="w-2" />
              <ACSkeleton className="size-8 rounded-[8px]" />
              <div className="min-w-0 flex-1">
                <ACSkeleton className="h-3.5 w-52" />
                <ACSkeleton className="mt-2.5 h-3 w-full max-w-[560px]" />
                <ACSkeleton className="mt-3 h-3 w-28" />
              </div>
              <ACSkeleton className="h-3 w-12" />
            </li>
          ))}
        </ul>
      )}

      {!loading && error && (
        <div
          className={cn(
            'flex items-center justify-between gap-3 px-4',
            items.length === 0 ? 'py-12' : 'mt-3 rounded-[10px] bg-[rgba(240,120,120,0.08)] py-2.5',
          )}
        >
          <p className="text-[13px] text-[var(--ac-red)]">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 text-[12.5px] font-medium text-[var(--ac-text-2)] underline-offset-2 hover:text-[var(--ac-text)] hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !(error && items.length === 0) && visible.length === 0 && (
        <FeedEmpty filtered={filtersActive && items.length > 0} onReset={resetFilters} />
      )}

      {!loading && newItems.length > 0 && (
        <FeedGroup label="New" count={newItems.length}>
          {newItems.map((item) => (
            <ActivityRow
              key={item.key}
              item={item}
              anchored={item.key === anchorKey}
              marking={markingId === item.id}
              onMarkRead={onMarkRead}
              onCopied={onCopied}
            />
          ))}
        </FeedGroup>
      )}

      {!loading && earlierItems.length > 0 && (
        <FeedGroup label="Earlier" count={earlierItems.length}>
          {earlierItems.map((item) => (
            <ActivityRow
              key={item.key}
              item={item}
              anchored={item.key === anchorKey}
              marking={markingId === item.id}
              onMarkRead={onMarkRead}
              onCopied={onCopied}
            />
          ))}
        </FeedGroup>
      )}

      {!loading && hasMore && (
        <div ref={sentinelRef} className="flex justify-center border-t border-[var(--ac-border)] pt-4">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="text-[12.5px] font-medium text-[var(--ac-text-2)] transition-colors duration-150 hover:text-[var(--ac-text)] disabled:opacity-50"
          >
            {loadingMore ? 'Loading older notifications…' : 'Load older notifications'}
          </button>
        </div>
      )}
    </section>
  );
}

function FeedGroup({ label, count, children }: { label: string; count: number; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-3 px-4 pb-1 pt-5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--ac-muted)]">
          {label}
        </span>
        <span className="text-[11px] tabular-nums text-[var(--ac-muted)]">{count}</span>
        <span aria-hidden className="h-px flex-1 bg-[var(--ac-border)]" />
      </div>
      <ul className="divide-y divide-[var(--ac-border)]">{children}</ul>
    </div>
  );
}

function FeedEmpty({ filtered, onReset }: { filtered: boolean; onReset: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="flex size-10 items-center justify-center rounded-[10px] bg-[var(--ac-elevated)] text-[var(--ac-mint)]">
        {filtered ? <SearchX size={18} /> : <Inbox size={18} />}
      </span>
      <p className="mt-4 text-[14px] font-semibold text-[var(--ac-text)]">
        {filtered ? 'Nothing matches these filters' : "You're all caught up"}
      </p>
      <p className="mt-1.5 max-w-[400px] text-[13px] leading-[1.55] text-[var(--ac-muted)]">
        {filtered
          ? 'Try another type, workspace or search term.'
          : 'Mentions, tasks pointed at you, workspace invites and connector problems will show up here.'}
      </p>
      {filtered && (
        <button
          type="button"
          onClick={onReset}
          className="mt-4 text-[12.5px] font-medium text-[var(--ac-mint)] transition-colors duration-150 hover:text-[var(--ac-text)]"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
