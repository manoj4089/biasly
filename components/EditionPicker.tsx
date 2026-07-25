"use client";

import { useRef, useState } from "react";
import { useOutsideClose } from "./useOutsideClose";

const STORAGE_KEY = "biasly-edition";
const EDITIONS = ["International Edition", "U.S. Edition", "U.K. Edition", "Asia Edition"];

export default function EditionPicker({ globeIcon, chevronIcon }: { globeIcon: React.ReactNode; chevronIcon: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [edition, setEdition] = useState<string>(() => {
    if (typeof window === "undefined") return EDITIONS[0];
    return localStorage.getItem(STORAGE_KEY) ?? EDITIONS[0];
  });
  const ref = useRef<HTMLDivElement>(null);

  useOutsideClose(ref, open, () => setOpen(false));

  function choose(value: string) {
    localStorage.setItem(STORAGE_KEY, value);
    setEdition(value);
    setOpen(false);
  }

  return (
    <span className="popover-wrap" ref={ref}>
      <button type="button" className="edition" onClick={() => setOpen((v) => !v)} aria-expanded={open} suppressHydrationWarning>
        {globeIcon}
        {edition}
        {chevronIcon}
      </button>
      {open && (
        <span className="popover edition-popover">
          {EDITIONS.map((option) => (
            <button key={option} type="button" className={option === edition ? "active" : ""} onClick={() => choose(option)}>
              {option}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
