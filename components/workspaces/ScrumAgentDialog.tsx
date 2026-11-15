'use client';

import { useState } from 'react';
import { Play, X } from 'lucide-react';
import { api, ApiError, getApiErrorMessage } from '@/lib/api';
import { Dialog } from '@/components/workspaces/Dialog';
import { Button } from '@/components/ui/Button';
import CopyButton from '@/components/ui/CopyButton';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { useToast } from '@/components/ui/Toast';
import { runScrumAgent } from '@/lib/scrumAgent';
import { cn } from '@/lib/utils';

type TicketState = 'queued' | 'cancelled' | 'started';

type Ticket = {
  id: string;
  prompt: string;
  queuedAt: string;
  state: TicketState;
};

const TICKET_LABEL: Record<TicketState, { text: string; dot: string }> = {
  queued: { text: 'Queued', dot: 'bg-[var(--warning)]' },
  started: { text: 'Picked up', dot: 'bg-[var(--success)]' },
  cancelled: { text: 'Cancelled', dot: 'bg-[var(--neutral-soft-400)]' },
};

const FIELD_STYLE = {
  background: 'var(--bg-app)',
  boxShadow: 'none',
  color: 'var(--neutral-strong-950)',
  WebkitTextFillColor: 'var(--neutral-strong-950)',
} as const;

export function ScrumAgentDialog({
  workspaceId,
  open,
  onOpenChange,
  onQueued,
}: {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQueued?: (taskId: string) => void;
}) {
  const toast = useToast();
  const [prompt, setPrompt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const setTicketState = (id: string, state: TicketState) =>
    setTickets((current) => current.map((t) => (t.id === id ? { ...t, state } : t)));

  const run = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const text = prompt.trim();
      const res = await runScrumAgent(workspaceId, text);
      setTickets((current) => [
        { id: res.task_id, prompt: text, queuedAt: new Date().toISOString(), state: 'queued' },
        ...current,
      ]);
      setPrompt('');
      toast.success('Scrum Agent queued', { description: `Task ${res.task_id}` });
      onQueued?.(res.task_id);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not queue the Scrum Agent.'));
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async (id: string) => {
    setCancelling(id);
    try {
      await api.cancelScrumTask(id);
      setTicketState(id, 'cancelled');
      toast.success('Run cancelled');
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setTicketState(id, 'started');
        toast.error('Too late to cancel', { description: err.message });
      } else {
        toast.error('Could not cancel run', { description: getApiErrorMessage(err) });
      }
    } finally {
      setCancelling(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width={560}
      fullWidthOnMobile
      title="Run Scrum Agent"
      description="The prompt box in Conversation already goes to the Scrum Agent. Use this to start a run, or to cancel runs you queued that haven't started."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void run()}
            disabled={submitting}
            leadingIcon={<Play size={13} />}
          >
            {submitting ? 'Queuing…' : prompt.trim() ? 'Run with prompt' : 'Run autonomously'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label
            htmlFor="scrum-agent-prompt"
            className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--neutral-strong-950)]"
          >
            Instruction
            <span className="text-[11px] font-normal text-[var(--neutral-soft-400)]">Optional</span>
          </label>
          <textarea
            id="scrum-agent-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                void run();
              }
            }}
            rows={3}
            placeholder="e.g. Split the open goal into tasks and assign them. Leave empty to let the agent decide."
            className="w-full resize-none rounded-[8px] border border-[var(--stroke-soft-200)] px-3 py-2.5 text-[13px] leading-[1.55] outline-none transition-colors placeholder:text-[var(--neutral-soft-400)] hover:border-[var(--stroke-sub-300)] focus:border-[#2F7A57]"
            style={FIELD_STYLE}
          />
        </div>

        {error && <p className="text-[12.5px] text-[var(--error-dark)]">{error}</p>}

        {tickets.length > 0 && (
          <div className="border-t border-[var(--stroke-soft-200)] pt-4">
            <p className="mb-2 text-[12.5px] font-medium text-[var(--neutral-strong-950)]">
              Runs queued this session
            </p>
            <ul className="divide-y divide-[var(--stroke-soft-200)] overflow-hidden rounded-[10px] border border-[var(--stroke-soft-200)]">
              {tickets.map((ticket) => {
                const label = TICKET_LABEL[ticket.state];
                return (
                  <li key={ticket.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] text-[var(--neutral-strong-950)]">
                        {ticket.prompt || (
                          <span className="text-[var(--neutral-sub-600)]">Autonomous run</span>
                        )}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[11px] text-[var(--neutral-soft-400)]">
                        <span className="inline-flex items-center gap-1">
                          <span className={cn('size-1.5 rounded-full', label.dot)} />
                          {label.text}
                        </span>
                        <span>·</span>
                        <RelativeTime timestamp={ticket.queuedAt} />
                        <span>·</span>
                        <span className="truncate font-mono">{ticket.id}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <CopyButton text={ticket.id} />
                      {ticket.state === 'queued' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={cancelling === ticket.id}
                          leadingIcon={<X size={12} />}
                          onClick={() => void cancel(ticket.id)}
                        >
                          {cancelling === ticket.id ? 'Cancelling…' : 'Cancel'}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </Dialog>
  );
}
