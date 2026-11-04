'use client';

import { useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import { Bold, Braces, Code, Heading2, Italic, List, ListOrdered, Quote, WrapText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tokenizeLine, type Token } from './prompt-model';

export type PromptEditorHandle = {
  /** Focus the editor, select `[start, end)` and scroll it into view. */
  reveal: (start: number, end: number) => void;
  focus: () => void;
};

type FormatKind = 'heading' | 'bold' | 'italic' | 'code' | 'bullet' | 'number' | 'quote' | 'variable';

const FORMAT_GROUPS: { kind: FormatKind; label: string; icon: typeof Bold }[][] = [
  [
    { kind: 'heading', label: 'Heading', icon: Heading2 },
    { kind: 'bold', label: 'Bold', icon: Bold },
    { kind: 'italic', label: 'Italic', icon: Italic },
    { kind: 'code', label: 'Inline code', icon: Code },
  ],
  [
    { kind: 'bullet', label: 'Bulleted list', icon: List },
    { kind: 'number', label: 'Numbered list', icon: ListOrdered },
    { kind: 'quote', label: 'Quote', icon: Quote },
  ],
];

const LINE_HEIGHT = 22;

export function PromptEditor({
  ref,
  value,
  onChange,
  activeVariable,
  onVariableClick,
  actions,
  invalid,
}: {
  ref?: Ref<PromptEditorHandle>;
  value: string;
  onChange: (next: string) => void;
  activeVariable: string | null;
  onVariableClick?: (name: string) => void;
  actions?: ReactNode;
  invalid?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [caret, setCaret] = useState({ line: 1, col: 1 });
  const [wrap, setWrap] = useState(true);

  const lines = useMemo(() => {
    const out: Token[][] = [];
    let fence = false;
    for (const line of value.split('\n')) {
      const result = tokenizeLine(line, fence);
      fence = result.fence;
      out.push(result.tokens);
    }
    return out;
  }, [value]);

  const scrollToLine = (line: number) => {
    const scroller = scrollerRef.current;
    const row = overlayRef.current?.querySelector<HTMLElement>(`[data-line="${line}"]`);
    if (!scroller || !row) return;
    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    if (top < scroller.scrollTop + 8 || bottom > scroller.scrollTop + scroller.clientHeight - 8) {
      scroller.scrollTo({ top: Math.max(0, top - scroller.clientHeight / 3), behavior: 'smooth' });
    }
  };

  const updateCaret = () => {
    const el = textareaRef.current;
    if (!el) return;
    const before = el.value.slice(0, el.selectionStart);
    const line = before.split('\n').length;
    const col = el.selectionStart - before.lastIndexOf('\n');
    setCaret((prev) => (prev.line === line && prev.col === col ? prev : { line, col }));
  };

  useImperativeHandle(ref, () => ({
    reveal: (start, end) => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.setSelectionRange(start, end);
      const line = el.value.slice(0, start).split('\n').length;
      scrollToLine(line);
      updateCaret();
    },
    focus: () => textareaRef.current?.focus(),
  }));

  /** Uses insertText so the browser's own undo history keeps working. */
  const replaceRange = (start: number, end: number, text: string, select: [number, number]) => {
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(start, end);
    const ok = typeof document.execCommand === 'function' && document.execCommand('insertText', false, text);
    if (!ok) onChange(el.value.slice(0, start) + text + el.value.slice(end));
    requestAnimationFrame(() => {
      el.setSelectionRange(select[0], select[1]);
      updateCaret();
    });
  };

  const applyFormat = (kind: FormatKind) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = el.value.slice(start, end);

    const wrapWith = (before: string, after: string, placeholder: string) => {
      const inner = selected || placeholder;
      const from = start + before.length;
      replaceRange(start, end, before + inner + after, [from, from + inner.length]);
    };

    if (kind === 'bold') return wrapWith('**', '**', 'bold text');
    if (kind === 'italic') return wrapWith('_', '_', 'italic text');
    if (kind === 'code') return wrapWith('`', '`', 'code');
    if (kind === 'variable') return wrapWith('{', '}', 'variable_name');

    const lineStart = el.value.lastIndexOf('\n', start - 1) + 1;
    const block = el.value.slice(lineStart, end);
    const next = block
      .split('\n')
      .map((line, index) => {
        if (kind === 'heading') return `## ${line.replace(/^#{1,6}\s/, '')}`;
        if (kind === 'bullet') return `- ${line}`;
        if (kind === 'number') return `${index + 1}. ${line}`;
        return `> ${line}`;
      })
      .join('\n');
    replaceRange(lineStart, end, next, [lineStart + next.length, lineStart + next.length]);
  };

  const lineCount = lines.length;
  const gutterWidth = Math.max(2, String(lineCount).length) * 8 + 28;
  const textMetrics = cn(
    'font-mono text-[13px] tracking-normal [tab-size:4]',
    wrap ? 'whitespace-pre-wrap [overflow-wrap:anywhere]' : 'whitespace-pre',
  );

  return (
    <div
      data-input-shell
      className={cn(
        'flex min-h-0 flex-1 flex-col overflow-hidden rounded-[10px] border bg-[var(--ps-input)] transition-colors duration-150',
        invalid ? 'border-[rgba(228,119,119,0.5)]' : 'border-[var(--ps-border)] focus-within:border-[rgba(57,185,130,0.55)]',
      )}
    >
      <div data-tour="prompt-toolbar" className="flex h-10 shrink-0 items-center gap-1 border-b border-[var(--ps-border)] bg-[var(--ps-surface)] px-2">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
        {FORMAT_GROUPS.map((group, index) => (
          <div key={index} className="flex shrink-0 items-center gap-0.5">
            {index > 0 && <span aria-hidden className="mx-1 h-4 w-px bg-[var(--ps-border)]" />}
            {group.map(({ kind, label, icon: Icon }) => (
              <ToolbarButton key={kind} label={label} onClick={() => applyFormat(kind)}>
                <Icon size={14} />
              </ToolbarButton>
            ))}
          </div>
        ))}
        <span aria-hidden className="mx-1 h-4 w-px bg-[var(--ps-border)]" />
        <button
          type="button"
          title="Insert variable"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => applyFormat('variable')}
          className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[6px] px-2 text-[12px] font-medium text-[var(--ps-blue)] transition-colors duration-150 hover:bg-[rgba(121,184,245,0.10)]"
        >
          <Braces size={14} />
          <span className="hidden 2xl:inline">Variable</span>
        </button>
        <ToolbarButton label={wrap ? 'Disable line wrap' : 'Enable line wrap'} active={wrap} onClick={() => setWrap((w) => !w)}>
          <WrapText size={14} />
        </ToolbarButton>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-3 pl-2">
          <span className="hidden whitespace-nowrap font-mono text-[11px] tabular-nums text-[var(--ps-muted)] 2xl:inline">
            Ln {caret.line}, Col {caret.col}
            <span className="mx-1.5">·</span>
            {lineCount} {lineCount === 1 ? 'line' : 'lines'}
          </span>
          {actions}
        </div>
      </div>

      <div ref={scrollerRef} data-tour="prompt-body" className="relative min-h-0 flex-1 overflow-auto">
        <div className={cn('relative min-h-full py-3', !wrap && 'w-max min-w-full')}>
          <div ref={overlayRef} aria-hidden className="pointer-events-none select-none">
            {lines.map((tokens, index) => {
              const number = index + 1;
              const current = number === caret.line;
              return (
                <div key={index} data-line={number} className={cn('flex', current && 'bg-[rgba(240,243,241,0.025)]')}>
                  <span
                    style={{ width: gutterWidth, lineHeight: `${LINE_HEIGHT}px` }}
                    className={cn(
                      'sticky left-0 shrink-0 bg-[var(--ps-input)] pr-3 text-right font-mono text-[11.5px] tabular-nums',
                      current ? 'text-[var(--ps-text-2)]' : 'text-[#4A534D]',
                    )}
                  >
                    {number}
                  </span>
                  <div
                    style={{ lineHeight: `${LINE_HEIGHT}px`, minHeight: LINE_HEIGHT }}
                    className={cn('min-w-0 flex-1 pr-5 text-[var(--ps-text)]', textMetrics)}
                  >
                    {tokens.map((token, i) => (
                      <TokenSpan key={i} token={token} active={token.variable === activeVariable} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              updateCaret();
            }}
            onSelect={updateCaret}
            onKeyUp={updateCaret}
            onClick={(event) => {
              updateCaret();
              if (!onVariableClick) return;
              const el = event.currentTarget;
              if (el.selectionStart !== el.selectionEnd) return;
              const pos = el.selectionStart;
              const lineStart = el.value.lastIndexOf('\n', pos - 1) + 1;
              const lineEnd = el.value.indexOf('\n', pos);
              const line = el.value.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
              const re = /\{([^{}\n]+)\}/g;
              let match: RegExpExecArray | null;
              while ((match = re.exec(line)) !== null) {
                const s = lineStart + match.index;
                if (pos > s && pos < s + match[0].length && match[1].trim()) {
                  onVariableClick(match[1].trim());
                  return;
                }
              }
            }}
            wrap={wrap ? 'soft' : 'off'}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            aria-label="Prompt body"
            aria-invalid={invalid}
            placeholder={'Write the instructions your agent should follow.\n\nAnything in {curly_braces} becomes a variable.'}
            style={{
              left: gutterWidth,
              lineHeight: `${LINE_HEIGHT}px`,
              background: 'transparent',
              border: 0,
              boxShadow: 'none',
              color: 'transparent',
              WebkitTextFillColor: 'transparent',
            }}
            className={cn(
              'absolute inset-y-0 right-0 resize-none overflow-hidden py-3 pr-5 text-transparent caret-[var(--ps-text)] outline-none',
              'placeholder:text-[var(--ps-muted)] selection:bg-[rgba(57,185,130,0.28)] selection:text-transparent',
              textMetrics,
            )}
          />
        </div>
      </div>
    </div>
  );
}

function TokenSpan({ token, active }: { token: Token; active: boolean }) {
  if (token.kind === 'variable') {
    return (
      <span
        data-tour="prompt-variable-token"
        className={cn(
          'rounded-[3px] text-[var(--ps-blue)] transition-colors duration-150',
          active
            ? 'bg-[rgba(121,184,245,0.28)] shadow-[0_0_0_1px_rgba(121,184,245,0.55)]'
            : 'bg-[rgba(121,184,245,0.10)]',
        )}
      >
        {token.text}
      </span>
    );
  }
  if (token.kind === 'markdown') return <span className="text-[var(--ps-purple)]">{token.text}</span>;
  if (token.kind === 'code') return <span className="text-[var(--ps-text-2)]">{token.text}</span>;
  return <span>{token.text}</span>;
}

function ToolbarButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-[6px] transition-colors duration-150 hover:bg-[var(--ps-raised)] hover:text-[var(--ps-text)]',
        active ? 'text-[var(--ps-text-2)]' : 'text-[var(--ps-muted)]',
      )}
    >
      {children}
    </button>
  );
}
