'use client';

/**
 * Memory — `/dashboard/memory`.
 *
 * Two-pane library: explorer (PINNED / EVERYTHING ELSE) and a Markdown
 * detail viewer. Share counts come from GET /shares per memory, not an
 * invented field on the memory row.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlignJustify,
  ChevronDown,
  CircleHelp,
  Download,
  Info,
  LayoutList,
  Link2,
  Pin,
  Plus,
  Search,
  BookOpen,
  X,
} from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { MemoryDetail } from '@/components/memory/MemoryDetail';
import { MemoryEditorDialog } from '@/components/memory/MemoryEditorDialog';
import { MemoryExplorer } from '@/components/memory/MemoryExplorer';
import { RedeemShareDialog } from '@/components/memory/RedeemShareDialog';
import { ShareMemoryDialog } from '@/components/memory/ShareMemoryDialog';
import {
  MEMORY_FILTERS,
  MEMORY_SORTS,
  MEMORY_THEME,
  compareBy,
  isActiveShare,
  matchesQuery,
  sortMemories,
  type MemoryDensity,
  type MemoryFilter,
  type MemorySort,
} from '@/components/memory/memory-model';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { requestGuidedTour } from '@/lib/guided-tour';
import { useUser } from '@/lib/hooks';
import type { Memory } from '@/lib/types';
import { cn } from '@/lib/utils';

function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      document.documentElement.dataset.demo === 'true' ||
      localStorage.getItem('aegis_demo') === 'true'
    );
  } catch {
    return false;
  }
}

type EditorState = { open: boolean; editing: Memory | null; session: number };

export default function MemoryPage() {
  const { user, isLoading: userLoading } = useUser();
  const toast = useToast();
  const demo = useMemo(() => isDemoMode(), []);
  const effectiveUserId = user?.id ?? (demo ? 'preview-user' : null);

  const [memories, setMemories] = useState<Memory[]>([]);
  const [shareCounts, setShareCounts] = useState<Record<string, number>>({});
  const [shareFailures, setShareFailures] = useState<Set<string>>(() => new Set());
  const [sharesLoading, setSharesLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MemoryFilter>('all');
  const [sort, setSort] = useState<MemorySort>('updated');
  const [density, setDensity] = useState<MemoryDensity>('comfortable');
  const searchRef = useRef<HTMLInputElement>(null);

  const [shareMemory, setShareMemory] = useState<Memory | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Memory | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pinningId, setPinningId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>({ open: false, editing: null, session: 0 });
  const [saving, setSaving] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);

  const loadShareCounts = useCallback(async (rows: Memory[]) => {
    const entries = await Promise.all(
      rows.map(async (row) => {
        try {
          const shares = await api.getMemoryShares(row.id);
          return [row.id, shares.filter(isActiveShare).length] as const;
        } catch {
          return [row.id, undefined] as const;
        }
      }),
    );
    const next: Record<string, number> = {};
    const failed: string[] = [];
    for (const [id, count] of entries) {
      if (typeof count === 'number') next[id] = count;
      else failed.push(id);
    }
    setShareCounts((prev) => ({ ...prev, ...next }));
    setShareFailures((prev) => {
      const out = new Set(prev);
      for (const [id] of entries) out.delete(id);
      for (const id of failed) out.add(id);
      return out;
    });
  }, []);

  const fetchData = useCallback(async () => {
    if (!effectiveUserId) {
      if (!userLoading) {
        setMemories([]);
        setLoading(false);
        setSharesLoading(false);
      }
      return [] as Memory[];
    }
    setError(null);
    try {
      const data = sortMemories(await api.getMemories(effectiveUserId));
      setMemories(data);
      setSharesLoading(true);
      void loadShareCounts(data).finally(() => setSharesLoading(false));
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load memories');
      setSharesLoading(false);
      return null;
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, userLoading, loadShareCounts]);

  useEffect(() => {
    if (effectiveUserId) void fetchData();
    else if (!userLoading) {
      setMemories([]);
      setLoading(false);
      setSharesLoading(false);
    }
  }, [effectiveUserId, userLoading, fetchData]);

  const pinnedCount = memories.filter((m) => m.is_pinned).length;
  const sharedCount = memories.filter((m) => (shareCounts[m.id] ?? 0) > 0).length;

  const visible = useMemo(
    () =>
      memories
        .filter((m) => matchesQuery(m, query))
        .filter((m) =>
          filter === 'pinned' ? m.is_pinned : filter === 'shared' ? (shareCounts[m.id] ?? 0) > 0 : true,
        )
        .sort(compareBy(sort)),
    [memories, query, filter, sort, shareCounts],
  );
  const visiblePinned = visible.filter((m) => m.is_pinned);
  const visibleRest = visible.filter((m) => !m.is_pinned);
  const ordered = useMemo(() => [...visiblePinned, ...visibleRest], [visiblePinned, visibleRest]);
  const filtersActive = query.trim() !== '' || filter !== 'all';

  const selected = memories.find((m) => m.id === selectedId) ?? null;
  const panesRef = useRef<HTMLDivElement>(null);
  const hasSelection = selected !== null;
  const lastSelection = useRef(hasSelection);

  useEffect(() => {
    if (lastSelection.current === hasSelection) return;
    lastSelection.current = hasSelection;
    if (!window.matchMedia('(max-width: 1023px)').matches) return;
    const top = panesRef.current?.getBoundingClientRect().top;
    if (top !== undefined && (top < 110 || top > window.innerHeight * 0.35)) {
      panesRef.current?.scrollIntoView({ block: 'start' });
    }
  }, [hasSelection]);

  const clearFilters = () => {
    setQuery('');
    setFilter('all');
  };

  const openCreate = () => setEditor((prev) => ({ open: true, editing: null, session: prev.session + 1 }));
  const openEdit = (memory: Memory) =>
    setEditor((prev) => ({ open: true, editing: memory, session: prev.session + 1 }));
  const closeEditor = () => setEditor((prev) => ({ ...prev, open: false }));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (editor.open || redeemOpen || shareMemory || pendingDelete) return;
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;
      if (typing) return;
      if (event.key === '/') {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (ordered.length === 0) return;
        event.preventDefault();
        const index = ordered.findIndex((m) => m.id === selectedId);
        const next =
          index === -1
            ? event.key === 'ArrowDown'
              ? 0
              : ordered.length - 1
            : Math.min(ordered.length - 1, Math.max(0, index + (event.key === 'ArrowDown' ? 1 : -1)));
        setSelectedId(ordered[next].id);
        return;
      }
      if (event.key === 'e' && selected) {
        event.preventDefault();
        openEdit(selected);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editor.open, redeemOpen, shareMemory, pendingDelete, ordered, selectedId, selected]);

  const handleSave = async (payload: { title: string; memory: string }) => {
    if (!effectiveUserId || saving) return;
    const target = editor.editing;
    setSaving(true);
    try {
      if (target) {
        const updated = await api.updateMemory(target.id, effectiveUserId, payload);
        setMemories((prev) => sortMemories(prev.map((m) => (m.id === updated.id ? updated : m))));
        toast.success('Memory updated');
      } else {
        const created = await api.createMemory(payload);
        setMemories((prev) => sortMemories([created, ...prev]));
        setShareCounts((prev) => ({ ...prev, [created.id]: 0 }));
        setSelectedId(created.id);
        toast.success('Memory created');
      }
      closeEditor();
    } catch (err) {
      toast.error(target ? 'Failed to update memory' : 'Failed to create memory', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete || !effectiveUserId) return;
    const mem = pendingDelete;
    setPendingDelete(null);
    setDeletingId(mem.id);
    try {
      await api.deleteMemory(mem.id, effectiveUserId);
      setMemories((prev) => prev.filter((m) => m.id !== mem.id));
      setSelectedId((id) => (id === mem.id ? null : id));
      toast.success('Memory deleted');
    } catch (err) {
      toast.error('Failed to delete memory', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handlePin = async (memory: Memory) => {
    if (!effectiveUserId || pinningId) return;
    const nextPinned = !memory.is_pinned;
    setPinningId(memory.id);
    setMemories((prev) =>
      sortMemories(prev.map((m) => (m.id === memory.id ? { ...m, is_pinned: nextPinned } : m))),
    );
    try {
      const updated = await api.updateMemory(memory.id, effectiveUserId, { is_pinned: nextPinned });
      setMemories((prev) => sortMemories(prev.map((m) => (m.id === updated.id ? updated : m))));
    } catch (err) {
      setMemories((prev) =>
        sortMemories(prev.map((m) => (m.id === memory.id ? { ...m, is_pinned: !nextPinned } : m))),
      );
      toast.error('Failed to update pin', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setPinningId(null);
    }
  };

  const handleCopy = async (memory: Memory) => {
    try {
      await navigator.clipboard.writeText(memory.memory);
      setCopiedId(memory.id);
      window.setTimeout(() => setCopiedId((id) => (id === memory.id ? null : id)), 1600);
    } catch {
      toast.error('Could not copy to the clipboard');
    }
  };

  const handleImported = async (memory: Memory | null) => {
    setRedeemOpen(false);
    toast.success('Memory imported', { description: 'Your copy is now in the library.' });
    if (memory) {
      setMemories((prev) => sortMemories([memory, ...prev.filter((m) => m.id !== memory.id)]));
      setShareCounts((prev) => ({ ...prev, [memory.id]: 0 }));
      setSelectedId(memory.id);
      clearFilters();
    } else {
      await fetchData();
    }
  };

  const handleAlreadyImported = async (memoryId: string | null) => {
    setRedeemOpen(false);
    toast.success('Already in your library', { description: 'You imported this memory before.' });
    const rows = await fetchData();
    if (memoryId && rows?.some((m) => m.id === memoryId)) {
      setSelectedId(memoryId);
      clearFilters();
    }
  };

  const busyIds = useMemo(
    () => new Set([pinningId, deletingId].filter((id): id is string => Boolean(id))),
    [pinningId, deletingId],
  );

  const sharedFailures = shareFailures.size;

  return (
    <>
      <Topbar title="Memory" />

      <div style={MEMORY_THEME} className="min-h-[calc(100dvh-56px)]">
        <div className="mx-auto w-full max-w-[1600px] px-4 pb-8 pt-7 sm:px-6 lg:px-8">
          <header data-tour="memory-header" className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 data-tour="memory-title" className="text-[30px] font-semibold leading-[1.15] tracking-[-0.03em] text-[var(--mm-text)]">
                  Memory
                </h1>
                <RulesTooltip />
                <button
                  type="button"
                  onClick={() => requestGuidedTour('memory')}
                  aria-label="Guided tour of Memory"
                  title="Guided tour"
                  className="flex size-6 items-center justify-center rounded-full text-[var(--mm-muted)] transition-colors duration-150 hover:text-[var(--mm-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,184,121,0.45)]"
                >
                  <CircleHelp size={15} />
                </button>
              </div>
              <p className="mt-1.5 text-[14px] leading-[1.55] text-[var(--mm-text-2)]">
                Your persistent knowledge, available across agent sessions.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setRedeemOpen(true)}
                data-tour="memory-redeem"
                className="inline-flex h-9 items-center gap-1.5 rounded-[9px] bg-[var(--mm-panel)] px-3 text-[12.5px] font-medium text-[var(--mm-text-2)] ring-1 ring-inset ring-[var(--mm-border)] transition-colors duration-150 hover:bg-[var(--mm-elevated)] hover:text-[var(--mm-text)]"
              >
                <Download size={14} />
                Redeem share code
              </button>
              <button
                type="button"
                onClick={openCreate}
                data-tour="new-memory"
                className="inline-flex h-9 items-center gap-1.5 rounded-[9px] bg-[var(--mm-green)] px-3.5 text-[12.5px] font-semibold text-[#04130c] transition-colors duration-150 hover:bg-[var(--mm-mint)]"
              >
                <Plus size={15} />
                New memory
              </button>
            </div>
          </header>

          <section data-tour="memory-stats" aria-label="Summary" className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
            <StatCard
              tourId="memory-stat-total"
              label="Total memories"
              shortLabel="Total"
              icon={<BookOpen size={15} />}
              loading={loading}
              value={error && memories.length === 0 ? '—' : memories.length.toLocaleString()}
              description={error && memories.length === 0 ? 'Could not load memories' : 'In your library'}
            />
            <StatCard
              tourId="memory-stat-pinned"
              label="Pinned"
              shortLabel="Pinned"
              icon={<Pin size={15} />}
              loading={loading}
              value={error && memories.length === 0 ? '—' : pinnedCount.toLocaleString()}
              description="Kept at the top of the library"
            />
            <StatCard
              tourId="memory-stat-shared"
              label="Shared"
              shortLabel="Shared"
              icon={<Link2 size={15} />}
              loading={loading || sharesLoading}
              value={error && memories.length === 0 ? '—' : sharedCount.toLocaleString()}
              description={
                sharedFailures > 0
                  ? `Could not check ${sharedFailures.toLocaleString()} ${sharedFailures === 1 ? 'memory' : 'memories'}`
                  : 'With an active share link'
              }
            />
          </section>

          <div data-tour="memory-toolbar" className="mt-6 flex flex-col gap-2.5 md:flex-row md:items-center">
            <div data-input-shell data-tour="memory-search" className="flex h-9 min-w-0 items-center rounded-[9px] bg-[var(--mm-panel)] ring-1 ring-inset ring-[var(--mm-border)] transition-shadow duration-150 focus-within:ring-[rgba(0,184,121,0.55)] md:w-[340px]">
              <Search size={14} className="ml-3 shrink-0 text-[var(--mm-muted)]" />
              <label htmlFor="memory-search" className="sr-only">
                Search memories
              </label>
              <input
                id="memory-search"
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
                placeholder="Search titles and content"
                style={{ background: 'transparent', border: 0 }}
                className="h-full min-w-0 flex-1 px-2 text-[13px] text-[var(--mm-text)] placeholder:text-[var(--mm-muted)] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
              />
              {query ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setQuery('')}
                  className="mr-1.5 flex size-6 items-center justify-center rounded-[6px] text-[var(--mm-muted)] hover:text-[var(--mm-text)]"
                >
                  <X size={13} />
                </button>
              ) : (
                <kbd className="mr-2.5 rounded-[4px] bg-[var(--mm-elevated)] px-1.5 text-[10.5px] leading-[18px] text-[var(--mm-muted)]">
                  /
                </kbd>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 md:ml-auto">
              <div
                role="radiogroup"
                aria-label="Filter memories"
                data-tour="memory-filters"
                className="flex h-9 items-center rounded-[9px] bg-[var(--mm-panel)] p-0.5 ring-1 ring-inset ring-[var(--mm-border)]"
              >
                {MEMORY_FILTERS.map((option) => {
                  const count =
                    option.id === 'all' ? memories.length : option.id === 'pinned' ? pinnedCount : sharedCount;
                  const active = filter === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setFilter(option.id)}
                      className={cn(
                        'flex h-full items-center gap-1.5 rounded-[7px] px-2.5 text-[12.5px] font-medium transition-colors duration-150',
                        active
                          ? 'bg-[var(--mm-elevated)] text-[var(--mm-text)]'
                          : 'text-[var(--mm-muted)] hover:text-[var(--mm-text)]',
                      )}
                    >
                      {option.label}
                      {!loading && (
                        <span className={cn('text-[11px] tabular-nums', active ? 'text-[var(--mm-mint)]' : 'text-[var(--mm-muted)]')}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div data-tour="memory-sort" className="relative">
                <label htmlFor="memory-sort" className="sr-only">
                  Sort memories
                </label>
                <select
                  id="memory-sort"
                  value={sort}
                  onChange={(event) => setSort(event.target.value as MemorySort)}
                  style={{ background: 'var(--mm-panel)' }}
                  className="h-9 appearance-none rounded-[9px] border-0 pl-3 pr-8 text-[12.5px] text-[var(--mm-text-2)] ring-1 ring-inset ring-[var(--mm-border)] transition-colors duration-150 hover:text-[var(--mm-text)] focus:outline-none focus-visible:ring-[rgba(0,184,121,0.55)]"
                >
                  {MEMORY_SORTS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--mm-muted)]"
                />
              </div>

              <div
                role="radiogroup"
                aria-label="List density"
                data-tour="memory-density"
                className="hidden h-9 items-center rounded-[9px] bg-[var(--mm-panel)] p-0.5 ring-1 ring-inset ring-[var(--mm-border)] sm:flex"
              >
                {(
                  [
                    { id: 'comfortable', label: 'Comfortable list', icon: LayoutList },
                    { id: 'compact', label: 'Compact list', icon: AlignJustify },
                  ] as const
                ).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={density === id}
                    aria-label={label}
                    title={label}
                    onClick={() => setDensity(id)}
                    className={cn(
                      'flex h-full w-8 items-center justify-center rounded-[7px] transition-colors duration-150',
                      density === id
                        ? 'bg-[var(--mm-elevated)] text-[var(--mm-text)]'
                        : 'text-[var(--mm-muted)] hover:text-[var(--mm-text)]',
                    )}
                  >
                    <Icon size={14} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-[10px] bg-[rgba(240,120,120,0.08)] px-4 py-2.5">
              <p className="text-[13px] text-[var(--mm-red)]">{error}</p>
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  void fetchData();
                }}
                className="shrink-0 text-[12.5px] font-medium text-[var(--mm-text-2)] underline-offset-2 hover:text-[var(--mm-text)] hover:underline"
              >
                Try again
              </button>
            </div>
          )}

          <div
            ref={panesRef}
            data-tour="memory-panes"
            className="mt-4 grid scroll-mt-[120px] grid-cols-1 gap-5 lg:sticky lg:top-[72px] lg:h-[calc(100dvh-88px)] lg:min-h-[520px] lg:grid-cols-[minmax(320px,38fr)_62fr]">
            <div data-tour="memory-library" className={cn('min-h-0 lg:block', selected ? 'hidden' : 'block')}>
              <MemoryExplorer
                pinned={visiblePinned}
                rest={visibleRest}
                total={memories.length}
                selectedId={selectedId}
                shareCounts={shareCounts}
                density={density}
                busyIds={busyIds}
                loading={loading}
                query={query}
                filtered={filtersActive}
                onSelect={(memory) => setSelectedId(memory.id)}
                onPin={(memory) => void handlePin(memory)}
                onEdit={openEdit}
                onShare={setShareMemory}
                onCreate={openCreate}
                onClearFilters={clearFilters}
              />
            </div>
            <div data-tour="memory-detail" className={cn('min-h-0', selected ? 'block' : 'hidden lg:block')}>
              <MemoryDetail
                memory={selected}
                shareCount={selected ? shareCounts[selected.id] : undefined}
                shareCountFailed={selected ? shareFailures.has(selected.id) : false}
                pinning={pinningId === selected?.id}
                copied={copiedId === selected?.id}
                hasMemories={memories.length > 0}
                onBack={() => setSelectedId(null)}
                onPin={() => selected && void handlePin(selected)}
                onEdit={() => selected && openEdit(selected)}
                onCopy={() => selected && void handleCopy(selected)}
                onShare={() => selected && setShareMemory(selected)}
                onDelete={() => selected && setPendingDelete(selected)}
              />
            </div>
          </div>
        </div>

        <MemoryEditorDialog
          key={editor.session}
          open={editor.open}
          editing={editor.editing !== null}
          initialTitle={editor.editing?.title ?? ''}
          initialBody={editor.editing?.memory ?? ''}
          saving={saving}
          onSave={(payload) => void handleSave(payload)}
          onClose={closeEditor}
        />

        <RedeemShareDialog
          open={redeemOpen}
          onClose={() => setRedeemOpen(false)}
          onImported={(memory) => void handleImported(memory)}
          onAlreadyImported={(id) => void handleAlreadyImported(id)}
        />

        <ConfirmDialog
          open={pendingDelete !== null}
          onOpenChange={(open) => {
            if (!open) setPendingDelete(null);
          }}
          variant="danger"
          title="Delete this memory?"
          description={
            pendingDelete ? (
              <>
                <span className="font-semibold text-[var(--neutral-strong-950)]">
                  &ldquo;{pendingDelete.title}&rdquo;
                </span>{' '}
                will be permanently removed. Copies others imported from your share links are kept.
              </>
            ) : null
          }
          confirmLabel="Delete memory"
          loading={!!deletingId}
          onConfirm={handleDelete}
        />

        <ShareMemoryDialog
          memory={shareMemory}
          open={shareMemory !== null}
          onOpenChange={(next) => {
            if (!next) {
              if (shareMemory) void loadShareCounts([shareMemory]);
              setShareMemory(null);
            }
          }}
        />
      </div>
    </>
  );
}

function StatCard({
  tourId,
  label,
  shortLabel,
  icon,
  value,
  description,
  loading,
}: {
  tourId?: string;
  label: string;
  shortLabel: string;
  icon: ReactNode;
  value: string;
  description: string;
  loading: boolean;
}) {
  return (
    <div data-tour={tourId} className="flex h-[84px] flex-col justify-between rounded-[12px] border border-[var(--mm-border)] bg-[var(--mm-panel)] px-3.5 py-3.5 sm:h-[100px] sm:px-5 sm:py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--mm-muted)]">
          <span className="sm:hidden">{shortLabel}</span>
          <span className="hidden sm:inline">{label}</span>
        </p>
        <span className="hidden text-[var(--mm-muted)] sm:block">{icon}</span>
      </div>
      {loading ? (
        <div aria-hidden>
          <div className="h-6 w-12 animate-pulse rounded-[5px] bg-[var(--mm-elevated)] motion-reduce:animate-none" />
          <div className="mt-2 h-3 w-32 animate-pulse rounded-[4px] bg-[var(--mm-elevated)] motion-reduce:animate-none" />
        </div>
      ) : (
        <div className="flex items-baseline gap-2.5">
          <p className="text-[24px] font-semibold leading-none tabular-nums tracking-[-0.03em] text-[var(--mm-text)]">
            {value}
          </p>
          <p className="hidden truncate text-[12px] text-[var(--mm-text-2)] sm:block">{description}</p>
        </div>
      )}
    </div>
  );
}

function RulesTooltip() {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label="How memory works"
        aria-expanded={open}
        aria-describedby={open ? 'memory-rules' : undefined}
        onClick={() => setOpen((value) => !value)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
        }}
        className="flex size-6 items-center justify-center rounded-full text-[var(--mm-muted)] transition-colors duration-150 hover:text-[var(--mm-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,184,121,0.45)]"
      >
        <Info size={15} />
      </button>
      {open && (
        <span
          id="memory-rules"
          role="tooltip"
          className="absolute left-0 top-full z-30 mt-2 w-[300px] rounded-[10px] border border-[var(--mm-border-strong)] bg-[var(--mm-elevated)] px-3.5 py-3 text-[12.5px] leading-[1.55] text-[var(--mm-text-2)] shadow-[0_12px_32px_rgba(0,0,0,0.4)]"
        >
          <span className="mb-1 block text-[12px] font-semibold text-[var(--mm-text)]">How memory works</span>
          Each memory is a title of four words or fewer and a Markdown body. You write them — agents do not
          create them, and nothing expires. Share links can be revoked at any time.
        </span>
      )}
    </span>
  );
}
