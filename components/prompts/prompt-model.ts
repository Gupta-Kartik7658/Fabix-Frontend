import type { CSSProperties } from 'react';
import type { UserPrompt } from '@/lib/types';

export type PromptFormState = {
  name: string;
  description: string;
  prompt: string;
};

export const emptyForm = (): PromptFormState => ({
  name: '',
  description: '',
  prompt: '',
});

export function formFromPrompt(prompt: UserPrompt): PromptFormState {
  return {
    name: prompt.name ?? '',
    description: prompt.description ?? '',
    prompt: prompt.prompt ?? '',
  };
}

export type PromptVariable = { name: string; line: number };

export function extractPromptVariables(body: string): PromptVariable[] {
  const seen = new Map<string, number>();
  const lines = body.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const re = /\{([^{}\n]+)\}/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(lines[i])) !== null) {
      const name = match[1].trim();
      if (!name || seen.has(name)) continue;
      seen.set(name, i + 1);
    }
  }
  return [...seen.entries()].map(([name, line]) => ({ name, line }));
}

export type VariableOccurrence = { line: number; start: number; end: number };
export type VariableDetail = PromptVariable & { occurrences: VariableOccurrence[] };

/**
 * Same matching rule as `extractPromptVariables`, keeping every occurrence
 * with its absolute character offsets so the editor can select it.
 */
export function inspectPromptVariables(body: string): VariableDetail[] {
  const byName = new Map<string, VariableOccurrence[]>();
  const lines = body.split('\n');
  let offset = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const re = /\{([^{}\n]+)\}/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(lines[i])) !== null) {
      const name = match[1].trim();
      if (!name) continue;
      const list = byName.get(name) ?? [];
      list.push({ line: i + 1, start: offset + match.index, end: offset + match.index + match[0].length });
      byName.set(name, list);
    }
    offset += lines[i].length + 1;
  }
  return extractPromptVariables(body).map((variable) => ({
    ...variable,
    occurrences: byName.get(variable.name) ?? [],
  }));
}

export type Token = { text: string; kind: 'text' | 'variable' | 'markdown' | 'code'; variable?: string };

const INLINE_RE = /(\{[^{}\n]+\})|(\*\*|__|`|~~)/g;

/** Splits one line for display. Never changes the characters, only wraps them. */
export function tokenizeLine(line: string, inFence: boolean): { tokens: Token[]; fence: boolean } {
  const fenceMatch = /^\s*```/.test(line);
  if (fenceMatch) return { tokens: [{ text: line, kind: 'markdown' }], fence: !inFence };
  if (inFence) return { tokens: splitVariables(line, 'code'), fence: true };

  const tokens: Token[] = [];
  let rest = line;
  const prefix = rest.match(/^(\s*)(#{1,6}\s|>\s?|[-*+]\s|\d+\.\s)/);
  if (prefix) {
    if (prefix[1]) tokens.push({ text: prefix[1], kind: 'text' });
    tokens.push({ text: prefix[2], kind: 'markdown' });
    rest = rest.slice(prefix[0].length);
  }

  let last = 0;
  INLINE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE_RE.exec(rest)) !== null) {
    if (match.index > last) tokens.push({ text: rest.slice(last, match.index), kind: 'text' });
    if (match[1]) {
      const name = match[1].slice(1, -1).trim();
      tokens.push({ text: match[1], kind: name ? 'variable' : 'text', variable: name || undefined });
    } else {
      tokens.push({ text: match[2], kind: 'markdown' });
    }
    last = match.index + match[0].length;
  }
  if (last < rest.length) tokens.push({ text: rest.slice(last), kind: 'text' });
  return { tokens, fence: false };
}

function splitVariables(line: string, kind: Token['kind']): Token[] {
  const out: Token[] = [];
  const re = /\{[^{}\n]+\}/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(line)) !== null) {
    if (match.index > last) out.push({ text: line.slice(last, match.index), kind });
    const name = match[0].slice(1, -1).trim();
    out.push({ text: match[0], kind: name ? 'variable' : kind, variable: name || undefined });
    last = match.index + match[0].length;
  }
  if (last < line.length) out.push({ text: line.slice(last), kind });
  return out;
}

export type PromptSort = 'edited' | 'name' | 'variables';

export const PROMPT_SORTS: { id: PromptSort; label: string }[] = [
  { id: 'edited', label: 'Last edited' },
  { id: 'name', label: 'Name A–Z' },
  { id: 'variables', label: 'Most variables' },
];

function editedTime(prompt: UserPrompt): number {
  const value = prompt.updated_at ?? prompt.created_at;
  const t = value ? new Date(value).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

export function sortPrompts(list: UserPrompt[], sort: PromptSort, counts: Map<string, number>): UserPrompt[] {
  return [...list].sort((a, b) => {
    if (sort === 'name') return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
    if (sort === 'variables') {
      const diff = (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0);
      if (diff !== 0) return diff;
    }
    return editedTime(b) - editedTime(a);
  });
}

export function variableCountLabel(count: number): string {
  if (count === 1) return '1 variable';
  return `${count} variables`;
}

/**
 * Page tokens plus overrides for the global tokens shared components read
 * (Button, ConfirmDialog, workspaces Dialog), so they match on this page.
 */
export const PROMPT_THEME = {
  '--ps-bg': '#090B0A',
  '--ps-sidebar': '#0D100E',
  '--ps-surface': '#111513',
  '--ps-input': '#0B0E0C',
  '--ps-raised': '#171C19',
  '--ps-border': '#252B27',
  '--ps-border-soft': '#1B201D',
  '--ps-text': '#F0F3F1',
  '--ps-text-2': '#A1AAA4',
  '--ps-muted': '#737D76',
  '--ps-green': '#168653',
  '--ps-green-active': '#39B982',
  '--ps-blue': '#79B8F5',
  '--ps-purple': '#C5A4F5',
  '--ps-amber': '#E7B75B',
  '--ps-red': '#E47777',
  '--white-0': '#111513',
  '--bg-surface': '#111513',
  '--neutral-weak-50': '#171C19',
  '--neutral-soft-400': '#737D76',
  '--neutral-sub-600': '#A1AAA4',
  '--neutral-strong-950': '#F0F3F1',
  '--stroke-soft-200': '#252B27',
  '--stroke-sub-300': '#303732',
  '--primary-base': '#39B982',
  '--primary-alpha-10': 'rgba(57, 185, 130, 0.10)',
  '--primary-alpha-16': 'rgba(57, 185, 130, 0.16)',
  '--primary-alpha-24': 'rgba(57, 185, 130, 0.24)',
  '--error': '#E47777',
  '--error-dark': '#E47777',
  '--error-lighter': 'rgba(228, 119, 119, 0.12)',
  '--btn-primary-bg': '#168653',
  '--btn-primary-bg-hover': '#1A9660',
  '--btn-primary-bg-active': '#127347',
  '--btn-primary-border': 'transparent',
  '--btn-primary-shadow': 'none',
  backgroundColor: '#090B0A',
  color: '#F0F3F1',
  colorScheme: 'dark',
} as CSSProperties;
