'use client';

/**
 * Prompt Studio — `/dashboard/prompts`.
 *
 * Explorer + editor. Name, description, and body come from the API.
 * Variables are derived from `{braces}` in the body — not a separate field.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Copy,
  CopyPlus,
  Loader2,
  MoreHorizontal,
  Plus,
  Trash2,
} from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { PromptEditor, type PromptEditorHandle } from '@/components/prompts/PromptEditor';
import { PromptExplorer } from '@/components/prompts/PromptExplorer';
import { VariableInspector } from '@/components/prompts/VariableInspector';
import {
  PROMPT_THEME,
  emptyForm,
  extractPromptVariables,
  formFromPrompt,
  inspectPromptVariables,
  variableCountLabel,
  type PromptFormState,
} from '@/components/prompts/prompt-model';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { useToast } from '@/components/ui/Toast';
import { Dialog } from '@/components/workspaces/Dialog';
import { api } from '@/lib/api';
import { useAutoRefresh, useUser } from '@/lib/hooks';
import type { UserPrompt } from '@/lib/types';
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

export default function PromptsPage() {
  const { user, isLoading: userLoading } = useUser();
  const toast = useToast();
  const router = useRouter();
  const demo = useMemo(() => isDemoMode(), []);

  const [prompts, setPrompts] = useState<UserPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDraft, setIsDraft] = useState(false);
  const [form, setForm] = useState<PromptFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<UserPrompt | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [activeVariable, setActiveVariable] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list');
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const editorRef = useRef<PromptEditorHandle>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const selected = prompts.find((p) => p.id === selectedId) ?? null;
  const variables = useMemo(() => inspectPromptVariables(form.prompt), [form.prompt]);
  const variableCounts = useMemo(
    () => new Map(prompts.map((p) => [p.id, extractPromptVariables(p.prompt).length])),
    [prompts],
  );

  const baseline = isDraft || !selected ? emptyForm() : formFromPrompt(selected);
  const dirty =
    form.name !== baseline.name ||
    form.description !== baseline.description ||
    form.prompt !== baseline.prompt;
  const nameMissing = !form.name.trim();
  const bodyMissing = !form.prompt.trim();
  const canSave = dirty && !nameMissing && !bodyMissing;

  const fetchData = useCallback(async () => {
    if (!user && !demo) {
      if (!userLoading) {
        setPrompts([]);
        setLoading(false);
      }
      return;
    }
    try {
      const data = await api.getUserPrompts();
      setPrompts(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prompts');
    } finally {
      setLoading(false);
    }
  }, [demo, user, userLoading]);

  useEffect(() => {
    if (demo || user) fetchData();
    else if (!userLoading) {
      setPrompts([]);
      setLoading(false);
    }
  }, [demo, user, userLoading, fetchData]);

  const { lastUpdated } = useAutoRefresh(fetchData, 60000);

  useEffect(() => {
    if (loading) return;
    if (isDraft) return;
    if (selectedId && prompts.some((p) => p.id === selectedId)) return;
    const first = prompts[0];
    if (first) {
      setSelectedId(first.id);
      setForm(formFromPrompt(first));
      setIsDraft(false);
      return;
    }
    setSelectedId(null);
    setForm(emptyForm());
    setIsDraft(true);
  }, [loading, prompts, selectedId, isDraft]);

  useEffect(() => {
    if (!justSaved) return;
    const id = window.setTimeout(() => setJustSaved(false), 2200);
    return () => window.clearTimeout(id);
  }, [justSaved]);

  /** Runs `action` now, or after the user resolves unsaved edits. */
  const guard = useCallback(
    (action: () => void) => {
      if (dirty) setPendingAction(() => action);
      else action();
    },
    [dirty],
  );

  const resetEditorState = () => {
    setActiveVariable(null);
    setAttempted(false);
    setJustSaved(false);
    setMenuOpen(false);
  };

  const selectPrompt = (prompt: UserPrompt) => {
    if (!isDraft && prompt.id === selectedId) {
      setMobileView('editor');
      return;
    }
    guard(() => {
      setIsDraft(false);
      setSelectedId(prompt.id);
      setForm(formFromPrompt(prompt));
      resetEditorState();
      setMobileView('editor');
    });
  };

  const startDraft = () => {
    guard(() => {
      setIsDraft(true);
      setSelectedId(null);
      setForm(emptyForm());
      resetEditorState();
      setMobileView('editor');
      window.setTimeout(() => nameRef.current?.focus(), 30);
    });
  };

  const patchForm = (patch: Partial<PromptFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setJustSaved(false);
  };

  const buildPayload = () => ({
    prompt: form.prompt.trim(),
    name: form.name.trim(),
    description: form.description.trim(),
  });

  const handleSave = async (): Promise<boolean> => {
    if (saving || (!user && !demo)) return false;
    if (!canSave) {
      if (dirty) setAttempted(true);
      return false;
    }
    setSaving(true);
    try {
      if (isDraft || !selected) {
        const created = await api.createUserPrompt(buildPayload());
        setPrompts((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
        setSelectedId(created.id);
        setForm(formFromPrompt(created));
        setIsDraft(false);
        toast.success('Prompt created');
      } else {
        const updated = await api.updateUserPrompt(selected.id, buildPayload());
        setPrompts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        setForm(formFromPrompt(updated));
      }
      setAttempted(false);
      setJustSaved(true);
      return true;
    } catch (err) {
      toast.error(isDraft || !selected ? 'Failed to create prompt' : 'Failed to save prompt', {
        description: err instanceof Error ? err.message : undefined,
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const target = pendingDelete;
    if (!target || (!user && !demo)) return;
    setDeleting(true);
    try {
      await api.deleteUserPrompt(target.id);
      const remaining = prompts.filter((p) => p.id !== target.id);
      setPrompts(remaining);
      setPendingDelete(null);
      if (!isDraft && target.id === selectedId) {
        const next = remaining[0];
        resetEditorState();
        if (next) {
          setSelectedId(next.id);
          setForm(formFromPrompt(next));
          setIsDraft(false);
        } else {
          setSelectedId(null);
          setForm(emptyForm());
          setIsDraft(true);
        }
        setMobileView('list');
      }
      toast.success('Prompt deleted');
    } catch (err) {
      toast.error('Failed to delete prompt', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleDuplicate = (source: UserPrompt) => {
    guard(async () => {
      try {
        const created = await api.createUserPrompt({
          name: `${source.name || 'Untitled prompt'} copy`,
          description: (source.description ?? '').trim(),
          prompt: source.prompt,
        });
        setPrompts((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
        setIsDraft(false);
        setSelectedId(created.id);
        setForm(formFromPrompt(created));
        resetEditorState();
        setMobileView('editor');
        toast.success('Prompt duplicated');
      } catch (err) {
        toast.error('Failed to duplicate prompt', {
          description: err instanceof Error ? err.message : undefined,
        });
      }
    });
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Prompt body copied');
    } catch {
      toast.error('Could not copy to the clipboard');
    }
  };

  const discardDraft = () => {
    const first = prompts[0];
    resetEditorState();
    if (first) {
      setIsDraft(false);
      setSelectedId(first.id);
      setForm(formFromPrompt(first));
    } else {
      setForm(emptyForm());
    }
    setMobileView('list');
  };

  const saveRef = useRef(handleSave);
  useEffect(() => {
    saveRef.current = handleSave;
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveRef.current();
        return;
      }
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

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingAction(() => () => router.push(url.pathname + url.search + url.hash));
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty, router]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      if (event instanceof MouseEvent && (event.target as HTMLElement).closest('[data-editor-menu]')) return;
      setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [menuOpen]);

  const showEditor = isDraft || selected !== null;
  const editedAt = selected?.updated_at ?? selected?.created_at ?? null;
  const usedVariable = activeVariable && variables.some((v) => v.name === activeVariable) ? activeVariable : null;

  const status: { tone: 'saving' | 'saved' | 'dirty' | 'idle' | 'draft'; label: ReactNode } = saving
    ? { tone: 'saving', label: 'Saving…' }
    : justSaved
      ? { tone: 'saved', label: 'Saved' }
      : dirty
        ? { tone: 'dirty', label: isDraft ? 'Unsaved draft' : 'Unsaved changes' }
        : isDraft
          ? { tone: 'draft', label: 'New prompt' }
          : {
              tone: 'idle',
              label: editedAt ? (
                <>
                  Saved · edited <RelativeTime timestamp={editedAt} />
                </>
              ) : (
                'Saved'
              ),
            };

  const saveLabel = isDraft || !selected ? 'Create prompt' : 'Save changes';
  const validationHint = attempted
    ? nameMissing && bodyMissing
      ? 'Add a name and a prompt body to save.'
      : nameMissing
        ? 'Add a name to save.'
        : bodyMissing
          ? 'Add a prompt body to save.'
          : null
    : null;

  return (
    <>
      <Topbar title="Prompts" lastUpdated={lastUpdated} onRefresh={fetchData} />

      <div
        style={PROMPT_THEME}
        className="flex h-[calc(100dvh-48px-56px)] flex-col lg:h-[calc(100dvh-56px)]"
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--ps-border)] px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2.5">
              <h1 className="text-[22px] font-semibold leading-[1.2] tracking-[-0.025em] text-[var(--ps-text)]">
                Prompt Studio
              </h1>
              <span className="text-[12.5px] tabular-nums text-[var(--ps-muted)]">
                {loading ? '' : `${prompts.length} ${prompts.length === 1 ? 'prompt' : 'prompts'}`}
              </span>
            </div>
            <p className="mt-1 hidden truncate text-[13px] text-[var(--ps-text-2)] sm:block">
              Create, manage and reuse instructions across your agents.
            </p>
          </div>
          <button
            type="button"
            onClick={startDraft}
            data-tour="new-prompt"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[8px] bg-[var(--ps-green)] px-3.5 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-[#1A9660] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(57,185,130,0.55)]"
          >
            <Plus size={15} />
            New prompt
          </button>
        </header>

        {error && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--ps-border)] bg-[rgba(228,119,119,0.06)] px-4 py-2.5 sm:px-6">
            <p className="flex items-center gap-2 text-[13px] text-[var(--ps-red)]">
              <AlertCircle size={14} />
              {error}
            </p>
            <button
              type="button"
              onClick={() => void fetchData()}
              className="shrink-0 text-[12.5px] font-medium text-[var(--ps-text-2)] hover:text-[var(--ps-text)]"
            >
              Retry
            </button>
          </div>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[248px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)]">
          <div className={cn('min-h-0', mobileView === 'editor' ? 'hidden md:block' : 'block')}>
            <PromptExplorer
              prompts={prompts}
              variableCounts={variableCounts}
              selectedId={selectedId}
              isDraft={isDraft}
              draftName={form.name}
              dirty={dirty}
              loading={loading}
              searchRef={searchRef}
              onSelect={selectPrompt}
              onOpenDraft={() => setMobileView('editor')}
              onNew={startDraft}
              onDuplicate={handleDuplicate}
              onCopy={(prompt) => void copyText(prompt.prompt)}
              onDelete={setPendingDelete}
            />
          </div>

          <section
            aria-label="Prompt editor"
            className={cn(
              'min-h-0 flex-col overflow-hidden px-4 pb-4 pt-4 sm:px-6 sm:pb-5',
              mobileView === 'list' ? 'hidden md:flex' : 'flex',
            )}
          >
            {loading ? (
              <EditorSkeleton />
            ) : showEditor ? (
              <>
                <div className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setMobileView('list')}
                    className="-ml-1.5 mb-2 inline-flex h-7 items-center gap-1 rounded-[6px] px-1.5 text-[12.5px] font-medium text-[var(--ps-text-2)] hover:bg-[var(--ps-raised)] hover:text-[var(--ps-text)] md:hidden"
                  >
                    <ArrowLeft size={14} />
                    Prompts
                  </button>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <input
                        ref={nameRef}
                        type="text"
                        value={form.name}
                        onChange={(event) => patchForm({ name: event.target.value })}
                        placeholder="Untitled prompt"
                        aria-label="Prompt name"
                        aria-invalid={attempted && nameMissing}
                        style={{ background: 'transparent', border: 0, boxShadow: 'none' }}
                        className={cn(
                          '-mx-1.5 w-[calc(100%+12px)] rounded-[6px] px-1.5 py-0.5 text-[20px] font-semibold leading-[1.3] tracking-[-0.02em] text-[var(--ps-text)] outline-none transition-colors duration-150 placeholder:text-[var(--ps-muted)] hover:bg-[rgba(240,243,241,0.03)] focus:bg-[var(--ps-input)]',
                          attempted && nameMissing && 'placeholder:text-[var(--ps-red)]',
                        )}
                      />
                      <input
                        type="text"
                        value={form.description}
                        onChange={(event) => patchForm({ description: event.target.value })}
                        placeholder="Add a short description — when should an agent use this prompt?"
                        aria-label="Prompt description"
                        style={{ background: 'transparent', border: 0, boxShadow: 'none' }}
                        className="-mx-1.5 mt-0.5 w-[calc(100%+12px)] rounded-[6px] px-1.5 py-0.5 text-[13px] leading-[1.5] text-[var(--ps-text-2)] outline-none transition-colors duration-150 placeholder:text-[var(--ps-muted)] hover:bg-[rgba(240,243,241,0.03)] focus:bg-[var(--ps-input)]"
                      />
                    </div>
                    <div data-editor-menu className="relative shrink-0 pt-0.5">
                      <button
                        type="button"
                        aria-label="More prompt actions"
                        aria-haspopup="menu"
                        aria-expanded={menuOpen}
                        onClick={() => setMenuOpen((open) => !open)}
                        className="flex size-8 items-center justify-center rounded-[7px] text-[var(--ps-muted)] transition-colors duration-150 hover:bg-[var(--ps-raised)] hover:text-[var(--ps-text)]"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      {menuOpen && (
                        <div
                          role="menu"
                          className="absolute right-0 top-9 z-30 w-[190px] overflow-hidden rounded-[8px] border border-[var(--ps-border)] bg-[var(--ps-raised)] py-1 shadow-[0_10px_28px_rgba(0,0,0,0.45)]"
                        >
                          <EditorMenuItem
                            icon={<Copy size={13} />}
                            label="Copy prompt body"
                            disabled={!form.prompt}
                            onClick={() => {
                              setMenuOpen(false);
                              void copyText(form.prompt);
                            }}
                          />
                          {selected && !isDraft && (
                            <EditorMenuItem
                              icon={<CopyPlus size={13} />}
                              label="Duplicate"
                              onClick={() => {
                                setMenuOpen(false);
                                handleDuplicate(selected);
                              }}
                            />
                          )}
                          <div className="my-1 h-px bg-[var(--ps-border)]" />
                          {selected && !isDraft ? (
                            <EditorMenuItem
                              icon={<Trash2 size={13} />}
                              label="Delete prompt"
                              danger
                              onClick={() => {
                                setMenuOpen(false);
                                setPendingDelete(selected);
                              }}
                            />
                          ) : (
                            <EditorMenuItem
                              icon={<Trash2 size={13} />}
                              label="Discard draft"
                              danger
                              onClick={() => {
                                setMenuOpen(false);
                                guard(discardDraft);
                              }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px]">
                    <span className="inline-flex h-5 items-center gap-1 rounded-[5px] bg-[rgba(121,184,245,0.10)] px-1.5 font-mono text-[11px] text-[var(--ps-blue)]">
                      {variableCountLabel(variables.length)}
                    </span>
                    <SaveStatus tone={status.tone}>{status.label}</SaveStatus>
                    {validationHint && (
                      <span className="inline-flex items-center gap-1 text-[var(--ps-red)]">
                        <AlertCircle size={12} />
                        {validationHint}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4 xl:flex-row">
                  <div className="flex min-h-[280px] min-w-0 flex-1 flex-col">
                    <PromptEditor
                      ref={editorRef}
                      value={form.prompt}
                      onChange={(prompt) => patchForm({ prompt })}
                      activeVariable={usedVariable}
                      onVariableClick={setActiveVariable}
                      invalid={attempted && bodyMissing}
                      actions={
                        <button
                          type="button"
                          onClick={() => void handleSave()}
                          disabled={!dirty || saving}
                          title="Save (Ctrl+S)"
                          className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-[6px] bg-[var(--ps-green)] px-2.5 text-[12px] font-semibold text-white transition-colors duration-150 hover:bg-[#1A9660] disabled:cursor-not-allowed disabled:bg-[var(--ps-raised)] disabled:text-[var(--ps-muted)]"
                        >
                          {saving ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : justSaved ? (
                            <Check size={13} />
                          ) : null}
                          {saving ? 'Saving…' : justSaved && !dirty ? 'Saved' : saveLabel}
                          <kbd className="hidden rounded-[3px] bg-black/20 px-1 font-mono text-[10px] font-normal 2xl:inline">
                            Ctrl S
                          </kbd>
                        </button>
                      }
                    />
                  </div>
                  <VariableInspector
                    variables={variables}
                    activeVariable={usedVariable}
                    onSelect={setActiveVariable}
                    onReveal={(occurrence) => editorRef.current?.reveal(occurrence.start, occurrence.end)}
                    className="max-h-[200px] shrink-0 xl:max-h-full xl:w-[248px] xl:self-start"
                  />
                </div>
              </>
            ) : null}
          </section>
        </div>

        <ConfirmDialog
          open={pendingDelete !== null}
          onOpenChange={(open) => {
            if (!open) setPendingDelete(null);
          }}
          title="Delete this prompt?"
          description={
            <>
              <span className="font-semibold text-[var(--ps-text)]">
                &ldquo;{pendingDelete?.name || 'Untitled prompt'}&rdquo;
              </span>{' '}
              will be removed. This cannot be undone. Agents will no longer be able to use it.
            </>
          }
          confirmLabel="Delete prompt"
          variant="danger"
          loading={deleting}
          onConfirm={() => void handleDelete()}
        />

        <Dialog
          open={pendingAction !== null}
          onOpenChange={(open) => {
            if (!open) setPendingAction(null);
          }}
          title="You have unsaved changes"
          description={
            <>
              Changes to{' '}
              <span className="font-semibold text-[var(--ps-text)]">
                &ldquo;{form.name.trim() || 'Untitled prompt'}&rdquo;
              </span>{' '}
              will be lost if you continue without saving.
            </>
          }
          width={440}
          footer={
            <>
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="mr-auto h-8 rounded-[7px] px-3 text-[12.5px] font-medium text-[var(--ps-text-2)] hover:bg-[var(--ps-raised)] hover:text-[var(--ps-text)]"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={() => {
                  const action = pendingAction;
                  setPendingAction(null);
                  action?.();
                }}
                className="h-8 rounded-[7px] px-3 text-[12.5px] font-medium text-[var(--ps-red)] ring-1 ring-inset ring-[var(--ps-border)] hover:bg-[rgba(228,119,119,0.10)]"
              >
                Discard
              </button>
              <button
                type="button"
                disabled={!canSave || saving}
                onClick={async () => {
                  const action = pendingAction;
                  const ok = await handleSave();
                  setPendingAction(null);
                  if (ok) action?.();
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-[7px] bg-[var(--ps-green)] px-3 text-[12.5px] font-semibold text-white hover:bg-[#1A9660] disabled:cursor-not-allowed disabled:bg-[var(--ps-raised)] disabled:text-[var(--ps-muted)]"
              >
                {saving && <Loader2 size={13} className="animate-spin" />}
                Save and continue
              </button>
            </>
          }
        />
      </div>
    </>
  );
}

function SaveStatus({
  tone,
  children,
}: {
  tone: 'saving' | 'saved' | 'dirty' | 'idle' | 'draft';
  children: ReactNode;
}) {
  return (
    <span
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-1.5',
        tone === 'dirty' ? 'text-[var(--ps-amber)]' : tone === 'saved' ? 'text-[var(--ps-green-active)]' : 'text-[var(--ps-muted)]',
      )}
    >
      {tone === 'saving' ? (
        <Loader2 size={12} className="animate-spin" />
      ) : tone === 'saved' ? (
        <Check size={12} />
      ) : (
        <span
          className={cn(
            'size-1.5 rounded-full',
            tone === 'dirty' ? 'bg-[var(--ps-amber)]' : tone === 'draft' ? 'bg-[var(--ps-muted)]' : 'bg-[var(--ps-green-active)]',
          )}
        />
      )}
      {children}
    </span>
  );
}

function EditorMenuItem({
  icon,
  label,
  onClick,
  danger,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] transition-colors duration-150 disabled:opacity-40',
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

function EditorSkeleton() {
  return (
    <div aria-hidden className="flex min-h-0 flex-1 flex-col">
      <div className="h-6 w-64 animate-pulse rounded-[5px] bg-[var(--ps-raised)] motion-reduce:animate-none" />
      <div className="mt-2.5 h-3.5 w-96 max-w-full animate-pulse rounded-[4px] bg-[var(--ps-raised)] motion-reduce:animate-none" />
      <div className="mt-6 min-h-[280px] flex-1 animate-pulse rounded-[10px] bg-[var(--ps-surface)] motion-reduce:animate-none" />
    </div>
  );
}
