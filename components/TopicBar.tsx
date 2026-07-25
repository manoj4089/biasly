"use client";

import { useRef, useState } from "react";
import { useOutsideClose } from "./useOutsideClose";

const STORAGE_KEY = "biasly-topics";
const MAX_CUSTOM_TOPICS = 8;

function readFollowed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

interface Props {
  baseTopics: string[];
  addIcon: React.ReactNode;
  chipIcon: React.ReactNode;
}

export default function TopicBar({ baseTopics, addIcon, chipIcon }: Props) {
  const [followed, setFollowed] = useState<Set<string>>(readFollowed);
  const [customTopics, setCustomTopics] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const addRef = useRef<HTMLDivElement>(null);

  useOutsideClose(addRef, adding, () => setAdding(false));

  function toggleFollow(topic: string) {
    setFollowed((prev) => {
      const next = new Set(prev);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  function addTopic() {
    const value = draft.trim();
    if (!value || customTopics.length >= MAX_CUSTOM_TOPICS) return;
    setCustomTopics((prev) => [...prev, value]);
    setDraft("");
    setAdding(false);
  }

  const allTopics = [...baseTopics, ...customTopics];

  return (
    <>
      <span className="popover-wrap" ref={addRef}>
        <button className="topic-add" aria-label="Add a topic" onClick={() => setAdding((v) => !v)}>
          {addIcon}
        </button>
        {adding && (
          <span className="popover topic-popover">
            <input
              autoFocus
              type="text"
              value={draft}
              placeholder="Add topic"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && addTopic()}
            />
            <button type="button" onClick={addTopic}>Add</button>
          </span>
        )}
      </span>
      {allTopics.map((topic) => (
        <button
          key={topic}
          type="button"
          className={followed.has(topic) ? "topic-chip followed" : "topic-chip"}
          aria-pressed={followed.has(topic)}
          onClick={() => toggleFollow(topic)}
          suppressHydrationWarning
        >
          {topic}
          {chipIcon}
        </button>
      ))}
    </>
  );
}
