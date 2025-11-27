import type { SVGProps } from "react";

export function StethoscopeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.8 2.3A.3.3 0 1 0 5 2a.3.3 0 0 0-.2.3" />
      <path d="M18.8 2.3a.3.3 0 1 0 .3-.3.3.3 0 0 0-.3.3" />
      <path d="M5 2.5V5l4 4" />
      <path d="M19 2.5V5l-4 4" />
      <path d="M9 9l-4 4v3h3l4-4" />
      <path d="M15 9l4 4v3h-3l-4-4" />
      <path d="M12 14v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2v-7" />
      <path d="M12 14a2 2 0 0 0-2-2h0a2 2 0 0 0-2 2" />
      <circle cx="12" cy="14" r="2" />
    </svg>
  );
}
