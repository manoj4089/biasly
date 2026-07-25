"use client";

import { useRef, useState } from "react";
import { useOutsideClose } from "./useOutsideClose";

const STORAGE_KEY = "biasly-location";

export default function LocationPicker() {
  const [open, setOpen] = useState(false);
  const [location, setLocation] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY);
  });
  const [draft, setDraft] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useOutsideClose(ref, open, () => setOpen(false));

  function save() {
    const value = draft.trim();
    if (!value) return;
    localStorage.setItem(STORAGE_KEY, value);
    setLocation(value);
    setOpen(false);
  }

  return (
    <span className="popover-wrap" ref={ref}>
      <button type="button" className="utility-link" onClick={() => { setDraft(location ?? ""); setOpen((v) => !v); }} aria-expanded={open} suppressHydrationWarning>
        {location ? `${location} · Change` : "Set Location"}
      </button>
      {open && (
        <span className="popover">
          <input
            autoFocus
            type="text"
            value={draft}
            placeholder="City, country"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && save()}
          />
          <button type="button" onClick={save}>Save</button>
        </span>
      )}
    </span>
  );
}
