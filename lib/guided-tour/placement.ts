import type { TourProgress, TourStep } from './types';

export type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
};

export type Placement = 'top' | 'bottom' | 'left' | 'right' | 'center';

export type Viewport = {
  width: number;
  height: number;
};

export function toRect(dom: Pick<DOMRect, 'top' | 'left' | 'width' | 'height' | 'right' | 'bottom'>): Rect {
  return {
    top: dom.top,
    left: dom.left,
    width: dom.width,
    height: dom.height,
    right: dom.right,
    bottom: dom.bottom,
  };
}

export function tourProgress(steps: TourStep[], index: number): TourProgress | null {
  const step = steps[index];
  if (!step || step.variant === 'finale') return null;
  const countable = steps.filter((item) => item.variant !== 'finale');
  const current = countable.findIndex((item) => item.id === step.id);
  if (current < 0) return null;
  return { current: current + 1, total: countable.length };
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

function intersects(a: { top: number; left: number; right: number; bottom: number }, b: Rect): boolean {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

/**
 * Place a tooltip so it stays on screen and leaves the spotlight clear.
 * Narrow viewports dock above or below the target.
 */
export function placeTooltip(
  target: Rect | null,
  tip: { width: number; height: number },
  viewport: Viewport,
  gap = 14,
): { top: number; left: number; placement: Placement } {
  const margin = 12;
  const maxLeft = viewport.width - tip.width - margin;
  const maxTop = viewport.height - tip.height - margin;

  if (!target || target.width <= 0 || target.height <= 0) {
    return {
      top: clamp((viewport.height - tip.height) / 2, margin, maxTop),
      left: clamp((viewport.width - tip.width) / 2, margin, maxLeft),
      placement: 'center',
    };
  }

  const space = {
    top: target.top - margin,
    bottom: viewport.height - target.bottom - margin,
    left: target.left - margin,
    right: viewport.width - target.right - margin,
  };

  const fits = (side: Exclude<Placement, 'center'>) =>
    side === 'top' || side === 'bottom' ? space[side] >= tip.height + gap : space[side] >= tip.width + gap;

  let placement: Placement;
  if (viewport.width < 720) {
    placement = space.bottom >= space.top ? 'bottom' : 'top';
  } else {
    const order: Exclude<Placement, 'center'>[] = ['bottom', 'top', 'right', 'left'];
    placement = order.find(fits) ?? order.slice().sort((a, b) => space[b] - space[a])[0];
  }

  const at = (side: Placement) => {
    if (side === 'bottom') {
      return {
        top: target.bottom + gap,
        left: target.left + target.width / 2 - tip.width / 2,
      };
    }
    if (side === 'top') {
      return {
        top: target.top - gap - tip.height,
        left: target.left + target.width / 2 - tip.width / 2,
      };
    }
    if (side === 'right') {
      return {
        top: target.top + target.height / 2 - tip.height / 2,
        left: target.right + gap,
      };
    }
    if (side === 'left') {
      return {
        top: target.top + target.height / 2 - tip.height / 2,
        left: target.left - gap - tip.width,
      };
    }
    return {
      top: (viewport.height - tip.height) / 2,
      left: (viewport.width - tip.width) / 2,
    };
  };

  let box = at(placement);
  box = {
    top: clamp(box.top, margin, maxTop),
    left: clamp(box.left, margin, maxLeft),
  };

  const bounds = () => ({
    top: box.top,
    left: box.left,
    right: box.left + tip.width,
    bottom: box.top + tip.height,
  });

  if (intersects(bounds(), target)) {
    const flip: Placement = space.bottom >= space.top ? 'bottom' : 'top';
    placement = flip;
    box = at(flip);
    box = {
      top: clamp(box.top, margin, maxTop),
      left: clamp(box.left, margin, maxLeft),
    };
  }

  if (intersects(bounds(), target)) {
    if (space.right >= space.left) {
      placement = 'right';
      box = at('right');
    } else {
      placement = 'left';
      box = at('left');
    }
    box = {
      top: clamp(box.top, margin, maxTop),
      left: clamp(box.left, margin, maxLeft),
    };
  }

  return { top: box.top, left: box.left, placement };
}

/**
 * Keep the dimmed hole on the group when it fits. Tall groups (stacked
 * mobile cards) fall back to the beat so the tooltip still has room.
 */
export function chooseSpotlight(
  group: Rect | null,
  beat: Rect | null,
  viewportHeight: number,
): { hole: Rect | null; ring: Rect | null } {
  const usable = (rect: Rect | null) => (rect && rect.width > 0 && rect.height > 0 ? rect : null);
  const groupRect = usable(group);
  const beatRect = usable(beat);
  if (!groupRect && !beatRect) return { hole: null, ring: null };
  if (!groupRect) return { hole: beatRect, ring: null };
  if (!beatRect) return { hole: groupRect, ring: null };

  if (groupRect.height > viewportHeight * 0.55) {
    return { hole: beatRect, ring: null };
  }

  const inside =
    beatRect.top >= groupRect.top - 4 &&
    beatRect.bottom <= groupRect.bottom + 4 &&
    beatRect.left >= groupRect.left - 4 &&
    beatRect.right <= groupRect.right + 4;
  if (inside && beatRect.height < groupRect.height - 8) {
    return { hole: groupRect, ring: beatRect };
  }
  return { hole: groupRect, ring: null };
}
