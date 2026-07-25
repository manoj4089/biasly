import type { NewsArticle } from "@/lib/news";

const STOPWORDS = new Set([
  "about", "after", "again", "against", "before", "being", "could", "during",
  "every", "first", "from", "have", "here", "into", "more", "most", "much",
  "other", "over", "said", "says", "should", "some", "than", "that", "their",
  "them", "then", "there", "these", "they", "this", "those", "time", "under",
  "were", "what", "when", "which", "while", "will", "with", "would", "your",
  "just", "exclusive", "watch", "towards", "sources", "center", "right",
  "south", "north", "east", "west", "still", "even", "back", "only", "also",
]);

const MAX_TOPICS = 9;
const MIN_WORD_LENGTH = 4;

export function deriveTopics(articles: NewsArticle[], max = MAX_TOPICS): string[] {
  const frequency = new Map<string, number>();

  for (const { title } of articles) {
    const words = title.split(/[^a-zA-Z']+/).filter(Boolean);
    const seenInTitle = new Set<string>();
    for (const word of words) {
      const lower = word.toLowerCase();
      if (lower.length < MIN_WORD_LENGTH || STOPWORDS.has(lower) || seenInTitle.has(lower)) continue;
      seenInTitle.add(lower);
      frequency.set(lower, (frequency.get(lower) ?? 0) + 1);
    }
  }

  return [...frequency.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));
}
