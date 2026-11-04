import type { GuidedTourDefinition } from './types';

export const memoryTour: GuidedTourDefinition = {
  id: 'memory',
  route: '/dashboard/memory',
  autoStart: true,
  introduction: {
    id: 'memory-intro',
    title: 'Welcome to Memory',
    lines: [
      {
        speaker: 'guide',
        text: 'This is where your agents retain important knowledge beyond individual sessions.',
      },
      {
        speaker: 'companion',
        text: 'Think of it as a shared knowledge library, so agents never start from zero!',
      },
    ],
    startLabel: 'Start exploring',
    dismissLabel: 'Maybe later',
  },
  steps: [
    {
      id: 'library',
      title: 'Your knowledge library',
      variant: 'step',
      target: 'memory-header',
      alsoTargets: ['memory-stats'],
      lines: [
        {
          speaker: 'guide',
          text: 'Store project context, decisions and instructions agents need later. The cards count your real library.',
        },
        {
          speaker: 'companion',
          text: 'Create one with a title and Markdown, or redeem a share code for your own copy!',
        },
      ],
      beats: [
        { target: 'memory-title', label: 'Memory', detail: 'kept across sessions' },
        { target: 'memory-stat-total', label: 'Total', detail: 'everything you stored' },
        { target: 'memory-stat-pinned', label: 'Pinned', detail: 'kept at the top' },
        { target: 'memory-stat-shared', label: 'Shared', detail: 'with an active share link' },
        { target: 'new-memory', label: 'New memory', detail: 'short title, Markdown body' },
        { target: 'memory-redeem', label: 'Redeem', detail: 'import your own copy' },
      ],
      primary: { label: 'Next', action: 'next' },
      secondary: { label: 'Skip', action: 'skip' },
    },
    {
      id: 'find',
      title: 'Find anything fast',
      variant: 'step',
      target: 'memory-toolbar',
      lines: [
        { speaker: 'guide', text: 'Search titles and content, or filter to pinned or shared memories.' },
        {
          speaker: 'companion',
          text: 'Sort by last updated, date created or title, and pick a comfortable or compact list.',
        },
      ],
      beats: [
        { target: 'memory-search', label: 'Search', detail: 'titles and content · press /' },
        { target: 'memory-filters', label: 'Filters', detail: 'all · pinned · shared' },
        { target: 'memory-sort', label: 'Sort', detail: 'updated · created · A–Z' },
        { target: 'memory-density', label: 'Layout', detail: 'comfortable or compact' },
      ],
      primary: { label: 'Next', action: 'next' },
      secondary: { label: 'Skip', action: 'skip' },
    },
    {
      id: 'read',
      title: 'Read and manage',
      variant: 'step',
      target: 'memory-panes',
      lines: [
        {
          speaker: 'guide',
          text: 'Pick a memory in the Library, pinned ones on top, to read it in full beside it.',
        },
        {
          speaker: 'companion',
          text: 'There you can pin, copy, share, edit or delete. Share links can be revoked anytime.',
        },
      ],
      beats: [
        { target: 'memory-library', label: 'Library', detail: 'titles, previews, last updated' },
        { target: 'memory-detail', label: 'Detail', detail: 'full Markdown and sharing' },
        { target: 'memory-detail-actions', label: 'Actions', detail: 'pin · copy · share · delete · edit' },
      ],
      primary: { label: 'Finish tour', action: 'complete' },
      secondary: { label: 'Skip', action: 'skip' },
    },
  ],
};
