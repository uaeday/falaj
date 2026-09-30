/** The falaj divider mark: a source well feeding one channel that splits into three. */
export function Mark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden="true">
      <circle cx="24" cy="8.5" r="4.5" fill="currentColor" />
      <path
        d="M24 16v9M24 25c0 6-12 5-12 12.5V43M24 25v18M24 25c0 6 12 5 12 12.5V43"
        fill="none"
        stroke="currentColor"
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
