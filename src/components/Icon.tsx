import type { SVGProps } from "react";

export type IconName =
  | "arrow"
  | "arrow-up-right"
  | "check"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right"
  | "close"
  | "compass"
  | "download"
  | "external"
  | "heart"
  | "layers"
  | "leaf"
  | "mail"
  | "menu"
  | "people"
  | "phone"
  | "pin"
  | "report"
  | "shield"
  | "spark"
  | "trend"
  | "verified";

const paths: Record<IconName, React.ReactNode> = {
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  "arrow-up-right": <path d="M7 17 17 7M8 7h9v9" />,
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
  heart: (
    <path d="M20.8 5.7a5.4 5.4 0 0 0-7.7 0L12 6.8l-1.1-1.1a5.4 5.4 0 0 0-7.7 7.7L12 22l8.8-8.6a5.4 5.4 0 0 0 0-7.7Z" />
  ),
  layers: <path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Zm-8 9 8 4.5 8-4.5M4 16.5 12 21l8-4.5" />,
  leaf: <path d="M19 4C10 4 5 8 5 14c0 3 2 5 5 5 6 0 9-6 9-15ZM5 20c2-5 6-8 11-10" />,
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
  report: (
    <>
      <path d="M6 3h9l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M14 3v5h5M8 13h7M8 17h7" />
    </>
  ),
  shield: <path d="M12 3 5 6v5c0 4.6 2.8 8.2 7 10 4.2-1.8 7-5.4 7-10V6l-7-3Zm-3 9 2 2 4-5" />,
  spark: (
    <path d="m12 3 1.4 5.6L19 10l-5.6 1.4L12 17l-1.4-5.6L5 10l5.6-1.4L12 3Zm7 12 .6 2.4L22 18l-2.4.6L19 21l-.6-2.4L16 18l2.4-.6L19 15Z" />
  ),
  trend: <path d="M4 17 10 11l4 4 6-8M15 7h5v5" />,
  verified: (
    <>
      <path d="m12 3 2.3 1.5 2.8-.1.9 2.7 2.3 1.6-.9 2.7.9 2.7-2.3 1.6-.9 2.7-2.8-.1L12 21l-2.3-1.5-2.8.1-.9-2.7-2.3-1.6.9-2.7-.9-2.7L6 7.1l.9-2.7 2.8.1L12 3Z" />
      <path d="m8.7 12 2.1 2.1 4.5-4.6" />
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
