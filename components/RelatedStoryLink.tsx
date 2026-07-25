"use client";

import Link from "next/link";
import posthog from "posthog-js";

interface Props {
  href: string;
  currentArticleId: string;
  relatedArticleId: string;
  sourceName: string;
  className?: string;
  children: React.ReactNode;
}

export default function RelatedStoryLink({
  href,
  currentArticleId,
  relatedArticleId,
  sourceName,
  className,
  children,
}: Props) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        posthog.capture("related_article_clicked", {
          current_article_id: currentArticleId,
          related_article_id: relatedArticleId,
          source_name: sourceName,
        });
      }}
    >
      {children}
    </Link>
  );
}
