'use client';

import { useEffect, useRef, useState } from 'react';
import { Bold, Code, Italic, Link2, List, ListOrdered, Quote } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { MarkdownContent } from '@/components/ui/MarkdownContent';
import { cn } from '@/lib/utils';
import { MemoryModal, ModalButton } from './MemoryModal';
import { TITLE_WORD_LIMIT, wordCount } from './memory-model';

type Mode = 'write' | 'preview';

export function MemoryEditorDialog({
  open,
  editing,
  initialTitle,
  initialBody,
  saving,
  onSave,
  onClose,
}: {
  open: boolean;
  editing: boolean;
  initialTitle: string;
  initialBody: string;
  saving: boolean;
  onSave: (payload: { title: string; memory: string }) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [mode, setMode] = useState<Mode>('write');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [touched, setTouched] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const words = wordCount(title);
  const titleTooLong = words > TITLE_WORD_LIMIT;
  const titleMissing = title.trim().length === 0;
  const bodyMissing = body.trim().length === 0;
  const canSave = !titleMissing && !bodyMissing && !titleTooLong && !saving;
  const dirty = title !== initialTitle || body !== initialBody;

  useEffect(() => {
    if (!open || !dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [open, dirty]);

  const requestClose = () => {
    if (saving) return;
    if (dirty) setConfirmDiscard(true);
    else onClose();
  };

  const submit = () => {
    setTouched(true);
    if (!canSave) return;
    onSave({ title: title.trim(), memory: body.trim() });
  };

  const applyFormat = (kind: FormatKind) => {
    const el = bodyRef.current;
    if (!el) return;
    const { value, caret } = formatSelection(body, el.selectionStart, el.selectionEnd, kind);
    setBody(value);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret[0], caret[1]);
    });
  };

  return (
    <>
      <MemoryModal
        open={open}
        onRequestClose={requestClose}
        title={editing ? 'Edit memory' : 'New memory'}
        description="A short title and a Markdown body. Your agents can read it in any session."
        width={660}
        initialFocusRef={titleRef}
        footer={
          <>
            <span className="mr-auto hidden text-[11.5px] text-[var(--mm-muted)] sm:inline">
              <kbd className="rounded-[4px] bg-[var(--mm-elevated)] px-1 py-px text-[10.5px]">Ctrl</kbd>
              {' + '}
              <kbd className="rounded-[4px] bg-[var(--mm-elevated)] px-1 py-px text-[10.5px]">Enter</kbd>
              {editing ? ' to save' : ' to create'}
            </span>
            <ModalButton onClick={requestClose} disabled={saving}>
              Cancel
            </ModalButton>
            <ModalButton variant="primary" onClick={submit} disabled={!canSave}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create memory'}
            </ModalButton>
          </>
        }
      >
        <div
          className="space-y-5"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              submit();
            }
          }}
        >
          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <label htmlFor="memory-title" className="text-[12.5px] font-medium text-[var(--mm-text-2)]">
                Title
              </label>
              <span
                aria-live="polite"
                className={cn(
                  'text-[11.5px] tabular-nums',
                  titleTooLong ? 'text-[var(--mm-red)]' : 'text-[var(--mm-muted)]',
                )}
              >
                {words}/{TITLE_WORD_LIMIT} words
              </span>
            </div>
            <input
              id="memory-title"
              ref={titleRef}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Deploy window rules"
              aria-invalid={titleTooLong || (touched && titleMissing)}
              aria-describedby="memory-title-hint"
              style={{ background: 'var(--mm-bg)' }}
              className={cn(
                'h-10 w-full rounded-[9px] border px-3 text-[14px] font-medium text-[var(--mm-text)] outline-none transition-colors duration-150 placeholder:font-normal placeholder:text-[var(--mm-muted)]',
                titleTooLong || (touched && titleMissing)
                  ? 'border-[rgba(240,120,120,0.55)]'
                  : 'border-[var(--mm-border)] focus:border-[rgba(0,184,121,0.6)]',
              )}
            />
            <p
              id="memory-title-hint"
              className={cn(
                'mt-1.5 text-[11.5px]',
                titleTooLong || (touched && titleMissing) ? 'text-[var(--mm-red)]' : 'text-[var(--mm-muted)]',
              )}
            >
              {titleTooLong
                ? `Titles can be at most ${TITLE_WORD_LIMIT} words. Remove ${words - TITLE_WORD_LIMIT}.`
                : touched && titleMissing
                  ? 'Add a title.'
                  : `Keep it to ${TITLE_WORD_LIMIT} words or fewer so it is easy to recall.`}
            </p>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="text-[12.5px] font-medium text-[var(--mm-text-2)]">Content</span>
              <div
                role="tablist"
                aria-label="Editor mode"
                className="flex h-7 items-center rounded-[7px] bg-[var(--mm-bg)] p-0.5 ring-1 ring-inset ring-[var(--mm-border)]"
              >
                {(['write', 'preview'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={mode === value}
                    onClick={() => setMode(value)}
                    className={cn(
                      'h-full rounded-[5px] px-2.5 text-[12px] font-medium capitalize transition-colors duration-150',
                      mode === value
                        ? 'bg-[var(--mm-elevated)] text-[var(--mm-text)]'
                        : 'text-[var(--mm-muted)] hover:text-[var(--mm-text)]',
                    )}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div
              data-input-shell
              className={cn(
                'overflow-hidden rounded-[9px] border transition-colors duration-150',
                touched && bodyMissing
                  ? 'border-[rgba(240,120,120,0.55)]'
                  : 'border-[var(--mm-border)] focus-within:border-[rgba(0,184,121,0.6)]',
              )}
              style={{ background: 'var(--mm-bg)' }}
            >
              {mode === 'write' ? (
                <>
                  <div className="flex items-center gap-0.5 border-b border-[var(--mm-border)] px-1.5 py-1">
                    {FORMAT_BUTTONS.map(({ kind, label, icon: Icon }) => (
                      <button
                        key={kind}
                        type="button"
                        aria-label={label}
                        title={label}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => applyFormat(kind)}
                        className="flex size-7 items-center justify-center rounded-[6px] text-[var(--mm-muted)] transition-colors duration-150 hover:bg-[var(--mm-elevated)] hover:text-[var(--mm-text)]"
                      >
                        <Icon size={14} />
                      </button>
                    ))}
                    <span className="ml-auto pr-1.5 text-[11px] text-[var(--mm-muted)]">Markdown</span>
                  </div>
                  <textarea
                    ref={bodyRef}
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    placeholder={'Write what your agents should remember.\n\n- Never push to `main`\n- Deploys run 02:00–04:00 UTC'}
                    aria-label="Memory content"
                    aria-invalid={touched && bodyMissing}
                    style={{ background: 'transparent', border: 0 }}
                    className="block h-[300px] max-h-[48dvh] min-h-[180px] w-full resize-y px-3.5 py-3 font-mono text-[13px] leading-[1.65] text-[var(--mm-text)] outline-none placeholder:text-[var(--mm-muted)]"
                  />
                </>
              ) : (
                <div className="h-[337px] max-h-[calc(48dvh+37px)] min-h-[217px] overflow-y-auto px-4 py-3.5 text-[14px]">
                  {bodyMissing ? (
                    <p className="text-[13px] text-[var(--mm-muted)]">Nothing to preview yet.</p>
                  ) : (
                    <MarkdownContent content={body} />
                  )}
                </div>
              )}
            </div>
            {touched && bodyMissing && (
              <p className="mt-1.5 text-[11.5px] text-[var(--mm-red)]">Add some content.</p>
            )}
          </div>
        </div>
      </MemoryModal>

      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        variant="danger"
        title="Discard unsaved changes?"
        description={
          editing
            ? 'Your edits to this memory have not been saved.'
            : 'This memory has not been created yet.'
        }
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
      />
    </>
  );
}

