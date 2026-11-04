import type { GuidedTourDefinition, PageIntroduction, TourStep } from './types';

export type { PageIntroduction };
export type WorkspaceSectionId = 'conversation' | 'agents' | 'tasks' | 'runs' | 'settings' | 'files';
export type WorkspacePageId = 'workspace' | WorkspaceSectionId;

export type WorkspacePageOnboarding = {
  page: WorkspacePageId;
  /**
   * `workspace`: remembered per workspace, so every new room gets its welcome.
   * `user`: remembered once per user, so a section is not re-taught in every room.
   */
  scope: 'workspace' | 'user';
  introduction: PageIntroduction;
  tour: GuidedTourDefinition;
};

/** Steps are capped at three so a page tour reads in seconds. */
export const MAX_PAGE_TOUR_STEPS = 3;

export function workspaceTourKey(entry: Pick<WorkspacePageOnboarding, 'page' | 'scope'>, workspaceId: string): string {
  return entry.scope === 'workspace' ? `workspace:${workspaceId}:${entry.page}` : `workspace:*:${entry.page}`;
}

/** Drops optional steps whose target is absent and keeps the last step a finisher. */
export function resolveTourSteps(steps: TourStep[], isPresent: (target: string) => boolean): TourStep[] {
  const kept = steps.filter((step) => !step.optional || !step.target || isPresent(step.target));
  const list = kept.length ? kept : steps.slice(0, 1);
  return list.map((step, index) => {
    const last = index === list.length - 1;
    if (last && step.primary.action !== 'complete') return { ...step, primary: { label: 'Done', action: 'complete' } };
    if (!last && step.primary.action === 'complete') return { ...step, primary: { label: 'Next', action: 'next' } };
    return step;
  });
}

const SKIP = { label: 'Skip', action: 'skip' } as const;
const NEXT = { label: 'Next', action: 'next' } as const;
const DONE = { label: 'Done', action: 'complete' } as const;

const workspace: WorkspacePageOnboarding = {
  page: 'workspace',
  scope: 'workspace',
  introduction: {
    id: 'workspace-intro',
    title: 'Welcome to your workspace',
    lines: [
      {
        speaker: 'guide',
        text: 'This is where your AI agents collaborate, share context and work towards a common goal.',
      },
      { speaker: 'companion', text: "Think of it as your team's shared room. Quick look around?" },
    ],
    startLabel: 'Show me around',
    dismissLabel: 'Not now',
  },
  tour: {
    id: 'workspace-tour',
    steps: [
      {
        id: 'brief',
        title: 'Name, goal and crew',
        variant: 'step',
        target: 'ws-header',
        lines: [
          { speaker: 'guide', text: 'Your workspace name and goal sit up top, with its agents and stats below.' },
          { speaker: 'companion', text: 'Click the name or goal to edit it in place.' },
        ],
        beats: [
          { target: 'ws-title', label: 'Name', detail: 'click to rename' },
          { target: 'ws-goal', label: 'Goal', detail: 'what the agents work towards' },
          { target: 'ws-stats', label: 'Crew', detail: 'agents, runs and tokens' },
        ],
        primary: NEXT,
        secondary: SKIP,
      },
      {
        id: 'sections',
        title: 'Six sections',
        variant: 'step',
        target: 'ws-sections',
        lines: [
          { speaker: 'guide', text: 'Conversation, Agents, Tasks, Runs, Settings and Files live here.' },
          { speaker: 'companion', text: 'Each one has its own quick intro the first time you open it!' },
        ],
        primary: { label: 'Got it', action: 'complete' },
        secondary: SKIP,
      },
    ],
  },
};

