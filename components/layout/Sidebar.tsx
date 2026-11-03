'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  Coins,
  Boxes,
  Settings,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  BrainCircuit,
  ScrollText,
  MessagesSquare,
  Inbox,
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import {
  readRecentWorkspaces,
  resolveRecentWorkspaces,
  subscribeRecentWorkspaces,
  type RecentWorkspace,
} from '@/lib/recentWorkspaces';
import { FabixLogo } from '@/components/ui/FabixLogo';
import { WorkspaceSwitcher } from '@/components/ui/WorkspaceSwitcher';

/**
 * Sidebar collapse state.
 *
 * State lives on `document.documentElement.dataset.sidebarCollapsed` —
 * NOT in React state. This pattern (mirrored from dark mode) gives us:
 *   • Pure-CSS animation driven by `--sidebar-w` var
 *   • Zero re-renders when toggling
 *   • FOUC-prevention via inline <head> script (app/layout.tsx)
 *   • Single source of truth visible in DevTools
 *
 * The hook below just syncs a local `useState` for icon rotation /
 * conditional rendering; the actual collapse state is the DOM attribute.
 */
function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(document.documentElement.dataset.sidebarCollapsed === 'true');
  }, []);

  const toggle = useCallback(() => {
    const next = document.documentElement.dataset.sidebarCollapsed !== 'true';
    if (next) {
      document.documentElement.dataset.sidebarCollapsed = 'true';
      localStorage.setItem('aegis_sidebar_collapsed', 'true');
    } else {
      delete document.documentElement.dataset.sidebarCollapsed;
      localStorage.removeItem('aegis_sidebar_collapsed');
    }
    setCollapsed(next);
  }, []);

  // Cmd+\ (Ctrl+\ on Windows/Linux) — standard sidebar-toggle shortcut
  // in Linear, Cursor, Notion, VS Code. Listening on window keeps it
  // global; no preventDefault needed since browsers don't bind \.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  return { collapsed, toggle };
}

/** The rail is always dark, whatever the page theme. Global tokens are
 *  re-pointed here too so the profile menu (WorkspaceSwitcher) matches. */
const SIDEBAR_THEME = {
  '--sb-bg': '#101311',
  '--sb-border': '#252B27',
  '--sb-hover': '#141915',
  '--sb-active': '#171D19',
  '--sb-accent': '#56C58D',
  '--sb-text': '#C6CEC8',
  '--sb-text-strong': '#F0F3F1',
  '--sb-text-muted': '#89968E',
  '--sb-text-faint': '#5F6A63',
  '--white-0': '#111513',
  '--bg-surface': '#111513',
  '--neutral-weak-50': '#171D19',
  '--neutral-soft-200': '#1C221E',
  '--neutral-soft-400': '#89968E',
  '--neutral-sub-600': '#A1AAA4',
  '--neutral-strong-950': '#F0F3F1',
  '--stroke-soft-200': '#252B27',
  '--stroke-sub-300': '#303833',
  '--primary-base': '#39B982',
  '--error': '#E47777',
  '--error-lighter': 'rgba(228, 119, 119, 0.12)',
  background: 'var(--sb-bg)',
  borderColor: 'var(--sb-border)',
  colorScheme: 'dark',
} as CSSProperties;

type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  tour?: string;
  badge?: number;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

function buildNavGroups(inboxCount: number): NavGroup[] {
  return [
    {
      label: 'Workspace',
      items: [
        {
          name: 'Activity Center',
          href: '/dashboard/inbox',
          icon: Inbox,
          tour: 'nav-inbox',
          badge: inboxCount > 0 ? inboxCount : undefined,
        },
        { name: 'Workspaces', href: '/dashboard/workspaces', icon: MessagesSquare, tour: 'nav-workspaces' },
      ],
    },
    {
      label: 'Observability',
      items: [
        { name: 'Runs', href: '/dashboard/runs', icon: Activity },
        { name: 'Usage', href: '/dashboard/token-spenditure', icon: Coins },
      ],
    },
    {
      label: 'Knowledge',
      items: [
        { name: 'Memory', href: '/dashboard/memory', icon: BrainCircuit, tour: 'nav-memory' },
        { name: 'Prompts', href: '/dashboard/prompts', icon: ScrollText, tour: 'nav-prompts' },
      ],
    },
    {
      label: 'Integrations',
      items: [{ name: 'Connectors', href: '/dashboard/connectors', icon: Boxes }],
    },
    {
      label: 'Account',
      items: [{ name: 'Settings', href: '/dashboard/settings', icon: Settings }],
    },
  ];
}

