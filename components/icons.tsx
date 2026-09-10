import type { CSSProperties } from "react";

type IconProps = { className?: string; style?: CSSProperties };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function CalendarIcon({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </svg>
  );
}

export function UserOffIcon({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5.5 20c0-3.6 2.9-6.2 6.5-6.2s6.5 2.6 6.5 6.2" />
      <path d="M4 4l16 16" />
    </svg>
  );
}

export function ClipboardIcon({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <rect x="5.5" y="4.5" width="13" height="16" rx="2" />
      <path d="M9 4.5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v.5" />
      <path d="M8.5 11h7M8.5 15h7" />
    </svg>
  );
}

export function QuadrantGridIcon({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
      <path d="M12 3.5v17M3.5 12h17" />
    </svg>
  );
}

// Two arrows pointing in opposite directions — swap.
export function SwapIcon({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <path d="M4 8h15M15.5 4.5 19 8l-3.5 3.5" />
      <path d="M20 16H5M8.5 12.5 5 16l3.5 3.5" />
    </svg>
  );
}
