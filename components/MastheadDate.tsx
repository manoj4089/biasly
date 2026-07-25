"use client";

import { useEffect, useRef } from "react";

const DATE_FORMAT_OPTIONS = { weekday: "long", month: "long", day: "numeric", year: "numeric" } as const;

export default function MastheadDate({ initialIso, initialLabel }: { initialIso: string; initialLabel: string }) {
  const ref = useRef<HTMLTimeElement>(null);

  useEffect(() => {
    const now = new Date();
    const node = ref.current;
    if (!node) return;
    node.dateTime = now.toISOString();
    node.textContent = now.toLocaleDateString("en-US", DATE_FORMAT_OPTIONS);
  }, []);

  return <time ref={ref} dateTime={initialIso} suppressHydrationWarning>{initialLabel}</time>;
}