type Tip = { label: string; top: number };

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [inboxCount, setInboxCount] = useState(0);
  const [recents, setRecents] = useState<RecentWorkspace[]>([]);
  const [tip, setTip] = useState<Tip | null>(null);
  const { collapsed, toggle } = useSidebarCollapsed();

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.getNotifications({ unread_only: true, limit: 50 }).catch(() => null),
      api.getWorkspaceInviteInbox().catch(() => []),
    ]).then(([notifications, invites]) => {
      if (cancelled) return;
      const unread =
        notifications && Number.isFinite(notifications.unread_count)
          ? notifications.unread_count
          : (notifications?.items ?? []).length;
      const pending = invites.filter((invite) => invite.status === 'pending').length;
      setInboxCount(unread + pending);
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    let available: Array<{ id: string; title: string }> | null = null;
    const sync = () => {
      if (cancelled) return;
      setRecents(
        available
          ? resolveRecentWorkspaces(available, 4)
          : readRecentWorkspaces().slice(0, 4),
      );
    };
    sync();
    const unsub = subscribeRecentWorkspaces(sync);
    api
      .getWorkspaces()
      .then((list) => {
        available = list;
        sync();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const isActive = (href: string) => {
    if (href === '/dashboard/workspaces') {
      return (
        pathname === href ||
        pathname.startsWith(`${href}/`) ||
        (pathname.startsWith('/workspaces/') && !pathname.startsWith('/workspaces/join/'))
      );
    }
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const tipHandlers = (label: string, desktop: boolean) =>
    desktop && collapsed
      ? {
          onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setTip({ label, top: rect.top + rect.height / 2 });
          },
          onMouseLeave: () => setTip(null),
          onFocus: (e: React.FocusEvent<HTMLElement>) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setTip({ label, top: rect.top + rect.height / 2 });
          },
          onBlur: () => setTip(null),
        }
      : {};

  // The icon column is fixed (13px inset, 18px glyph) so icons sit at the
  // same x in both rail widths — collapsing only removes the label.
  const renderNavLink = (item: NavItem, desktop: boolean) => {
    const active = isActive(item.href);
    const Icon = item.icon;
    const badge = item.badge ? (item.badge > 99 ? '99+' : String(item.badge)) : null;
    const tipLabel = badge ? `${item.name} · ${badge} unread` : item.name;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => { setMobileOpen(false); setTip(null); }}
        aria-label={desktop && collapsed ? tipLabel : undefined}
        aria-current={active ? 'page' : undefined}
        data-tour={desktop ? item.tour : undefined}
        {...tipHandlers(tipLabel, desktop)}
        className={[
          'group relative flex h-[38px] items-center gap-3 rounded-[8px] pl-[13px] pr-2.5 text-[13.5px] tracking-[-0.01em] outline-none',
          'transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-[var(--sb-accent)]',
          active
            ? 'bg-[var(--sb-active)] font-medium text-[var(--sb-text-strong)]'
            : 'text-[var(--sb-text)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text-strong)]',
        ].join(' ')}
      >
        <Icon
          className={[
            'size-[18px] shrink-0 transition-colors',
            active
              ? 'text-[var(--sb-accent)]'
              : 'text-[var(--sb-text-muted)] group-hover:text-[var(--sb-text)]',
          ].join(' ')}
          strokeWidth={1.75}
        />
        <span className="flex-1 truncate" data-sidebar-hide={desktop ? '' : undefined}>
          {item.name}
        </span>
        {badge && (
          <span
            data-sidebar-hide={desktop ? '' : undefined}
            className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#1E2A23] px-1.5 text-[10.5px] font-semibold tabular-nums text-[var(--sb-accent)]"
          >
            {badge}
          </span>
        )}
        {badge && desktop && collapsed && (
          <span
            aria-hidden
            className="absolute left-[27px] top-[7px] size-[7px] rounded-full bg-[var(--sb-accent)] ring-2 ring-[var(--sb-bg)]"
          />
        )}
      </Link>
    );
  };

  const renderRecents = (desktop: boolean) => (
    <div
      data-sidebar-hide={desktop ? '' : undefined}
      className="relative mb-1 ml-[22px] mt-0.5 space-y-px border-l border-[var(--sb-border)] pl-[13px]"
    >
      {recents.map((row) => {
        const href = `/workspaces/${row.id}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={row.id}
            href={href}
            title={row.title}
            onClick={() => { setMobileOpen(false); setTip(null); }}
            aria-current={active ? 'page' : undefined}
            className={[
              'relative flex h-[30px] items-center truncate rounded-[7px] px-2 text-[12.5px] tracking-[-0.01em] outline-none',
              'transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-[var(--sb-accent)]',
              active
                ? 'bg-[var(--sb-active)] font-medium text-[var(--sb-text-strong)]'
                : 'text-[var(--sb-text-muted)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]',
            ].join(' ')}
          >
            {active && (
              <span
                aria-hidden
                className="absolute -left-[14px] top-1/2 h-4 w-px -translate-y-1/2 bg-[var(--sb-accent)]"
              />
            )}
            <span className="truncate">{row.title}</span>
          </Link>
        );
      })}
    </div>
  );

  const navGroups = buildNavGroups(inboxCount);

  // Mobile drawer always renders the expanded layout; only the desktop
  // rail carries the collapse-aware attributes.
  const renderNav = (desktop: boolean) => (
    <>
      <div
        data-sidebar-center={desktop ? '' : undefined}
        className="flex h-[56px] shrink-0 items-center justify-between border-b border-[var(--sb-border)] pl-[22px] pr-3"
      >
        <Link
          href="/dashboard/workspaces"
          className="inline-flex items-center text-[var(--sb-text-strong)] transition-opacity hover:opacity-80"
          aria-label="Fabix — Home"
          data-sidebar-hide={desktop ? '' : undefined}
        >
          <FabixLogo tone="dark" priority style={{ height: 24 }} />
        </Link>
        {desktop ? (
          <button
            type="button"
            onClick={() => { setTip(null); toggle(); }}
            {...tipHandlers('Expand sidebar  Ctrl \\', desktop)}
            className="flex size-8 shrink-0 items-center justify-center rounded-[8px] text-[var(--sb-text-muted)] outline-none transition-colors duration-150 hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text-strong)] focus-visible:ring-1 focus-visible:ring-[var(--sb-accent)]"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? undefined : 'Collapse sidebar (Ctrl \\)'}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-[17px]" strokeWidth={1.75} />
            ) : (
              <PanelLeftClose className="size-[17px]" strokeWidth={1.75} />
            )}
          </button>
        ) : (
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-[8px] text-[var(--sb-text-muted)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text-strong)]"
            onClick={() => { setMobileOpen(false); setTip(null); }}
            aria-label="Close menu"
          >
            <X className="size-[17px]" strokeWidth={1.75} />
          </button>
        )}
      </div>

      <nav
        aria-label="Main"
        className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4 [scrollbar-width:thin]"
      >
        {navGroups.map((group, index) => (
          <div key={group.label} className={index === 0 ? 'pt-3' : 'pt-4'}>
            <div
              data-sidebar-hide={desktop ? '' : undefined}
              className="flex h-6 items-center px-[13px] text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--sb-text-faint)]"
            >
              {group.label}
            </div>
            {desktop && index > 0 && (
              <div
                aria-hidden
                className="mx-auto mb-2 hidden h-px w-6 bg-[var(--sb-border)] [[data-sidebar-collapsed]_&]:block"
              />
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const showRecents =
                  item.href === '/dashboard/workspaces' && recents.length > 0;
                if (!showRecents) return renderNavLink(item, desktop);
                return (
                  <div key={item.href}>
                    {renderNavLink(item, desktop)}
                    {renderRecents(desktop)}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-[var(--sb-border)] px-[10px] py-[10px]">
        <WorkspaceSwitcher />
      </div>
    </>
  );

  return (
    <>
      <div
        className="fixed left-0 right-0 top-0 z-40 flex h-12 items-center justify-between border-b px-4 lg:hidden"
        style={SIDEBAR_THEME}
      >
        <Link
          href="/dashboard/workspaces"
          className="inline-flex items-center text-[var(--sb-text-strong)]"
          aria-label="Fabix — Home"
        >
          <FabixLogo tone="dark" style={{ height: 24 }} />
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex size-9 items-center justify-center rounded-[8px] text-[var(--sb-text)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text-strong)]"
          aria-label="Open menu"
          aria-expanded={mobileOpen}
        >
          <Menu className="size-5" strokeWidth={1.75} />
        </button>
      </div>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/55 lg:hidden"
          onClick={() => { setMobileOpen(false); setTip(null); }}
        />
      )}

      <aside
        className={[
          'fixed left-0 top-0 z-50 flex h-dvh w-[280px] max-w-[86vw] flex-col border-r transition-transform duration-200 lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        style={SIDEBAR_THEME}
        aria-hidden={!mobileOpen}
        inert={!mobileOpen}
      >
        {renderNav(false)}
      </aside>

      <aside
        className="fixed left-0 top-0 z-30 hidden h-dvh flex-col border-r lg:flex"
        style={{
          ...SIDEBAR_THEME,
          width: 'var(--sidebar-w)',
          transition: 'width var(--sidebar-transition)',
        }}
      >
        {renderNav(true)}
      </aside>

      {tip && collapsed && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-[80] hidden -translate-y-1/2 whitespace-nowrap rounded-[7px] border px-2.5 py-1.5 text-[12px] font-medium text-[#F0F3F1] lg:block"
          style={{
            left: 'calc(var(--sidebar-w) + 8px)',
            top: tip.top,
            background: '#171C19',
            borderColor: '#252B27',
          }}
        >
          {tip.label}
        </div>
      )}
    </>
  );
}
