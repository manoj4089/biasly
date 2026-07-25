"use client";

import { showToast } from "./toast";

interface Props {
  className?: string;
  "aria-label"?: string;
  children: React.ReactNode;
}

export default function ComingSoonLink({ className, children, ...rest }: Props) {
  return (
    <a
      href="#top-news"
      className={className}
      {...rest}
      onClick={(event) => {
        event.preventDefault();
        showToast("Coming soon");
      }}
    >
      {children}
    </a>
  );
}
