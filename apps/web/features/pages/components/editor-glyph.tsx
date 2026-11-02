export function EditorGlyph({ name }: { name: string }) {
  const p: Record<string, React.ReactNode> = {
    undo: <path d="m8 4-5 5 5 5M3 9h10a7 7 0 0 1 0 14" />,
    redo: <path d="m16 4 5 5-5 5M21 9H11a7 7 0 0 0 0 14" />,
    import: <path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4" />,
    export: <path d="M12 17V4m-4 4 4-4 4 4M4 17v4h16v-4" />,
    print: (
      <>
        <path d="M7 8V3h10v5M7 16H3V8h18v8h-4M7 13h10v8H7z" />
      </>
    ),
    insert: <path d="M12 4v16M4 12h16" />,
    outline: <path d="M8 5h13M8 12h13M8 19h13M3 5h1M3 12h1M3 19h1" />,
    image: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8" cy="8" r="2" />
        <path d="m3 19 6-7 4 4 4-6 4 7" />
      </>
    ),
    link: (
      <path d="m10 7 3-3a5 5 0 0 1 7 7l-3 3M14 17l-3 3a5 5 0 0 1-7-7l3-3m1 6 8-8" />
    ),
    table: <path d="M3 4h18v16H3zM3 10h18M9 4v16" />,
    task: <path d="M3 4h18v16H3zM7 12l3 3 7-7" />,
    quote: <path d="M4 6h6v6H4zM14 6h6v6h-6zM10 12l-4 6m14-6-4 6" />,
    divider: <path d="M3 12h18" />,
    paragraph: <path d="M15 21V3h-5a5 5 0 0 0 0 10h1M19 3v18" />,
    bullet: <path d="M8 5h13M8 12h13M8 19h13M3 5h1M3 12h1M3 19h1" />,
    numbered: (
      <path d="M9 5h12M9 12h12M9 19h12M3 3h1v4M3 11h3l-3 4h3M3 18h3v4H3" />
    ),
    markdown: <path d="M3 5h18v14H3zM6 15V9l3 3 3-3v6m3-3 2 3 2-3m-2 3V9" />,
    codeBlock: <path d="m8 5-6 7 6 7m8-14 6 7-6 7m-5 1 2-16" />,
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
      {p[name] ?? (
        <>
          <path d="M4 4v16M16 4v16M4 12h12" />
          <path d="M20 10v10" />
        </>
      )}
    </svg>
  );
}
