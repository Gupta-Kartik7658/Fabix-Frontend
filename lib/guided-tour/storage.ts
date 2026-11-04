import type { TourStatus } from './types';

const PREFIX = 'fabix_guided_tours:';

type TourRecord = {
  status: 'completed' | 'skipped';
  at: string;
};

type Bag = {
  v: 1;
  tours: Record<string, TourRecord>;
};

export function tourIdentity(user: { id?: string | null; email?: string | null } | null | undefined): string | null {
  const id = user?.id?.trim();
  if (id) return id;
  const email = user?.email?.trim().toLowerCase();
  if (email) return `email:${email}`;
  return null;
}

function emptyBag(): Bag {
  return { v: 1, tours: {} };
}

function storageFor(identity: string | null): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return identity ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function storageKey(identity: string | null): string {
  return identity ? `${PREFIX}${identity}` : `${PREFIX}session`;
}

function readBag(identity: string | null): Bag {
  const storage = storageFor(identity);
  if (!storage) return emptyBag();
  try {
    const raw = storage.getItem(storageKey(identity));
    if (!raw) return emptyBag();
    const parsed = JSON.parse(raw) as Partial<Bag>;
    if (parsed?.v !== 1 || !parsed.tours || typeof parsed.tours !== 'object') return emptyBag();
    return { v: 1, tours: parsed.tours };
  } catch {
    return emptyBag();
  }
}

export function readTourStatus(identity: string | null, tourId: string): TourStatus {
  const record = readBag(identity).tours[tourId];
  if (record?.status === 'completed' || record?.status === 'skipped') return record.status;
  return 'unseen';
}

export function writeTourStatus(
  identity: string | null,
  tourId: string,
  status: 'completed' | 'skipped',
): void {
  const storage = storageFor(identity);
  if (!storage) return;
  const bag = readBag(identity);
  bag.tours[tourId] = { status, at: new Date().toISOString() };
  try {
    storage.setItem(storageKey(identity), JSON.stringify(bag));
  } catch {
    /* private mode or a full quota */
  }
}
