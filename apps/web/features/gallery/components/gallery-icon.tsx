export function GalleryIcon({ name = "image" }: { name?: string }) {
  const paths: Record<string, React.ReactNode> = {
    image: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="8" cy="8" r="1.5" />
        <path d="m3 17 5-5 4 4 4-6 5 7" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    masonry: (
      <>
        <rect x="3" y="3" width="7" height="11" rx="1" />
        <rect x="14" y="3" width="7" height="6" rx="1" />
        <path d="M3 18v3h7v-3M14 13h7v8h-7z" />
      </>
    ),
    compact: (
      <>
        <path d="M3 3h18v18H3zM9 3v18M15 3v18M3 9h18M3 15h18" />
      </>
    ),
    list: (
      <>
        <path d="M9 5h12M9 12h12M9 19h12M3 4h2v2H3zM3 11h2v2H3zM3 18h2v2H3z" />
      </>
    ),
    timeline: (
      <>
        <path d="M5 3v18M10 5h11M10 12h8M10 19h11" />
        <circle cx="5" cy="5" r="1.5" />
        <circle cx="5" cy="12" r="1.5" />
        <circle cx="5" cy="19" r="1.5" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V3m-5 5 5-5 5 5M3 15v5h18v-5" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v13m-5-5 5 5 5-5M3 17v4h18v-4" />
      </>
    ),
    album: (
      <>
        <rect x="5" y="3" width="16" height="18" rx="2" />
        <path d="M5 6H2v12h3M8 15l3-3 3 2 4-5" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    tune: (
      <>
        <path d="M3 6h18M3 12h18M3 18h18" />
        <path d="M7 3v6M16 9v6M10 15v6" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    left: <path d="m15 5-7 7 7 7" />,
    right: <path d="m9 5 7 7-7 7" />,
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    trash: (
      <>
        <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7v1" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>
    ),
    tag: (
      <>
        <path d="m3 3 9 1 9 9-8 8-9-9z" />
        <circle cx="8" cy="8" r="1" />
      </>
    ),
  };
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.image}
    </svg>
  );
}
