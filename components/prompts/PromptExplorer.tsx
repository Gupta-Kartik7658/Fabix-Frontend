'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ChevronDown, Copy, CopyPlus, FilePlus2, MoreHorizontal, ScrollText, Search, SearchX, Trash2, X } from 'lucide-react';
import { RelativeTime } from '@/components/ui/RelativeTime';
import type { UserPrompt } from '@/lib/types';
import { cn } from '@/lib/utils';
import { PROMPT_SORTS, sortPrompts, type PromptSort } from './prompt-model';

export function PromptExplorer({
  prompts,
  variableCounts,
  selectedId,
  isDraft,
  draftName,
  dirty,
  loading,
  searchRef,
  onSelect,
  onOpenDraft,
  onNew,
  onDuplicate,
  onCopy,
  onDelete,
}: {
  onOpenDraft: () => void;
  prompts: UserPrompt[];
  variableCounts: Map<string, number>;
  selectedId: string | null;
  isDraft: boolean;
  draftName: string;
  dirty: boolean;
  loading: boolean;
  searchRef: RefObject<HTMLInputElement | null>;
  onSelect: (prompt: UserPrompt) => void;
  onNew: () => void;
  onDuplicate: (prompt: UserPrompt) => void;
  onCopy: (prompt: UserPrompt) => void;
  onDelete: (prompt: UserPrompt) => void;
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<PromptSort>('edited');
  const [menuId, setMenuId] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? prompts.filter((p) =>
          [p.name, p.description ?? '', p.prompt].some((field) => field.toLowerCase().includes(needle)),
        )
      : prompts;
    return sortPrompts(filtered, sort, variableCounts);
  }, [prompts, query, sort, variableCounts]);

  useEffect(() => {
    if (!menuId) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      if (event instanceof MouseEvent && (event.target as HTMLElement).closest('[data-prompt-menu]')) return;
      setMenuId(null);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [menuId]);

  useEffect(() => {
    if (!selectedId) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-prompt-id="${CSS.escape(selectedId)}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  return (
    <aside
      aria-label="Prompt explorer"
      className="flex h-full min-h-0 flex-col border-[var(--ps-border)] bg-[var(--ps-sidebar)] md:border-r"
    >
      <div className="shrink-0 space-y-2 border-b border-[var(--ps-border)] p-3">
        <div className="flex h-8 items-center rounded-[7px] border border-[var(--ps-border)] bg-[var(--ps-input)] transition-colors duration-150 focus-within:border-[rgba(57,185,130,0.55)]" data-input-shell>
          <Search size={13} className="ml-2.5 shrink-0 text-[var(--ps-muted)]" />
          <label htmlFor="prompt-search" className="sr-only">
            Search prompts
          </label>
          <input
            id="prompt-search"
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
            placeholder="Search prompts"
            style={{ background: 'transparent', border: 0 }}
            className="h-full min-w-0 flex-1 px-2 text-[12.5px] text-[var(--ps-text)] placeholder:text-[var(--ps-muted)] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery('')}
              className="mr-1 flex size-6 items-center justify-center rounded-[5px] text-[var(--ps-muted)] hover:text-[var(--ps-text)]"
            >
              <X size={12} />
            </button>
          ) : (
            <kbd className="mr-2 rounded-[4px] bg-[var(--ps-raised)] px-1.5 font-mono text-[10px] leading-[16px] text-[var(--ps-muted)]">/</kbd>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11.5px] tabular-nums text-[var(--ps-muted)]">
            {loading
              ? 'Loading…'
              : query.trim()
                ? `${visible.length} of ${prompts.length} prompts`
                : `${prompts.length} ${prompts.length === 1 ? 'prompt' : 'prompts'}`}
          </span>
          <div className="relative">
            <label htmlFor="prompt-sort" className="sr-only">
              Sort prompts
            </label>
            <select
              id="prompt-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as PromptSort)}
              style={{ background: 'transparent', border: 0, boxShadow: 'none' }}
              className="h-6 appearance-none rounded-[5px] pl-1.5 pr-5 text-right text-[11.5px] text-[var(--ps-text-2)] hover:text-[var(--ps-text)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[rgba(57,185,130,0.55)]"
            >
              {PROMPT_SORTS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[var(--ps-muted)]" />
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <ExplorerSkeleton />
        ) : (
          <ul ref={listRef} role="listbox" aria-label="Prompts" className="py-1">
            {isDraft && (
              <li role="option" aria-selected>
                <button
                  type="button"
                  onClick={onOpenDraft}
                  className="relative mx-1.5 block w-[calc(100%-12px)] rounded-[7px] bg-[var(--ps-raised)] px-3 py-2.5 text-left"
                >
                  <span aria-hidden className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-[var(--ps-green-active)]" />
                  <div className="flex items-center gap-2">
                    <FilePlus2 size={13} className="shrink-0 text-[var(--ps-text-2)]" />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--ps-text)]">
                      {draftName.trim() || 'Untitled prompt'}
                    </span>
                    <span className="rounded-[4px] bg-[rgba(231,183,91,0.12)] px-1.5 text-[10.5px] font-medium leading-[18px] text-[var(--ps-amber)]">
                      Draft
                    </span>
                  </div>
                  <p className="mt-0.5 pl-[21px] text-[11.5px] text-[var(--ps-muted)]">Not saved yet</p>
                </button>
              </li>
            )}

            {prompts.length === 0 && !isDraft && (
              <ExplorerEmpty
                icon={<ScrollText size={16} />}
                title="No prompts yet"
                body="Reusable instructions your agents can pull in by name."
                action={
                  <button
                    type="button"
                    onClick={onNew}
                    className="mt-3 text-[12.5px] font-medium text-[var(--ps-green-active)] hover:text-[var(--ps-text)]"
                  >
                    Create your first prompt
                  </button>
                }
              />
            )}

            {prompts.length > 0 && visible.length === 0 && (
              <ExplorerEmpty
                icon={<SearchX size={16} />}
                title="No matches"
                body={`No prompt name, description or body contains “${query.trim()}”.`}
                action={
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="mt-3 text-[12.5px] font-medium text-[var(--ps-green-active)] hover:text-[var(--ps-text)]"
                  >
                    Clear search
                  </button>
                }
              />
            )}

            {visible.map((prompt) => {
              const active = !isDraft && prompt.id === selectedId;
              const count = variableCounts.get(prompt.id) ?? 0;
              const editedAt = prompt.updated_at ?? prompt.created_at;
              const menuOpen = menuId === prompt.id;
              return (
                <li
                  key={prompt.id}
                  role="option"
                  aria-selected={active}
                  data-prompt-id={prompt.id}
                  className="group relative"
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setMenuId(prompt.id);
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(prompt)}
                    className={cn(
                      'relative mx-1.5 block w-[calc(100%-12px)] rounded-[7px] px-3 py-2.5 text-left outline-none transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[rgba(57,185,130,0.55)]',
                      active ? 'bg-[var(--ps-raised)]' : 'hover:bg-[rgba(240,243,241,0.03)]',
                    )}
                  >
                    {active && (
                      <span aria-hidden className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-[var(--ps-green-active)]" />
                    )}
                    <div className="flex items-center gap-2 pr-6">
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate text-[13px] font-medium',
                          active ? 'text-[var(--ps-text)]' : 'text-[var(--ps-text-2)] group-hover:text-[var(--ps-text)]',
                        )}
                      >
                        {prompt.name || 'Untitled prompt'}
                      </span>
                      {active && dirty && (
                        <span title="Unsaved changes" className="size-1.5 shrink-0 rounded-full bg-[var(--ps-amber)]" />
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-[var(--ps-muted)]">
                      <span className={cn('font-mono tabular-nums', count > 0 && 'text-[rgba(121,184,245,0.85)]')}>
                        {`{${count}}`}
                      </span>
                      <span>{count === 1 ? 'variable' : 'variables'}</span>
                      {editedAt && (
                        <>
                          <span aria-hidden>·</span>
                          <RelativeTime timestamp={editedAt} />
                        </>
                      )}
                    </div>
                  </button>

                  <div data-prompt-menu className="absolute right-3 top-2">
                    <button
                      type="button"
                      aria-label={`Actions for ${prompt.name || 'prompt'}`}
                      aria-haspopup="menu"
                      aria-expanded={menuOpen}
                      onClick={() => setMenuId(menuOpen ? null : prompt.id)}
                      className={cn(
                        'flex size-6 items-center justify-center rounded-[5px] text-[var(--ps-muted)] transition-opacity duration-150 hover:bg-[var(--ps-border)] hover:text-[var(--ps-text)] focus-visible:opacity-100',
                        menuOpen ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100',
                      )}
                    >
                      <MoreHorizontal size={14} />
                    </button>
                    {menuOpen && (
                      <div
                        role="menu"
                        className="absolute right-0 top-7 z-30 w-[176px] overflow-hidden rounded-[8px] border border-[var(--ps-border)] bg-[var(--ps-raised)] py-1 shadow-[0_10px_28px_rgba(0,0,0,0.45)]"
                      >
                        <MenuItem
                          icon={<CopyPlus size={13} />}
                          label="Duplicate"
                          onClick={() => {
                            setMenuId(null);
                            onDuplicate(prompt);
                          }}
                        />
                        <MenuItem
                          icon={<Copy size={13} />}
                          label="Copy prompt body"
                          onClick={() => {
                            setMenuId(null);
                            onCopy(prompt);
                          }}
                        />
                        <div className="my-1 h-px bg-[var(--ps-border)]" />
                        <MenuItem
                          icon={<Trash2 size={13} />}
                          label="Delete"
                          danger
                          onClick={() => {
                            setMenuId(null);
                            onDelete(prompt);
                          }}
                        />
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] transition-colors duration-150',
        danger
          ? 'text-[var(--ps-red)] hover:bg-[rgba(228,119,119,0.10)]'
          : 'text-[var(--ps-text-2)] hover:bg-[var(--ps-border)] hover:text-[var(--ps-text)]',
      )}
    >
      {icon}
      {label}
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
    <li className="flex flex-col items-center px-5 py-10 text-center">
      <span className="flex size-8 items-center justify-center rounded-[8px] bg-[var(--ps-raised)] text-[var(--ps-text-2)]">{icon}</span>
      <p className="mt-3 text-[13px] font-semibold text-[var(--ps-text)]">{title}</p>
      <p className="mt-1 text-[12px] leading-[1.5] text-[var(--ps-muted)]">{body}</p>
      {action}
    </li>
  );
}

function ExplorerSkeleton() {
  return (
    <div aria-hidden className="space-y-1 p-1.5">
      {Array.from({ length: 7 }).map((_, index) => (
        <div key={index} className="px-3 py-2.5">
          <div className="h-3.5 w-40 animate-pulse rounded-[4px] bg-[var(--ps-raised)] motion-reduce:animate-none" />
          <div className="mt-2 h-3 w-28 animate-pulse rounded-[4px] bg-[var(--ps-raised)] motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}
