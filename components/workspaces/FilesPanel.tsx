'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, FileCode2, FileImage, FileText, Paperclip, Search } from 'lucide-react';
import type { WorkspaceAgent, WorkspaceFileRef, WorkspaceMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { AgentGlyph } from './agent-visuals';
import { PanelEmpty } from './PanelEmpty';

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileType(file: WorkspaceFileRef): string {
  const ext = /\.([a-z0-9]{1,8})$/i.exec(file.filename)?.[1];
  if (ext) return ext.toUpperCase();
  const sub = file.content_type?.split('/')[1];
  return sub ? sub.toUpperCase() : 'File';
}

function fileIcon(file: WorkspaceFileRef) {
  const type = file.content_type ?? '';
  if (type.startsWith('image/')) return FileImage;
  if (/json|javascript|typescript|xml|yaml|x-sh|sql/.test(type) || /\.(json|ts|tsx|js|py|sql|ya?ml|sh)$/i.test(file.filename)) {
    return FileCode2;
  }
  return FileText;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const ROW_GRID = 'md:grid md:grid-cols-[minmax(0,1fr)_72px_84px_minmax(0,160px)_132px] md:items-center md:gap-4';

/**
 * Every file shared in the room, newest first.
 *
 * Files are carried on messages, so this is a second read of existing
 * data rather than new state. There is no standalone upload endpoint;
 * files are added by attaching them to a message.
 */
export function FilesPanel({
  messages,
  agents,
  onOpenConversation,
}: {
  messages: WorkspaceMessage[];
  agents: WorkspaceAgent[];
  onOpenConversation?: () => void;
}) {
  const [query, setQuery] = useState('');
  const byId = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);
  const files = useMemo(
    () =>
      messages
        .flatMap((m) =>
          m.file_refs.map((file) => ({
            file,
            uploader: byId.get(file.uploader_member_id ?? '') ?? byId.get(m.sender_member_id),
            at: m.created_at,
          })),
        )
        .reverse(),
    [messages, byId],
  );

  const q = query.trim().toLowerCase();
  const visible = q
    ? files.filter(({ file, uploader }) =>
        `${file.filename} ${fileType(file)} ${uploader?.handle ?? ''}`.toLowerCase().includes(q),
      )
    : files;
  const totalBytes = files.reduce((n, f) => n + f.file.size, 0);

  if (files.length === 0) {
    return (
      <div data-tour="ws-files-list" className="flex h-full flex-col items-center justify-center">
        <PanelEmpty
          icon={Paperclip}
          title="No files yet"
          hint="Files attached to messages in the conversation collect here."
        />
        {onOpenConversation && (
          <Button variant="secondary" size="sm" className="-mt-4" onClick={onOpenConversation}>
            Go to conversation
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-4 sm:px-6">
      <div className="flex max-w-[1080px] flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-[14px] font-semibold text-[var(--neutral-strong-950)]">Files</h2>
            <p className="mt-0.5 text-[12.5px] tabular-nums text-[var(--neutral-sub-600)]">
              {files.length} {files.length === 1 ? 'file' : 'files'} · {formatSize(totalBytes)} · Attach files from the
              conversation composer.
            </p>
          </div>
          <label
            data-input-shell
            data-tour="ws-files-search"
            className="flex h-8 w-full items-center gap-2 rounded-[8px] border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] px-2.5 sm:w-[240px]"
          >
            <Search size={14} className="shrink-0 text-[var(--neutral-soft-400)]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search files"
              aria-label="Search files"
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--neutral-soft-400)]"
              style={{ background: 'transparent', border: 'none', boxShadow: 'none', color: 'var(--neutral-strong-950)', WebkitTextFillColor: 'var(--neutral-strong-950)' }}
            />
          </label>
        </div>

        <div data-tour="ws-files-list" className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)]">
          <div
            className={cn(
              'hidden border-b border-[var(--stroke-soft-200)] px-4 py-2 text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]',
              ROW_GRID,
            )}
          >
            <span>Name</span>
            <span>Type</span>
            <span className="text-right">Size</span>
            <span>Uploaded by</span>
            <span className="text-right">Uploaded</span>
          </div>
          {visible.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-[var(--neutral-sub-600)]">No files match “{query}”.</p>
          ) : (
            <ul className="divide-y divide-[var(--stroke-soft-200)]">
              {visible.map(({ file, uploader, at }, index) => {
                const Icon = fileIcon(file);
                const linkable = Boolean(file.url && file.url !== '#');
                return (
                  <li
                    key={`${file.file_id ?? file.filename}-${index}`}
                    className={cn('flex flex-col gap-1 px-4 py-2.5 transition-colors hover:bg-[var(--neutral-weak-50)]/50', ROW_GRID)}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-[7px] border border-[var(--stroke-soft-200)] bg-[var(--bg-surface-alt)] text-[var(--neutral-sub-600)]">
                        <Icon size={14} />
                      </span>
                      {linkable ? (
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="group/link flex min-w-0 items-center gap-1.5 font-mono text-[12.5px] text-[var(--neutral-strong-950)] hover:underline"
                        >
                          <span className="truncate">{file.filename}</span>
                          <ExternalLink size={11} className="shrink-0 text-[var(--neutral-soft-400)]" />
                        </a>
                      ) : (
                        <span className="truncate font-mono text-[12.5px] text-[var(--neutral-strong-950)]">{file.filename}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-[38px] text-[12px] text-[var(--neutral-sub-600)] md:contents">
                      <span className="font-mono text-[11.5px]">{fileType(file)}</span>
                      <span className="tabular-nums md:text-right">{formatSize(file.size)}</span>
                      <span className="flex min-w-0 items-center gap-1.5">
                        {uploader ? (
                          <>
                            <AgentGlyph handle={uploader.handle} roleLabel={uploader.role_label} size="sm" />
                            <span className="truncate font-mono">@{uploader.handle}</span>
                          </>
                        ) : (
                          <span className="text-[var(--neutral-soft-400)]">Unknown</span>
                        )}
                      </span>
                      <span className="tabular-nums text-[var(--neutral-soft-400)] md:text-right">{formatDate(at)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
