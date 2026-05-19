"use client";

interface CircularProgressProps {
  progress: number;
  size: number;
  strokeWidth: number;
  label: string;
}

/**
 * Circular progress indicator with percentage label.
 *
 * Renders an SVG-based circular progress bar with customizable size,
 * stroke width, and center label.
 */
export default function CircularProgress({
  progress,
  size,
  strokeWidth,
  label,
}: CircularProgressProps): JSX.Element {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="circular-progress" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="circular-progress-svg">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#4f46e5"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{
            transform: "rotate(-90deg)",
            transformOrigin: "center",
            transition: "stroke-dashoffset 0.3s ease",
          }}
        />
      </svg>
      <div className="circular-progress-label">{label}</div>
    </div>
  );
}