const conversation: WorkspacePageOnboarding = {
  page: 'conversation',
  scope: 'user',
  introduction: {
    id: 'conversation-intro',
    title: 'Conversation',
    lines: [
      { speaker: 'guide', text: 'This is your shared conversation. Every agent and workspace member talks here.' },
      { speaker: 'companion', text: 'Want to see mentions and message actions?' },
    ],
    startLabel: 'Take the tour',
    dismissLabel: 'Not now',
  },
  tour: {
    id: 'conversation-tour',
    steps: [
      {
        id: 'feed',
        title: 'Shared conversation',
        variant: 'step',
        target: 'ws-conversation-feed',
        lines: [
          { speaker: 'guide', text: 'Every participating agent and workspace member communicates here.' },
          { speaker: 'companion', text: 'Each message shows who sent it, their role and when.' },
        ],
        beats: [{ target: 'ws-message', label: 'Message', detail: 'sender, role and time' }],
        primary: NEXT,
        secondary: SKIP,
      },
      {
        id: 'actions',
        title: 'Message actions',
        variant: 'step',
        target: 'ws-message',
        optional: true,
        lines: [
          { speaker: 'guide', text: 'Hover any message to reveal its actions.' },
          { speaker: 'companion', text: "Create a task from it, or open the runs behind an agent's work." },
        ],
        primary: NEXT,
        secondary: SKIP,
      },
      {
        id: 'composer',
        title: 'Message composer',
        variant: 'step',
        target: 'ws-composer',
        lines: [
          { speaker: 'guide', text: "Send instructions or coordinate work here. Type @ to get an agent's attention." },
          { speaker: 'companion', text: "That's how your agents talk. Explore the other sections whenever you like!" },
        ],
        beats: [{ target: 'ws-composer-mention', label: '@ Mention', detail: 'ping an agent or person' }],
        primary: DONE,
        secondary: SKIP,
      },
    ],
  },
};

const agents: WorkspacePageOnboarding = {
  page: 'agents',
  scope: 'user',
  introduction: {
    id: 'agents-intro',
    title: 'Agents',
    lines: [
      { speaker: 'guide', text: "This is the roster: every agent registered here and what it's been doing." },
      { speaker: 'companion', text: 'Three quick stops and keys will make sense.' },
    ],
    startLabel: 'Take the tour',
    dismissLabel: 'Not now',
  },
  tour: {
    id: 'agents-tour',
    steps: [
      {
        id: 'roster',
        title: 'Your agents',
        variant: 'step',
        target: 'ws-agents-list',
        lines: [
          { speaker: 'guide', text: 'Each agent has a handle for @mentions and an optional role.' },
          { speaker: 'companion', text: 'Runs and tokens show how busy each one has been.' },
        ],
        beats: [
          { target: 'ws-agent-identity', label: 'Handle & role', detail: 'used for @mentions' },
          { target: 'ws-agent-runs', label: 'Runs', detail: 'tool executions' },
          { target: 'ws-agent-tokens', label: 'Tokens', detail: 'what it consumed' },
        ],
        primary: NEXT,
        secondary: SKIP,
      },
      {
        id: 'add',
        title: 'Add an agent',
        variant: 'step',
        target: 'ws-agents-add',
        lines: [
          { speaker: 'guide', text: 'Add agent registers one and issues its key. The key is shown once, so copy it.' },
          { speaker: 'companion', text: 'Invite via link lets another user bring their own agent.' },
        ],
        primary: NEXT,
        secondary: SKIP,
      },
      {
        id: 'manage',
        title: 'Edit and revoke',
        variant: 'step',
        target: 'ws-agent-actions',
        optional: true,
        lines: [
          { speaker: 'guide', text: "Edit changes an agent's handle or role." },
          { speaker: 'companion', text: 'Revoke kills its key at once. Past messages stay in history.' },
        ],
        primary: DONE,
        secondary: SKIP,
      },
    ],
  },
};

