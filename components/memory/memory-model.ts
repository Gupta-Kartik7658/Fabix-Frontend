import type { CSSProperties } from 'react';
import type { Memory, MemoryShare } from '@/lib/types';

export const TITLE_WORD_LIMIT = 4;

export type MemoryFilter = 'all' | 'pinned' | 'shared';
export type MemorySort = 'updated' | 'created' | 'title';
export type MemoryDensity = 'comfortable' | 'compact';

export const MEMORY_FILTERS: { id: MemoryFilter; label: string }[] = [
  { id: 'all', label: 'All memories' },
  { id: 'pinned', label: 'Pinned' },
  { id: 'shared', label: 'Shared' },
];

export const MEMORY_SORTS: { id: MemorySort; label: string }[] = [
  { id: 'updated', label: 'Last updated' },
  { id: 'created', label: 'Date created' },
  { id: 'title', label: 'Title A–Z' },
];

/**
 * Page tokens, plus overrides for the global tokens that shared components
 * (Button, ConfirmDialog, MarkdownContent, ShareMemoryDialog) read, so they
 * match when rendered inside this page.
 */
export const MEMORY_THEME = {
  '--mm-bg': '#080B09',
  '--mm-panel': '#101713',
  '--mm-elevated': '#141C17',
  '--mm-selected': '#14251B',
  '--mm-border': '#202B25',
  '--mm-border-strong': '#2B3832',
  '--mm-green': '#00B879',
  '--mm-mint': '#69E6B0',
  '--mm-text': '#F2F7F3',
  '--mm-text-2': '#A2B3A9',
  '--mm-muted': '#718078',
  '--mm-red': '#F07878',
  '--white-0': '#101713',
  '--bg-surface': '#101713',
  '--neutral-weak-50': '#141C17',
  '--neutral-soft-400': '#718078',
  '--neutral-sub-600': '#A2B3A9',
  '--neutral-strong-950': '#F2F7F3',
  '--stroke-soft-200': '#202B25',
  '--stroke-sub-300': '#2B3832',
  '--primary-base': '#00B879',
  '--primary-alpha-10': 'rgba(0, 184, 121, 0.10)',
  '--primary-alpha-16': 'rgba(0, 184, 121, 0.16)',
  '--error': '#F07878',
  '--error-dark': '#F07878',
  '--error-lighter': 'rgba(240, 120, 120, 0.12)',
  '--btn-primary-bg': '#0A8F60',
  '--btn-primary-bg-hover': '#0C9D69',
  '--btn-primary-bg-active': '#087D54',
  '--btn-primary-border': 'transparent',
  '--btn-primary-shadow': 'none',
  backgroundColor: '#080B09',
  color: '#F2F7F3',
  colorScheme: 'dark',
} as CSSProperties;

export function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export function isActiveShare(share: MemoryShare): boolean {
  return !share.status || share.status === 'pending';
}

/** List rows show plain text — never rendered Markdown. */
export function plainTextFromMarkdown(source: string): string {
  return source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, '· ')
    .replace(/(\*\*|__|~~)(.+?)\1/g, '$2')
    .replace(/(^|[^\w*])[*_](\S(?:.*?\S)?)[*_](?![\w*])/g, '$1$2')
    .replace(/\s+/g, ' ')
    .replace(/^· /, '')
    .trim();
}

function timeOf(value: string | null | undefined): number {
  const t = value ? new Date(value).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

export function updatedTime(memory: Memory): number {
  return timeOf(memory.updated_at ?? memory.created_at);
}

/** Pinned first, then newest update — the order the API rows are kept in. */
export function sortMemories(list: Memory[]): Memory[] {
  return [...list].sort((a, b) => {
    if (Boolean(a.is_pinned) !== Boolean(b.is_pinned)) return a.is_pinned ? -1 : 1;
    return updatedTime(b) - updatedTime(a);
  });
}

export function compareBy(sort: MemorySort) {
  return (a: Memory, b: Memory): number => {
    if (sort === 'title') return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    if (sort === 'created') return timeOf(b.created_at) - timeOf(a.created_at);
    return updatedTime(b) - updatedTime(a);
  };
}

export function matchesQuery(memory: Memory, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    memory.title.toLowerCase().includes(needle) || memory.memory.toLowerCase().includes(needle)
  );
}

/** Accepts a bare share code or a full `/memory/share/<code>` link. */
export function extractShareCode(input: string): string {
  const value = input.trim();
  if (!value) return '';
  const match = value.match(/\/memory\/share\/([^/?#\s]+)/);
  if (match) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  return value;
}

export function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
