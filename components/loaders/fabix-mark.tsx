export const MARK_SRC = "/fabix-mark.png";
export const WORDMARK_SRC = "/fabix-text.png";

export const LOADER_COLORS = {
  rolex: "#006039",
  emerald: "#27A875",
  mint: "#75D6A4",
  background: "#080D0A",
  surface: "#111814",
  border: "#25312A",
  text: "#EDF3EE",
  muted: "#98A69C",
} as const;

/** Fabix mark drawn into a 32×32 SVG user-space box. */
export function MarkGlyph() {
  return <image data-mark-f href={MARK_SRC} width="32" height="32" preserveAspectRatio="xMidYMid meet" />;
}

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
