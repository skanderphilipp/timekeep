/**
 * TimeKeepLogo — clock brand mark used on auth screens and the favicon.
 *
 * A cyan rounded-square with a clock face (circle + hands).
 * Designed to work at any size via CSS width/height on the SVG element.
 */
import { clsx } from "clsx";
import { APP_NAME } from "@/lib/constants";

type TimeKeepLogoProps = {
  className?: string;
};

export function TimeKeepLogo({ className }: TimeKeepLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      fill="none"
      className={clsx(className)}
      role="img"
      aria-label={APP_NAME}
    >
      {/* Rounded background square */}
      <rect width="48" height="48" rx="12" fill="var(--ao-accent-accent9)" />

      {/* Clock face circle */}
      <circle
        cx="24"
        cy="24"
        r="16"
        stroke="white"
        strokeWidth="3"
        fill="none"
      />

      {/* Clock hands — pointing to ~2:00 */}
      <path
        d="M24 15v9l6 6"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
