import type { SVGProps } from "react";

export type IconName =
  | "analytics"
  | "arrow"
  | "arrow-up-right"
  | "bolt"
  | "check"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right"
  | "close"
  | "compass"
  | "download"
  | "external"
  | "filter"
  | "grid"
  | "heart"
  | "home"
  | "layers"
  | "leaf"
  | "link"
  | "mail"
  | "menu"
  | "people"
  | "phone"
  | "pin"
  | "pause"
  | "play"
  | "report"
  | "search"
  | "settings"
  | "shield"
  | "sliders"
  | "trend"
  | "verified"
  | "wallet";

const paths: Record<IconName, React.ReactNode> = {
  analytics: (
    <>
      <path d="M4 19V9m5 10V5m5 14v-7m5 7V3" />
      <path d="M3 19h18" />
    </>
  ),
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  "arrow-up-right": <path d="M7 17 17 7M8 7h9v9" />,
  bolt: <path d="m13.5 2-8 12H12l-1.5 8 8-12H12l1.5-8Z" />,
  check: <path d="m5 12 4 4L19 6" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "chevron-left": <path d="m15 18-6-6 6-6" />,
  "chevron-right": <path d="m9 18 6-6-6-6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  compass: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.2 8.8-2 4.4-4.4 2 2-4.4 4.4-2Z" />
    </>
  ),
  download: <path d="M12 4v11m0 0 4-4m-4 4-4-4M5 20h14" />,
  external: <path d="M14 5h5v5m0-5-9 9M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
  filter: <path d="M4 5h16l-6.3 7.2V19l-3.4 1.8v-8.6L4 5Z" />,
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  heart: (
    <path d="M20.8 5.7a5.4 5.4 0 0 0-7.7 0L12 6.8l-1.1-1.1a5.4 5.4 0 0 0-7.7 7.7L12 22l8.8-8.6a5.4 5.4 0 0 0 0-7.7Z" />
  ),
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5.5 9.5V21h13V9.5M10 21v-6h4v6" />
    </>
  ),
  layers: <path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Zm-8 9 8 4.5 8-4.5M4 16.5 12 21l8-4.5" />,
  leaf: <path d="M19 4C10 4 5 8 5 14c0 3 2 5 5 5 6 0 9-6 9-15ZM5 20c2-5 6-8 11-10" />,
  link: (
    <path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1" />
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  people: (
    <>
      <path d="M16 20v-1.6c0-2.4-2-4.4-4.4-4.4H7.4A4.4 4.4 0 0 0 3 18.4V20" />
      <circle cx="9.5" cy="7" r="3" />
      <path d="M16 4.2a3 3 0 0 1 0 5.8m5 10v-1.6a4.4 4.4 0 0 0-3.3-4.3" />
    </>
  ),
  phone: (
    <path d="M7 3H4.5A1.5 1.5 0 0 0 3 4.5C3 13.6 10.4 21 19.5 21a1.5 1.5 0 0 0 1.5-1.5V17l-4-1-1.2 3c-4.6-2-7.6-5-9.6-9.6l3-1.2L7 3Z" />
  ),
  pin: (
    <>
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  pause: (
    <>
      <path d="M8 5v14M16 5v14" />
      <circle cx="12" cy="12" r="9" />
    </>
  ),
  play: (
    <>
      <path d="m9 8 6 4-6 4V8Z" />
      <circle cx="12" cy="12" r="9" />
    </>
  ),
  report: (
    <>
      <path d="M6 3h9l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M14 3v5h5M8 13h7M8 17h7" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 4 4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 13.8a7.8 7.8 0 0 0 0-3.6l2-1.5-2-3.4-2.4 1a8 8 0 0 0-3.1-1.8L13.2 2H9.3L9 4.5a8 8 0 0 0-3.1 1.8l-2.4-1-2 3.4 2 1.5a7.8 7.8 0 0 0 0 3.6l-2 1.5 2 3.4 2.4-1A8 8 0 0 0 9 19.5l.3 2.5h3.9l.3-2.5a8 8 0 0 0 3.1-1.8l2.4 1 2-3.4-2-1.5Z" />
    </>
  ),
  shield: <path d="M12 3 5 6v5c0 4.6 2.8 8.2 7 10 4.2-1.8 7-5.4 7-10V6l-7-3Zm-3 9 2 2 4-5" />,
  sliders: (
    <>
      <path d="M4 6h6m4 0h6M4 12h10m4 0h2M4 18h2m4 0h10" />
      <circle cx="12" cy="6" r="2" />
      <circle cx="16" cy="12" r="2" />
      <circle cx="8" cy="18" r="2" />
    </>
  ),
  trend: <path d="M4 17 10 11l4 4 6-8M15 7h5v5" />,
  verified: (
    <>
      <path d="m12 3 2.3 1.5 2.8-.1.9 2.7 2.3 1.6-.9 2.7.9 2.7-2.3 1.6-.9 2.7-2.8-.1L12 21l-2.3-1.5-2.8.1-.9-2.7-2.3-1.6.9-2.7-.9-2.7L6 7.1l.9-2.7 2.8.1L12 3Z" />
      <path d="m8.7 12 2.1 2.1 4.5-4.6" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H19a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.5A2.5 2.5 0 0 1 5.5 5H18" />
      <path d="M16 10h5v5h-5a2.5 2.5 0 0 1 0-5Z" />
    </>
  ),
};

export default function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
