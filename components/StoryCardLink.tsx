"use client";

import Link from "next/link";
import posthog from "posthog-js";

interface Props {
  href: string;
  articleId: string;
  sourceName: string;
  biasLabel: string;
  sentimentLabel: string;
  className?: string;
  ariaLabel?: string;
  children: React.ReactNode;
}

export default function StoryCardLink({
  href,
  articleId,
  sourceName,
  biasLabel,
  sentimentLabel,
  className,
  ariaLabel,
  children,
}: Props) {
  return (
    <Link
      href={href}
      className={className}
      aria-label={ariaLabel}
      onClick={() => {
        posthog.capture("article_clicked", {
          article_id: articleId,
          source_name: sourceName,
          bias_label: biasLabel,
          sentiment_label: sentimentLabel,
        });
      }}
    >
      {children}
    </Link>
  );
}
