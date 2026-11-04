import type { GuidedTourDefinition } from './types';

export const promptStudioTour: GuidedTourDefinition = {
  id: 'prompt-studio',
  route: '/dashboard/prompts',
  autoStart: true,
  introduction: {
    id: 'prompt-studio-intro',
    title: 'Welcome to Prompt Studio',
    lines: [
      {
        speaker: 'guide',
        text: 'This is where you create reusable instructions that help your AI agents work consistently.',
      },
      {
        speaker: 'companion',
        text: 'Write it once, reuse it whenever you need, instead of re-explaining it to every agent!',
      },
    ],
    startLabel: 'Show me around',
    dismissLabel: 'Maybe later',
  },
  steps: [
    {
      id: 'library',
      title: 'Your prompt library',
      variant: 'step',
      target: 'prompt-header',
      alsoTargets: ['prompt-explorer'],
      lines: [
        {
          speaker: 'guide',
          text: 'Prompts are reusable instructions for your agents. Create one with New prompt and give it a recognizable name.',
        },
        {
          speaker: 'companion',
          text: 'Search or sort the list. Each row shows its variables and when it was last edited.',
        },
      ],
      beats: [
        { target: 'prompt-title', label: 'Prompt Studio', detail: 'your prompt count' },
        { target: 'new-prompt', label: 'New prompt', detail: 'starts an unsaved draft' },
        { target: 'prompt-search', label: 'Search', detail: 'name, description or body · /' },
        { target: 'prompt-sort', label: 'Sort', detail: 'last edited · name · most variables' },
        { target: 'prompt-list-item', label: 'Prompt', detail: 'title, {variables}, last edited' },
      ],
      primary: { label: 'Next', action: 'next' },
      secondary: { label: 'Skip', action: 'skip' },
    },
    {
      id: 'editor',
      title: 'Write the instructions',
      variant: 'step',
      target: 'prompt-editor',
      optional: true,
      lines: [
        {
          speaker: 'guide',
          text: 'Add a clear title and a short description of when to use it, then write the task, constraints and expected output.',
        },
        {
          speaker: 'companion',
          text: 'The toolbar adds headings, bold, italic, code, lists and quotes. Structure means consistency!',
        },
      ],
      beats: [
        { target: 'prompt-name', label: 'Title', detail: 'how you find it later' },
        { target: 'prompt-description', label: 'Description', detail: 'when an agent should use it' },
        { target: 'prompt-toolbar', label: 'Markdown', detail: 'heading · bold · italic · code · lists · quote' },
        { target: 'prompt-body', label: 'Body', detail: 'the instructions themselves' },
      ],
      primary: { label: 'Next', action: 'next' },
      secondary: { label: 'Skip', action: 'skip' },
    },
    {
      id: 'variables',
      title: 'Variables and saving',
      variant: 'step',
      target: 'prompt-variables',
      alsoTargets: ['prompt-save', 'prompt-more'],
      optional: true,
      lines: [
        {
          speaker: 'guide',
          text: 'Anything in curly braces becomes a variable. Fabix lists each one here with its occurrences and lines.',
        },
        {
          speaker: 'companion',
          text: "Save to keep your changes, unsaved edits aren't stored. The ⋯ menu copies, duplicates or deletes.",
        },
      ],
      linesWithout: {
        target: 'prompt-variable-token',
        lines: [
          {
            speaker: 'guide',
            text: 'This prompt has no variables yet. Wrap a name in curly braces, like {name}, and it appears in this panel.',
          },
          {
            speaker: 'companion',
            text: "Save to keep your changes, unsaved edits aren't stored. The ⋯ menu copies, duplicates or deletes.",
          },
        ],
      },
      beats: [
        { target: 'prompt-variable-token', label: 'Variable', detail: 'filled in each time it is used' },
        { target: 'prompt-variables', label: 'Variables', detail: 'detected from the body' },
        { target: 'prompt-save', label: 'Save', detail: 'keeps the latest version · Ctrl S' },
        { target: 'prompt-more', label: 'More', detail: 'copy · duplicate · delete' },
      ],
      primary: { label: 'Finish tour', action: 'complete' },
      secondary: { label: 'Skip', action: 'skip' },
    },
  ],
};
