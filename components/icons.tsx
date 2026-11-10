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

export function HomeIcon({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 9.8V20h12V9.8" />
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

// Head and shoulders — "me".
export function PersonIcon({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" />
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

export function ShareIcon({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <path d="M12 3.5v11M8.5 7 12 3.5 15.5 7" />
      <path d="M8 10.5H6.5a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-8.5a1 1 0 0 0-1-1H16" />
    </svg>
  );
}

// Chrome's three-dot menu.
export function MoreVerticalIcon({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <circle cx="12" cy="5.5" r="1.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
      <circle cx="12" cy="18.5" r="1.3" fill="currentColor" />
    </svg>
  );
}

// Safari's newer "•••" button.
export function MoreHorizontalIcon({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <circle cx="5.5" cy="12" r="1.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
      <circle cx="18.5" cy="12" r="1.3" fill="currentColor" />
    </svg>
  );
}

// Samsung Internet's three-line menu.
export function MenuIcon({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <path d="M4.5 7h15M4.5 12h15M4.5 17h15" />
    </svg>
  );
}

export function InstallIcon({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <path d="M12 4v10M8 10.5l4 4 4-4" />
      <path d="M5 15.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5" />
    </svg>
  );
}

// A row of app icons sitting on the Mac's Dock.
export function DockIcon({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <rect x="3" y="14" width="18" height="6" rx="2" />
      <rect x="6" y="9" width="4" height="4" rx="1" />
      <rect x="14" y="9" width="4" height="4" rx="1" />
    </svg>
  );
}

export function PlusSquareIcon({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M12 8.5v7M8.5 12h7" />
    </svg>
  );
}
