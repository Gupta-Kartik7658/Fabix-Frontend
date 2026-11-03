'use client';

import { useEffect } from 'react';

/**
 * Eases mouse-wheel scrolling on whichever element is actually scrolling
 * (page, sidebar, panels, dialogs). Precision input (trackpads, touch) is
 * already smooth and stays native, as do horizontal and zoom gestures.
 * Opt a subtree out with `data-native-scroll`.
 */

// Fraction of the remaining distance covered per 60fps frame. ~0.2 settles a
// notch in roughly 150ms: a slight glide without feeling laggy.
const EASE = 0.2;
const LINE_HEIGHT = 16;

type Track = { target: number; current: number; frame: number; last: number };
const tracks = new Map<Element, Track>();

function isMouseWheel(event: WheelEvent) {
  if (event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) return true;
  const legacy = (event as WheelEvent & { wheelDeltaY?: number }).wheelDeltaY;
  return typeof legacy === 'number' && legacy !== 0 && legacy % 120 === 0;
}

function pixelDelta(event: WheelEvent, el: Element) {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return event.deltaY * LINE_HEIGHT;
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return event.deltaY * el.clientHeight;
  return event.deltaY;
}

function maxScroll(el: Element) {
  return el.scrollHeight - el.clientHeight;
}

/** Where this element will end up once any in-flight ease settles. */
function pendingTop(el: Element) {
  return tracks.get(el)?.target ?? el.scrollTop;
}

function canScroll(el: Element, direction: number) {
  const top = pendingTop(el);
  return direction > 0 ? top < maxScroll(el) - 1 : top > 1;
}

function rootScroller() {
  const root = document.scrollingElement;
  if (!root) return null;
  const locked = [document.documentElement, document.body].some(
    (node) => getComputedStyle(node).overflowY === 'hidden',
  );
  return locked ? null : root;
}

/**
 * Walks up from the event target to the first element that can move in the
 * wheel direction. `null` means "let the browser handle it", `'blocked'`
 * means a container with overscroll containment swallowed the gesture.
 */
function findScroller(event: WheelEvent, direction: number): Element | null | 'blocked' {
  for (const node of event.composedPath()) {
    if (!(node instanceof Element)) continue;
    if (node === document.body || node === document.documentElement) break;
    if (node.closest('[data-native-scroll]')) return null;
    if (node.scrollHeight <= node.clientHeight + 1) continue;
    const style = getComputedStyle(node);
    if (!/(auto|scroll|overlay)/.test(style.overflowY)) continue;
    if (canScroll(node, direction)) return node;
    if (style.overscrollBehaviorY === 'contain' || style.overscrollBehaviorY === 'none') return 'blocked';
  }
  const root = rootScroller();
  return root && canScroll(root, direction) ? root : null;
}

function step(el: Element, track: Track, time: number) {
  // Something else (scrollbar drag, keyboard, scrollIntoView) moved the
  // element; hand control back instead of fighting it.
  if (Math.abs(el.scrollTop - track.current) > 2) {
    tracks.delete(el);
    return;
  }
  const dt = track.last ? Math.min(64, time - track.last) : 16.67;
  track.last = time;
  const alpha = 1 - Math.pow(1 - EASE, dt / 16.67);
  track.current += (track.target - track.current) * alpha;
  if (Math.abs(track.target - track.current) < 0.5) track.current = track.target;
  el.scrollTo({ top: track.current, behavior: 'instant' });
  if (track.current === track.target) {
    tracks.delete(el);
    return;
  }
  track.frame = requestAnimationFrame((next) => step(el, track, next));
}

function onWheel(event: WheelEvent) {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.deltaY === 0) return;
  if (!isMouseWheel(event)) return;

  const direction = Math.sign(event.deltaY);
  const el = findScroller(event, direction);
  if (el === null) return;
  event.preventDefault();
  if (el === 'blocked') return;

  const existing = tracks.get(el);
  const track = existing ?? { target: el.scrollTop, current: el.scrollTop, frame: 0, last: 0 };
  track.target = Math.max(0, Math.min(maxScroll(el), track.target + pixelDelta(event, el)));
  if (!existing) {
    tracks.set(el, track);
    track.frame = requestAnimationFrame((time) => step(el, track, time));
  }
}

export function SmoothScroll() {
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let attached = false;
    const sync = () => {
      if (!motion.matches && !attached) {
        window.addEventListener('wheel', onWheel, { passive: false });
        attached = true;
      } else if (motion.matches && attached) {
        window.removeEventListener('wheel', onWheel);
        attached = false;
      }
    };
    sync();
    motion.addEventListener('change', sync);
    return () => {
      motion.removeEventListener('change', sync);
      window.removeEventListener('wheel', onWheel);
      tracks.forEach((track) => cancelAnimationFrame(track.frame));
      tracks.clear();
    };
  }, []);

  return null;
}
