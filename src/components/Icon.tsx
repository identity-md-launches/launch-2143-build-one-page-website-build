type IconName =
  | 'arrow'
  | 'external'
  | 'copy'
  | 'check'
  | 'close'
  | 'wallet'
  | 'refresh'
  | 'terminal'
  | 'chevron'
  | 'warning'
const paths: Record<IconName, React.ReactNode> = {
  arrow: (
    <>
      <path d="M4 12h16m-6-6 6 6-6 6" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6m0-6L10 14m0-10H4v16h16v-6" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="1" />
      <path d="M16 8V4H4v12h4" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  wallet: (
    <>
      <path d="M20 8V5H4v14h16v-4M4 8h17v7h-7V8" />
      <path d="M17 11.5h1" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1" />
    </>
  ),
  terminal: (
    <>
      <path d="m4 6 6 6-6 6m9 0h7" />
    </>
  ),
  chevron: <path d="m9 5 7 7-7 7" />,
  warning: (
    <>
      <path d="m12 3 10 18H2L12 3Z" />
      <path d="M12 9v5m0 3h.01" />
    </>
  ),
}
export function Icon({
  name,
  className = '',
}: {
  name: IconName
  className?: string
}) {
  return (
    <svg
      className={`icon ${className}`}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}
