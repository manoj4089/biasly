"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useOutsideClose } from "./useOutsideClose";
import type { ActiveNav } from "./SiteHeader";

function drawerLinkClass(active: ActiveNav | undefined, tab: ActiveNav) {
  return active === tab ? "drawer-link active" : "drawer-link";
}

export default function MobileNavDrawer({ menuIcon, closeIcon, active }: { menuIcon: React.ReactNode; closeIcon: React.ReactNode; active?: ActiveNav }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useOutsideClose(panelRef, open, () => setOpen(false));

  return (
    <>
      <button className="menu-button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? closeIcon : menuIcon}
      </button>
      {open && (
        <div className="drawer-backdrop">
          <div className="drawer-panel" ref={panelRef}>
            <nav aria-label="Mobile navigation">
              <Link className={drawerLinkClass(active, "home")} href="/" onClick={() => setOpen(false)}>Home</Link>
              <Link className={drawerLinkClass(active, "for-you")} href="/for-you" onClick={() => setOpen(false)}>For You</Link>
              <Link className={drawerLinkClass(active, "local")} href="/local" onClick={() => setOpen(false)}>Local</Link>
              <Link className={drawerLinkClass(active, "blindspot")} href="/blindspot" onClick={() => setOpen(false)}>Blindspot</Link>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
