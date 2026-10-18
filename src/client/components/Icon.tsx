import React from "react";
export function Icon({
  name,
  ...props
}: { name: string } & React.SVGProps<SVGSVGElement>) {
  const paths: Record<string, string> = {
    grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    plus: "M12 5v14 M5 12h14",
    search: "M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    arrow: "M5 12h14 M13 6l6 6-6 6",
    connect:
      "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2 M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2",
    shape: "M12 3l10 18H2z",
    list: "M8 6h13 M8 12h13 M8 18h13 M3 6h.1 M3 12h.1 M3 18h.1",
    board: "M3 4h5v16H3z M10 4h5v10h-5z M17 4h5v13h-5z",
    archive: "M3 3h18v5H3z M5 8v13h14V8 M10 12h4",
    close: "M6 6l12 12 M6 18L18 6",
    restore: "M3 10a9 9 0 1 1 0 6 M3 4v6h6",
    logout: "M9 3H3v18h6 M10 12h11 M16 7l5 5-5 5",
  };
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d={paths[name] ?? paths.grid} />
    </svg>
  );
}