type FormatKind = 'bold' | 'italic' | 'code' | 'link' | 'bullet' | 'number' | 'quote';

const FORMAT_BUTTONS: { kind: FormatKind; label: string; icon: typeof Bold }[] = [
  { kind: 'bold', label: 'Bold', icon: Bold },
  { kind: 'italic', label: 'Italic', icon: Italic },
  { kind: 'code', label: 'Inline code', icon: Code },
  { kind: 'link', label: 'Link', icon: Link2 },
  { kind: 'bullet', label: 'Bulleted list', icon: List },
  { kind: 'number', label: 'Numbered list', icon: ListOrdered },
  { kind: 'quote', label: 'Quote', icon: Quote },
];

function formatSelection(
  value: string,
  start: number,
  end: number,
  kind: FormatKind,
): { value: string; caret: [number, number] } {
  const selected = value.slice(start, end);
  const wrap = (before: string, after: string, placeholder: string) => {
    const inner = selected || placeholder;
    const next = value.slice(0, start) + before + inner + after + value.slice(end);
    const from = start + before.length;
    return { value: next, caret: [from, from + inner.length] as [number, number] };
  };

  if (kind === 'bold') return wrap('**', '**', 'bold text');
  if (kind === 'italic') return wrap('_', '_', 'italic text');
  if (kind === 'code') return wrap('`', '`', 'code');
  if (kind === 'link') return wrap('[', '](https://)', 'link text');

  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const block = value.slice(lineStart, end);
  const lines = block.split('\n');
  const prefixed = lines
    .map((line, index) =>
      kind === 'bullet' ? `- ${line}` : kind === 'number' ? `${index + 1}. ${line}` : `> ${line}`,
    )
    .join('\n');
  const next = value.slice(0, lineStart) + prefixed + value.slice(end);
  return { value: next, caret: [lineStart, lineStart + prefixed.length] };
}
