"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import StoryCard from "@/components/StoryCard";
import type { NewsArticle } from "@/lib/news";

const STORAGE_KEY = "biasly-topics";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot() {
  return localStorage.getItem(STORAGE_KEY) ?? "[]";
}

function getServerSnapshot() {
  return "[]";
}

function parseTopics(raw: string): string[] {
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export default function ForYouFeed({ articles }: { articles: NewsArticle[] }) {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const followed = parseTopics(raw);

  if (followed.length === 0) {
    return (
      <p className="empty-state">
        Follow a topic on the <Link href="/">homepage</Link> to build your feed here.
      </p>
    );
  }

  const matched = articles.filter((story) =>
    followed.some((topic) => story.title.toLowerCase().includes(topic.toLowerCase()))
  );

  if (matched.length === 0) {
    return (
      <p className="empty-state">
        No stories matching your followed topics yet. Check back later or follow more topics on the <Link href="/">homepage</Link>.
      </p>
    );
  }

  return <div className="story-grid">{matched.map((story) => <StoryCard key={story.id} story={story} />)}</div>;
}
