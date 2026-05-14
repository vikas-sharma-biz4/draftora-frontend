"use client";

import React from "react";

interface CircularProgressProps {
  /** Progress value 0-100 */
  progress: number;
  /** Diameter of the circle in pixels (default: 240) */
  size?: number;
  /** Stroke width (default: 8) */
  strokeWidth?: number;
  /** Background track color (default: #e5e7eb) */
  trackColor?: string;
  /** Progress stroke color (default: #6366f1) */
  progressColor?: string;
  /** Optional label to show inside the circle */
  label?: string;
  /** CSS class for the container */
  className?: string;
}

export default function CircularProgress({
  progress,
  size = 240,
  strokeWidth = 8,
  trackColor = "#e5e7eb",
  progressColor = "#6366f1",
  label,
  className = "",
}: CircularProgressProps): JSX.Element {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(progress, 100) / 100) * circumference;
  const center = size / 2;

  const containerStyle: React.CSSProperties = {
    width: size,
    height: size,
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const contentStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <div className={`circular-progress ${className}`} style={containerStyle}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(-90deg)" }}
        aria-hidden="true"
      >
        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="transparent"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="transparent"
          stroke={progressColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.3s ease-out" }}
        />
      </svg>
      {/* Center content */}
      <div style={contentStyle}>
        {label !== undefined ? (
          <span style={{ fontSize: size * 0.15, fontWeight: 600, color: "#374151" }}>{label}</span>
        ) : (
          <span style={{ fontSize: size * 0.22, fontWeight: 700, color: "#111827" }}>
            {Math.round(progress)}%
          </span>
        )}
      </div>
    </div>
  );
}
