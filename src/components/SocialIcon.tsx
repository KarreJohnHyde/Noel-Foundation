type SocialNetwork = "Facebook" | "Instagram" | "LinkedIn" | "YouTube";

const paths: Record<SocialNetwork, React.ReactNode> = {
  Facebook: (
    <path d="M13.6 22v-8.3h2.8l.4-3.2h-3.2V8.4c0-.9.3-1.6 1.7-1.6H17V4a22 22 0 0 0-2.5-.1c-2.5 0-4.3 1.6-4.3 4.4v2.2H7.4v3.2h2.8V22h3.4Z" />
  ),
  Instagram: (
    <>
      <path d="M7.7 2h8.6A5.7 5.7 0 0 1 22 7.7v8.6a5.7 5.7 0 0 1-5.7 5.7H7.7A5.7 5.7 0 0 1 2 16.3V7.7A5.7 5.7 0 0 1 7.7 2Zm-.2 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 16.5 4h-9Z" />
      <path d="M12 7.2A4.8 4.8 0 1 1 12 16.8 4.8 4.8 0 0 1 12 7.2Zm0 2A2.8 2.8 0 1 0 12 14.8 2.8 2.8 0 0 0 12 9.2Z" />
      <circle cx="17.3" cy="6.8" r="1.15" />
    </>
  ),
  LinkedIn: (
    <>
      <path d="M5.3 7.8A2.3 2.3 0 1 0 5.3 3.2a2.3 2.3 0 0 0 0 4.6ZM3.4 9.5h3.8V21H3.4V9.5Z" />
      <path d="M9.4 9.5H13v1.6h.1c.5-.9 1.7-2 3.5-2 3.8 0 4.5 2.5 4.5 5.7V21h-3.8v-5.5c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9V21H9.4V9.5Z" />
    </>
  ),
  YouTube: (
    <>
      <path d="M23.3 7.1a3 3 0 0 0-2.1-2.2C19.3 4.4 12 4.4 12 4.4s-7.3 0-9.2.5A3 3 0 0 0 .7 7.1 31 31 0 0 0 .2 12a31 31 0 0 0 .5 4.9 3 3 0 0 0 2.1 2.2c1.9.5 9.2.5 9.2.5s7.3 0 9.2-.5a3 3 0 0 0 2.1-2.2 31 31 0 0 0 .5-4.9 31 31 0 0 0-.5-4.9Z" />
      <path d="m9.6 15.4 6.1-3.4-6.1-3.4v6.8Z" className="social-icon__cutout" />
    </>
  ),
};

export default function SocialIcon({ network }: { network: SocialNetwork }) {
  return (
    <svg
      className="social-icon"
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      {paths[network]}
    </svg>
  );
}
