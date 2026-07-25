import StoryCardLink from "@/components/StoryCardLink";
import type { getArticles } from "@/lib/news";

export type IconName = "menu" | "chevron" | "plus" | "info" | "globe" | "x" | "linkedin" | "instagram" | "youtube";

const iconPaths: Record<IconName, React.ReactNode> = {
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  chevron: <path d="m8 10 4 4 4-4" />,
  plus: <path d="M12 5v14M5 12h14" />,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 10.5v5M12 7.5h.01" /></>,
  globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.8 12h16.4M12 3.5c2.2 2.4 3.3 5.2 3.3 8.5S14.2 18.1 12 20.5c-2.2-2.4-3.3-5.2-3.3-8.5S9.8 5.9 12 3.5Z" /></>,
  x: <path d="M5 4l14 16M19 4 5 20" />,
  linkedin: <><path d="M6.4 9.5v8M6.4 6.5h.01M10.4 17.5v-4.7c0-2 3.7-2.2 3.7 0v4.7M10.4 11.4c.6-1.6 4.5-2 4.5 1.2v4.9" /></>,
  instagram: <><rect x="4.5" y="4.5" width="15" height="15" rx="4" /><circle cx="12" cy="12" r="3.2" /><path d="M16.8 7.3h.01" /></>,
  youtube: <><path d="M20 12c0 3.8-.5 5.2-2 5.6-2.1.6-9.9.6-12 0-1.5-.4-2-1.8-2-5.6s.5-5.2 2-5.6c2.1-.6 9.9-.6 12 0 1.5.4 2 1.8 2 5.6Z" /><path d="m10.3 9.2 4.5 2.8-4.5 2.8Z" fill="currentColor" stroke="none" /></>,
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name]}</svg>;
}

export function BiasMeter({ left, center, right }: { left: number; center: number; right: number }) {
  return <div className="bias-meter" aria-label={`Framing meter: Left ${left}%, Center ${center}%, Right ${right}%`}>
    <span className="meter-left" style={{ flex: left }}>L {left}%</span><span className="meter-center" style={{ flex: center }}>Center {center}%</span><span className="meter-right" style={{ flex: right }}>Right {right}%</span>
  </div>;
}

export function Brand({ footer = false }: { footer?: boolean }) {
  return <div className={`brand ${footer ? "brand-footer" : ""}`} aria-label="biasly News"><strong>biasly</strong><span>News</span></div>;
}

export default function StoryCard({ story }: { story: Awaited<ReturnType<typeof getArticles>>[number] }) {
  const content = <>
    <div className="story-image" style={{ backgroundImage: `url("${story.image_url}")` }}>
      <span className="story-info"><Icon name="info" size={15} /></span>
    </div>
    <div className="story-content">
      <p className="story-kicker">{story.source.name}<span>•</span>{new Date(story.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
      <h2>{story.title}</h2>
      <BiasMeter left={story.analysis.left_percentage} center={story.analysis.center_percentage} right={story.analysis.right_percentage} />
      <p className="source-count">{story.analysis.sentiment_label} sentiment <span>•</span> {story.analysis.bias_label} framing <span>•</span> {Math.round(story.analysis.confidence * 100)}% confidence</p>
    </div>
  </>;

  return (
    <StoryCardLink
      href={`/news/${story.id}`}
      articleId={story.id}
      sourceName={story.source.name}
      biasLabel={story.analysis.bias_label}
      sentimentLabel={story.analysis.sentiment_label}
      className="story-card story-card-link"
      ariaLabel={`Read: ${story.title}`}
    >
      {content}
    </StoryCardLink>
  );
}