const tasks: WorkspacePageOnboarding = {
  page: 'tasks',
  scope: 'user',
  introduction: {
    id: 'tasks-intro',
    title: 'Tasks',
    lines: [
      { speaker: 'guide', text: 'This is the task board. Every column belongs to an agent.' },
      { speaker: 'companion', text: 'Want to learn to read it in three steps?' },
    ],
    startLabel: 'Take the tour',
    dismissLabel: 'Not now',
  },
  tour: {
    id: 'tasks-tour',
    steps: [
      {
        id: 'lanes',
        title: 'Agent columns',
        variant: 'step',
        target: 'ws-tasks-board',
        missingTargetNote: 'The board appears once the first task pointer exists.',
        lines: [
          { speaker: 'guide', text: 'Columns are agents. Each card is a task pointer with its description.' },
          { speaker: 'companion', text: 'The pill shows pending, in review or done.' },
        ],
        beats: [
          { target: 'ws-task-lane', label: 'Column', detail: 'one per agent' },
          { target: 'ws-task-card', label: 'Task card', detail: 'title and description' },
          { target: 'ws-task-status', label: 'Status', detail: 'pending · in review · done' },
        ],
        primary: NEXT,
        secondary: SKIP,
      },
      {
        id: 'shared',
        title: 'Assignment and ghosts',
        variant: 'step',
        target: 'ws-tasks-board',
        optional: true,
        lines: [
          { speaker: 'guide', text: "Assign a pointer from a card's menu, or add one with a column's +." },
          { speaker: 'companion', text: 'Shared work lives once; other lanes get a ghost that jumps to it.' },
        ],
        beats: [
          { target: 'ws-task-assign', label: 'Add in lane', detail: 'assigned to that agent' },
          { target: 'ws-task-shared', label: 'Shared', detail: 'work across 3+ agents' },
          { target: 'ws-task-ghost', label: 'Ghost', detail: 'jumps to the real card' },
        ],
        primary: NEXT,
        secondary: SKIP,
      },
      {
        id: 'new',
        title: 'New task pointer',
        variant: 'step',
        target: 'ws-tasks-new',
        lines: [
          { speaker: 'guide', text: 'Break the goal into pointers the agents can pick up.' },
          { speaker: 'companion', text: 'Shortcut: press t anywhere in the workspace.' },
        ],
        primary: DONE,
        secondary: SKIP,
      },
    ],
  },
};

const runs: WorkspacePageOnboarding = {
  page: 'runs',
  scope: 'user',
  introduction: {
    id: 'runs-intro',
    title: 'Runs',
    lines: [
      { speaker: 'guide', text: 'Runs is the execution history: every tool call an agent made here.' },
      { speaker: 'companion', text: 'This is where debugging starts. Peek inside?' },
    ],
    startLabel: 'Take the tour',
    dismissLabel: 'Not now',
  },
  tour: {
    id: 'runs-tour',
    steps: [
      {
        id: 'history',
        title: 'Execution history',
        variant: 'step',
        target: 'ws-runs-list',
        missingTargetNote: 'Runs show up here once agents execute tools.',
        lines: [
          { speaker: 'guide', text: 'Each row is one tool execution: what ran, which agent, and how it went.' },
          { speaker: 'companion', text: 'Green means completed, red means it failed.' },
        ],
        beats: [
          { target: 'ws-run-tool', label: 'Tool', detail: 'what was called' },
          { target: 'ws-run-agent', label: 'Agent', detail: 'who ran it' },
          { target: 'ws-run-status', label: 'Status', detail: 'completed or failed' },
          { target: 'ws-run-duration', label: 'Duration', detail: 'how long it took' },
        ],
        primary: NEXT,
        secondary: SKIP,
      },
      {
        id: 'filters',
        title: 'Find a run',
        variant: 'step',
        target: 'ws-runs-filters',
        optional: true,
        lines: [
          { speaker: 'guide', text: 'Search a tool or agent, or filter by status.' },
          { speaker: 'companion', text: 'The Failed filter is the fastest way to find what broke.' },
        ],
        primary: NEXT,
        secondary: SKIP,
      },
      {
        id: 'inspect',
        title: 'Inspect a run',
        variant: 'step',
        target: 'ws-run-row',
        optional: true,
        lines: [
          { speaker: 'guide', text: 'Click a run to expand its input, output, error, duration and tokens.' },
          { speaker: 'companion', text: 'Those logs show exactly what an agent did, so debugging is quick.' },
        ],
        primary: DONE,
        secondary: SKIP,
      },
    ],
  },
};

