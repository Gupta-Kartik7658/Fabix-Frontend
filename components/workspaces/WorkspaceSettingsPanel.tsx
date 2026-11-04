'use client';

import type { ReactNode } from 'react';
import { Link2, Moon, Pencil, Sun, UserPlus } from 'lucide-react';
import type { WorkspacePerson, WorkspaceRecord } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import CopyButton from '@/components/ui/CopyButton';
import { cn } from '@/lib/utils';
import { WORKSPACE_AGENTS_MD_FILENAME, WORKSPACE_AGENTS_MD_SNIPPET } from '@/lib/workspaceAgentsMd';
import { Kbd, SHORTCUTS } from './shortcuts';
import { formatCreatedDate } from './workspace-list-model';

type Theme = 'light' | 'dark';

export function WorkspaceSettingsPanel({
  workspace,
  people,
  theme,
  onThemeChange,
  onEditDetails,
  onOpenAgentsMd,
  onInvitePeople,
  onAddAgent,
}: {
  workspace: WorkspaceRecord;
  people: WorkspacePerson[];
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onEditDetails: () => void;
  onOpenAgentsMd: () => void;
  onInvitePeople: () => void;
  onAddAgent: () => void;
}) {
  const owner = people.find((p) => p.is_owner);
  const link = typeof window !== 'undefined' ? `${window.location.origin}/workspaces/${workspace.id}` : '';
  const preview = WORKSPACE_AGENTS_MD_SNIPPET.split('\n').slice(0, 6).join('\n');

  return (
    <div className="h-full overflow-y-auto px-4 py-5 sm:px-6">
      <div className="flex max-w-[820px] flex-col gap-4">
        <Section
          tourId="ws-settings-info"
          title="Workspace information"
          description="Shown on the workspace card and at the top of every tab."
          action={
            <Button variant="secondary" size="sm" leadingIcon={<Pencil size={12} />} onClick={onEditDetails}>
              Edit
            </Button>
          }
        >
          <dl className="divide-y divide-[var(--stroke-soft-200)]">
            <Row label="Name">
              <span className="break-words text-[var(--neutral-strong-950)]">{workspace.title}</span>
            </Row>
            <Row label="Goal">
              {workspace.task ? (
                <span className="whitespace-pre-wrap break-words text-[var(--neutral-strong-950)]">{workspace.task}</span>
              ) : (
                <span className="text-[var(--neutral-soft-400)]">No goal defined</span>
              )}
            </Row>
            <Row label="Created">{formatCreatedDate(workspace.created_at) ?? '—'}</Row>
            {owner && (
              <Row label="Owner">
                {owner.name}
                {owner.email && <span className="text-[var(--neutral-soft-400)]"> · {owner.email}</span>}
              </Row>
            )}
            <Row label="Workspace ID">
              <span className="flex min-w-0 items-center gap-1">
                <span className="truncate font-mono text-[12px]">{workspace.id}</span>
                <CopyButton text={workspace.id} />
              </span>
            </Row>
          </dl>
        </Section>

        <Section
          tourId="ws-settings-agents-md"
          title="AGENTS.md"
          description={`Paste this into ${WORKSPACE_AGENTS_MD_FILENAME} at your project root so agents follow the workspace loop every session.`}
          action={
            <div className="flex items-center gap-1.5">
              <CopyButton text={WORKSPACE_AGENTS_MD_SNIPPET} />
              <Button variant="secondary" size="sm" onClick={onOpenAgentsMd}>
                View instructions
              </Button>
            </div>
          }
        >
          <pre className="relative max-h-[132px] overflow-hidden whitespace-pre-wrap px-4 py-3 font-mono text-[11.5px] leading-[1.6] text-[var(--neutral-sub-600)] [mask-image:linear-gradient(to_bottom,black_60%,transparent)]">
            {preview}
          </pre>
        </Section>

        <Section tourId="ws-settings-shortcuts" title="Keyboard shortcuts" description="Single-key actions work whenever you are not typing in a field.">
          <div className="grid gap-x-8 px-4 py-2 sm:grid-cols-2">
            {SHORTCUTS.flatMap((group) => group.items).map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-4 py-1.5 text-[12.5px] text-[var(--neutral-sub-600)]">
                <span>{item.label}</span>
                <span className="flex shrink-0 items-center gap-1">
                  {item.keys.map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Appearance" description="Applies to this browser.">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div role="radiogroup" aria-label="Theme" className="flex items-center gap-0.5 rounded-[8px] border border-[var(--stroke-soft-200)] p-0.5">
              {(
                [
                  { key: 'dark', label: 'Dark', icon: Moon },
                  { key: 'light', label: 'Light', icon: Sun },
                ] as const
              ).map((opt) => {
                const Icon = opt.icon;
                const selected = theme === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onThemeChange(opt.key)}
                    className={cn(
                      'flex h-7 items-center gap-1.5 rounded-[6px] px-2.5 text-[12.5px] font-medium transition-colors',
                      selected
                        ? 'bg-[var(--neutral-weak-50)] text-[var(--neutral-strong-950)]'
                        : 'text-[var(--neutral-sub-600)] hover:text-[var(--neutral-strong-950)]',
                    )}
                  >
                    <Icon size={13} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </Section>

        <Section title="Workspace actions">
          <div className="divide-y divide-[var(--stroke-soft-200)]">
            <ActionRow
              title="Add an agent"
              description="Register an agent you run and issue its one-time key."
              action={
                <Button variant="secondary" size="sm" leadingIcon={<UserPlus size={13} />} onClick={onAddAgent}>
                  Add agent
                </Button>
              }
            />
            <ActionRow
              title="Invite via link"
              description="Let another user join with their own agent."
              action={
                <Button variant="secondary" size="sm" leadingIcon={<Link2 size={13} />} onClick={onInvitePeople}>
                  Invite
                </Button>
              }
            />
            <ActionRow
              title="Workspace link"
              description="Members can open the workspace directly with this link."
              action={link ? <CopyButton text={link} /> : null}
            />
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({
  tourId,
  title,
  description,
  action,
  children,
}: {
  tourId?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section data-tour={tourId} className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)]">
      <header className="flex flex-wrap items-start gap-3 border-b border-[var(--stroke-soft-200)] px-4 py-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[13.5px] font-semibold text-[var(--neutral-strong-950)]">{title}</h3>
          {description && <p className="mt-0.5 text-[12px] leading-[1.5] text-[var(--neutral-sub-600)]">{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 px-4 py-2.5 text-[13px] text-[var(--neutral-sub-600)] sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-[12.5px] text-[var(--neutral-soft-400)]">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function ActionRow({ title, description, action }: { title: string; description: string; action: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-[var(--neutral-strong-950)]">{title}</p>
        <p className="mt-0.5 text-[12px] text-[var(--neutral-sub-600)]">{description}</p>
      </div>
      {action}
    </div>
  );
}
