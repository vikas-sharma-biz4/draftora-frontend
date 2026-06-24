"use client";

import type { CSSProperties } from "react";

interface CircularProgressProps {
  /** Percentage 0–100. Ignored when indeterminate=true. Default: 0. */
  progress?: number;
  /** When true, shows a spinning arc instead of a fill-up ring. Default: false. */
  indeterminate?: boolean;
  /** SVG diameter in px (also sets the viewBox). Default: 24. */
  size?: number;
  /** Stroke thickness in px. Default: 2.5. */
  strokeWidth?: number;
  /**
   * Optional label rendered centered over the ring.
   * Only applies when overlay=false.
   */
  label?: string;
  /**
   * When true the SVG positions itself absolute with inset:0 over its
   * nearest position:relative ancestor. Set width/height to "100%" so it
   * fills the ancestor exactly — no pixel overflow, no table clipping.
   *
   * The parent must be `position:relative` with a fixed size.
   */
  overlay?: boolean;
}

/**
 * Circular SVG progress ring.
 *
 * Key correctness note — SVG rotation:
 *   Uses the SVG-native attribute `transform="rotate(-90, cx, cy)"` to start
 *   the arc at 12 o'clock. CSS `transform-origin` on SVG <circle> elements is
 *   unreliable without `transform-box: fill-box`; the SVG attribute form is the
 *   only cross-browser-safe approach.
 *
 * Indeterminate mode:
 *   Animates via the global `spin` keyframe (defined in _animations.scss,
 *   loaded globally). The animation is applied to the <svg> element itself
 *   (not the inner circle) to avoid coordinate-system conflicts.
 *
 * Usage modes:
 *   overlay=false (default) — renders a bare <svg> (icon-swap) or a div+svg+label
 *   overlay=true  — renders an absolute-positioned <svg> that fills its
 *                   position:relative parent (ring around existing content)
 */
export default function CircularProgress({
  progress = 0,
  indeterminate = false,
  size = 24,
  strokeWidth = 2.5,
  label,
  overlay = false,
}: CircularProgressProps): JSX.Element {
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;

  const dashOffset = indeterminate
    ? circumference * 0.6 // 40% arc visible while spinning
    : circumference * (1 - Math.min(Math.max(progress, 0), 100) / 100);

  const spinStyle: CSSProperties = indeterminate
    ? { animation: "spin 0.8s linear infinite", transformOrigin: "50% 50%" }
    : {};

  const overlayStyle: CSSProperties = overlay
    ? { position: "absolute", inset: 0, pointerEvents: "none" }
    : {};

  const svgEl = (
    <svg
      width={overlay ? "100%" : size}
      height={overlay ? "100%" : size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      aria-hidden="true"
      style={{ ...overlayStyle, ...spinStyle }}
    >
      {/* Faint background track */}
      <circle cx={cx} cy={cy} r={r} stroke="rgba(99, 102, 241, 0.2)" strokeWidth={strokeWidth} />
      {/* Progress arc — SVG-native rotate so arc starts at 12 o'clock */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        stroke="var(--color-primary)"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        transform={`rotate(-90, ${cx}, ${cy})`}
        style={!indeterminate ? { transition: "stroke-dashoffset 0.25s ease" } : undefined}
      />
    </svg>
  );

  // Overlay mode: just the SVG — parent controls layout
  if (overlay) return svgEl;

  // No label: bare SVG (icon-swap inside a button)
  if (!label) return svgEl;

  // Label mode: centered text over the ring
  return (
    <div style={{ position: "relative", width: size, height: size, display: "inline-block" }}>
      {svgEl}
      <span
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: Math.max(Math.round(size * 0.28), 8),
          fontWeight: 700,
          lineHeight: 1,
          color: "var(--color-primary)",
          pointerEvents: "none",
        }}
      >
        {label}
      </span>
    </div>
  );
}
