"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

interface Props {
  articleId: string;
  sourceName: string;
  biasLabel: string;
  sentimentLabel: string;
  confidence: number;
}

export default function ArticleViewTracker({
  articleId,
  sourceName,
  biasLabel,
  sentimentLabel,
  confidence,
}: Props) {
  useEffect(() => {
    posthog.capture("article_viewed", {
      article_id: articleId,
      source_name: sourceName,
      bias_label: biasLabel,
      sentiment_label: sentimentLabel,
      confidence,
    });
    // Only fires once on mount — synchronizing with the analytics external system
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
