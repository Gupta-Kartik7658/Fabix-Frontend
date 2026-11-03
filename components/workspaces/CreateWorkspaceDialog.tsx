'use client';

import { useEffect, useState } from 'react';
import { FileText, MessagesSquare } from 'lucide-react';
import { api, type WorkspaceDetail, type WorkspaceRecord } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import CopyButton from '@/components/ui/CopyButton';
import { cn } from '@/lib/utils';
import {
  WORKSPACE_AGENTS_MD_FILENAME,
  WORKSPACE_AGENTS_MD_SNIPPET,
} from '@/lib/workspaceAgentsMd';
import { Dialog } from './Dialog';

type Step = 'form' | 'agents-md';

const FIELD_STYLE = {
  background: 'var(--bg-app)',
  boxShadow: 'none',
  color: 'var(--neutral-strong-950)',
  WebkitTextFillColor: 'var(--neutral-strong-950)',
} as const;

function WorkspaceFields({
  title,
  task,
  onTitle,
  onTask,
  onSubmit,
  titleError,
}: {
  title: string;
  task: string;
  onTitle: (v: string) => void;
  onTask: (v: string) => void;
  onSubmit: () => void;
  titleError: string | null;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="workspace-title" className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--neutral-strong-950)]">
          Workspace name
          <span className="text-[11px] font-normal text-[var(--neutral-soft-400)]">Required</span>
        </label>
        <input
          id="workspace-title"
          value={title}
          onChange={(e) => onTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder="e.g. Q3 analytics API"
          autoComplete="off"
          aria-invalid={!!titleError}
          aria-describedby={titleError ? 'workspace-title-error' : undefined}
          className={cn(
            'h-10 w-full rounded-[8px] border px-3 text-[13.5px] outline-none transition-colors placeholder:text-[var(--neutral-soft-400)]',
            titleError
              ? 'border-[var(--error)]'
              : 'border-[var(--stroke-soft-200)] hover:border-[var(--stroke-sub-300)] focus:border-[#2F7A57]',
          )}
          style={FIELD_STYLE}
        />
        {titleError && (
          <p id="workspace-title-error" className="mt-1.5 text-[12px] text-[var(--error-dark)]">
            {titleError}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="workspace-goal" className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--neutral-strong-950)]">
          Workspace goal
          <span className="text-[11px] font-normal text-[var(--neutral-soft-400)]">Optional</span>
        </label>
        <textarea
          id="workspace-goal"
          value={task}
          onChange={(e) => onTask(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              onSubmit();
            }
          }}
          rows={4}
          placeholder="What should the agents in this workspace accomplish?"
          className="w-full resize-none rounded-[8px] border border-[var(--stroke-soft-200)] px-3 py-2.5 text-[13px] leading-[1.55] outline-none transition-colors placeholder:text-[var(--neutral-soft-400)] hover:border-[var(--stroke-sub-300)] focus:border-[#2F7A57]"
          style={FIELD_STYLE}
        />
        <p className="mt-1.5 text-[12px] text-[var(--neutral-soft-400)]">
          Shown on the workspace card and at the top of the room. You can change it later.
        </p>
      </div>
    </div>
  );
}

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (detail: WorkspaceDetail) => void;
}) {
  const [step, setStep] = useState<Step>('form');
  const [title, setTitle] = useState('');
  const [task, setTask] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [created, setCreated] = useState<WorkspaceDetail | null>(null);

  useEffect(() => {
    if (open) {
      setStep('form');
      setTitle('');
      setTask('');
      setError(null);
      setTitleError(null);
      setSaving(false);
      setCreated(null);
    }
  }, [open]);

  const submit = async () => {
    const trimmed = title.trim();
    if (saving) return;
    if (!trimmed) {
      setTitleError('Give the workspace a name.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const detail = await api.createWorkspace({ title: trimmed, task: task.trim() || null });
      setCreated(detail);
      setStep('agents-md');
      setSaving(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the workspace.');
      setSaving(false);
    }
  };

  const finish = () => {
    if (!created) return;
    onCreated(created);
    onOpenChange(false);
  };

  const isForm = step === 'form';

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && created) {
          // Closing after create still navigates into the room.
          onCreated(created);
        }
        onOpenChange(next);
      }}
      width={isForm ? 520 : 560}
      fullWidthOnMobile
      title={isForm ? 'Create workspace' : 'Add workspace instructions'}
      description={
        isForm ? (
          'A shared room where your agents coordinate on one goal.'
        ) : (
          <>
            Workspace created. Paste this into{' '}
            <span className="font-medium text-[var(--neutral-strong-950)]">
              {WORKSPACE_AGENTS_MD_FILENAME}
            </span>{' '}
            so agents use Aegis Workspace tools every session.
          </>
        )
      }
      dismissable={!saving}
      footer={
        isForm ? (
          <>
            <Button variant="ghost" size="md" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" size="md" onClick={() => void submit()} disabled={saving}>
              {saving ? 'Creating…' : 'Create workspace'}
            </Button>
          </>
        ) : (
          <Button variant="primary" size="md" onClick={finish}>
            Open workspace
          </Button>
        )
      }
    >
      {isForm ? (
        <div className="space-y-4">
          <WorkspaceFields
            title={title}
            task={task}
            onTitle={(v) => {
              setTitle(v);
              if (titleError && v.trim()) setTitleError(null);
            }}
            onTask={setTask}
            onSubmit={() => void submit()}
            titleError={titleError}
          />

          <div className="flex items-start gap-2.5 rounded-[10px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-3 py-2.5">
            <MessagesSquare size={14} className="mt-[3px] shrink-0 text-[var(--neutral-sub-600)]" />
            <p className="text-[12.5px] leading-[1.55] text-[var(--neutral-sub-600)]">
              Your workspace will be created. You can then invite agents, coordinate tasks and
              collaborate through shared conversations.
            </p>
          </div>

          {error && (
            <p className="text-[12.5px] text-[var(--error-dark)]" role="alert">
              {error}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 rounded-[10px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-3 py-2.5">
            <FileText size={14} className="mt-0.5 shrink-0 text-[var(--neutral-sub-600)]" />
            <p className="text-[12px] leading-[1.55] text-[var(--neutral-sub-600)]">
              If you want agents to stay in sync with this workspace, add this block to{' '}
              {WORKSPACE_AGENTS_MD_FILENAME}. You can reopen it anytime from the room.
            </p>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-[var(--neutral-sub-600)]">
                {WORKSPACE_AGENTS_MD_FILENAME}
              </span>
              <CopyButton text={WORKSPACE_AGENTS_MD_SNIPPET} />
            </div>
            <pre className="max-h-[260px] overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-3 py-2.5 font-mono text-[11.5px] leading-[1.6] text-[var(--neutral-strong-950)]">
              {WORKSPACE_AGENTS_MD_SNIPPET}
            </pre>
          </div>
        </div>
      )}
    </Dialog>
  );
}

type EditableWorkspace = { id: string; title: string; task: string | null };

/** Edit name and goal of an existing workspace (PATCH /api/workspaces/{id}). */
export function EditWorkspaceDialog(props: {
  workspace: EditableWorkspace | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (record: WorkspaceRecord) => void;
}) {
  return <EditWorkspaceDialogBody key={props.workspace?.id ?? 'closed'} {...props} />;
}

function EditWorkspaceDialogBody({
  workspace,
  onOpenChange,
  onSaved,
}: {
  workspace: EditableWorkspace | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (record: WorkspaceRecord) => void;
}) {
  const [title, setTitle] = useState(workspace?.title ?? '');
  const [task, setTask] = useState(workspace?.task ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);

  const submit = async () => {
    if (!workspace || saving) return;
    const trimmed = title.trim();
    if (!trimmed) {
      setTitleError('Give the workspace a name.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const record = await api.updateWorkspace(workspace.id, {
        title: trimmed,
        task: task.trim() || null,
      });
      onSaved({ ...record, title: record.title ?? trimmed, task: record.task ?? (task.trim() || null) });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the workspace.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={!!workspace}
      onOpenChange={onOpenChange}
      width={520}
      fullWidthOnMobile
      title="Edit workspace"
      description="Update the name and goal your agents see."
      dismissable={!saving}
      footer={
        <>
          <Button variant="ghost" size="md" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" size="md" onClick={() => void submit()} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <WorkspaceFields
          title={title}
          task={task}
          onTitle={(v) => {
            setTitle(v);
            if (titleError && v.trim()) setTitleError(null);
          }}
          onTask={setTask}
          onSubmit={() => void submit()}
          titleError={titleError}
        />
        {error && (
          <p className="text-[12.5px] text-[var(--error-dark)]" role="alert">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
