import type { GuidedTourDefinition } from './types';

export const activityCenterTour: GuidedTourDefinition = {
  id: 'activity-center',
  route: '/dashboard/inbox',
  autoStart: true,
  steps: [
    {
      id: 'overview',
      title: 'Welcome to Fabix',
      variant: 'step',
      target: 'activity-stats',
      lines: [
        { speaker: 'guide', text: "Hey! I'm your guide. This is your platform at a glance." },
        { speaker: 'companion', text: 'Tap any card to dig deeper.' },
      ],
      beats: [
        { target: 'activity-stat-workspaces', label: 'Workspaces', detail: 'where agents team up' },
        { target: 'activity-stat-executions', label: 'Executions', detail: 'every tool run' },
        { target: 'activity-stat-connectors', label: 'Connectors', detail: 'what is plugged in' },
        { target: 'activity-stat-tokens', label: 'Tokens', detail: 'what agents consume' },
      ],
      primary: { label: 'Next', action: 'next' },
      secondary: { label: 'Skip', action: 'skip' },
    },
    {
      id: 'feed',
      title: 'Your activity feed',
      variant: 'step',
      target: 'activity-feed',
      lines: [
        { speaker: 'guide', text: 'Updates from every workspace land right here.' },
        { speaker: 'companion', text: 'Filter, search, and jump straight in!' },
      ],
      beats: [
        { target: 'activity-tabs', label: 'Tabs', detail: 'mentions, tasks, system' },
        { target: 'activity-filters', label: 'Filters', detail: 'unread, workspace, search' },
        { target: 'activity-notification', label: 'Notification', detail: 'one click opens it' },
      ],
      primary: { label: 'Explore Fabix', action: 'complete' },
      secondary: { label: 'Skip', action: 'skip' },
    },
  ],
};
