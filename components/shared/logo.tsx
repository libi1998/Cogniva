import { cn } from "@/lib/utils"

/** Il marchio di Cogniva: una «C» aperta con un punto, l'idea che prende forma */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden
      className={cn("size-7 shrink-0 text-primary", className)}
    >
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <path
        d="M20.6 11.1a7 7 0 1 0 0 9.8"
        fill="none"
        stroke="#fff"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle cx="21.6" cy="16" r="2.1" fill="#fff" />
    </svg>
  )
}
