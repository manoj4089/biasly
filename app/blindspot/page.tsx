import { getArticles } from "@/lib/news";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import StoryCard from "@/components/StoryCard";
import ToastHost from "@/components/ToastHost";

const MIN_CONFIDENCE = 0.6;
const ONE_SIDED_LABELS = new Set(["left", "right"]);

export default async function BlindspotPage() {
  const articles = await getArticles();
  const oneSided = articles
    .filter((story) => ONE_SIDED_LABELS.has(story.analysis.bias_label) && story.analysis.confidence >= MIN_CONFIDENCE)
    .sort((a, b) =>
      Math.max(b.analysis.left_percentage, b.analysis.right_percentage) -
      Math.max(a.analysis.left_percentage, a.analysis.right_percentage)
    );

  return <div className="site-page">
    <ToastHost />
    <SiteHeader active="blindspot" />

    <main className="site-shell" id="top-news">
      <section className="top-news" aria-labelledby="blindspot-heading">
        <h1 id="blindspot-heading">Blindspot</h1>
        {oneSided.length === 0 ? (
          <p className="empty-state">No strongly one-sided stories detected right now.</p>
        ) : (
          <div className="story-grid">{oneSided.map((story) => <StoryCard key={story.id} story={story} />)}</div>
        )}
      </section>
    </main>

    <SiteFooter />
  </div>;
}
