export function OriMark({
  size = 32,
}: {
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="OriCMS"
    >
      <rect
        x="6"
        y="6"
        width="20"
        height="20"
        rx="4"
        stroke="var(--ori-logo-stroke)"
        strokeWidth="1.75"
      />
      <rect x="9" y="9" width="14" height="3" rx="1.5" fill="var(--ori-logo-top-bar)" />
      <rect x="9" y="14" width="6" height="8" rx="1.5" fill="var(--ori-logo-left-block)" />
      <rect x="17" y="14" width="6" height="10" rx="1.5" fill="var(--ori-logo-right-block)" />
    </svg>
  );
}