const settings: WorkspacePageOnboarding = {
  page: 'settings',
  scope: 'user',
  introduction: {
    id: 'settings-intro',
    title: 'Settings',
    lines: [
      { speaker: 'guide', text: "Settings holds this workspace's configuration." },
      { speaker: 'companion', text: 'Three stops: details, AGENTS.md and preferences.' },
    ],
    startLabel: 'Take the tour',
    dismissLabel: 'Not now',
  },
  tour: {
    id: 'settings-tour',
    steps: [
      {
        id: 'info',
        title: 'Workspace information',
        variant: 'step',
        target: 'ws-settings-info',
        lines: [
          { speaker: 'guide', text: 'Name, goal, owner and workspace ID live here. Edit changes them.' },
          { speaker: 'companion', text: 'Copy the ID when you wire up an agent.' },
        ],
        primary: NEXT,
        secondary: SKIP,
      },
      {
        id: 'agents-md',
        title: 'AGENTS.md',
        variant: 'step',
        target: 'ws-settings-agents-md',
        lines: [
          { speaker: 'guide', text: 'Workspace-level instructions. Paste them into AGENTS.md at your project root.' },
          { speaker: 'companion', text: 'Then your agents follow the workspace loop every session.' },
        ],
        primary: NEXT,
        secondary: SKIP,
      },
      {
        id: 'preferences',
        title: 'Shortcuts and appearance',
        variant: 'step',
        target: 'ws-settings-shortcuts',
        lines: [
          { speaker: 'guide', text: 'Single-key shortcuts work whenever you are not typing. Press ? for the list.' },
          { speaker: 'companion', text: 'Appearance, just below, switches dark or light for this browser.' },
        ],
        primary: DONE,
        secondary: SKIP,
      },
    ],
  },
};

const files: WorkspacePageOnboarding = {
  page: 'files',
  scope: 'user',
  introduction: {
    id: 'files-intro',
    title: 'Files',
    lines: [
      { speaker: 'guide', text: 'Files collects everything shared in this workspace.' },
      { speaker: 'companion', text: 'Two quick steps and you are set.' },
    ],
    startLabel: 'Take the tour',
    dismissLabel: 'Not now',
  },
  tour: {
    id: 'files-tour',
    steps: [
      {
        id: 'repository',
        title: 'Shared files',
        variant: 'step',
        target: 'ws-files-list',
        lines: [
          { speaker: 'guide', text: 'Every file attached to a message lands here, shared with all members and agents.' },
          { speaker: 'companion', text: 'Attach one from the composer and agents get it as context.' },
        ],
        primary: NEXT,
        secondary: SKIP,
      },
      {
        id: 'actions',
        title: 'Find and open',
        variant: 'step',
        target: 'ws-files-search',
        optional: true,
        lines: [
          { speaker: 'guide', text: 'Search by name, type or uploader.' },
          { speaker: 'companion', text: 'Click a file name to open it in a new tab.' },
        ],
        primary: DONE,
        secondary: SKIP,
      },
    ],
  },
};

/** One entry per workspace page. Each has its own intro, tour and completion state. */
export const WORKSPACE_TOUR_REGISTRY: Record<WorkspacePageId, WorkspacePageOnboarding> = {
  workspace,
  conversation,
  agents,
  tasks,
  runs,
  settings,
  files,
};

export const WORKSPACE_TOURS: GuidedTourDefinition[] = Object.values(WORKSPACE_TOUR_REGISTRY).map((entry) => entry.tour);

export function workspaceEntryForTour(tourId: string): WorkspacePageOnboarding | null {
  return Object.values(WORKSPACE_TOUR_REGISTRY).find((entry) => entry.tour.id === tourId) ?? null;
}
