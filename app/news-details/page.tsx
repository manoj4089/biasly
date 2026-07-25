import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { NewsArticle } from "@/lib/news";
import NewsletterForm from "./newsletter-form";
import ArticleViewTracker from "@/components/ArticleViewTracker";
import RelatedStoryLink from "@/components/RelatedStoryLink";
import { Brand } from "@/components/StoryCard";

export const metadata: Metadata = {
  title: "Article analysis | biasly",
  description: "Balanced article analysis from biasly.",
};

function InfoIcon() {
  return <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 10.5v5M12 7.5h.01" /></svg>;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function MeterRow({ label, percentage }: { label: string; percentage: number }) {
  return <div className="analysis-row"><span>{label}</span><b>{percentage}%</b><div className="analysis-track"><i style={{ width: `${percentage}%` }} /></div></div>;
}

function SourceBarRow({ bucket, label, percentage, count }: { bucket: "left" | "center" | "right"; label: string; percentage: number; count: number }) {
  return <div className={`analysis-row ${bucket}`}><span>{label}</span><b>{count} ({percentage}%)</b><div className="analysis-track"><i style={{ width: `${percentage}%` }} /></div></div>;
}

function RelatedStory({ story, currentArticleId }: { story: NewsArticle; currentArticleId: string }) {
  return <RelatedStoryLink href={`/news/${story.id}`} currentArticleId={currentArticleId} relatedArticleId={story.id} sourceName={story.source.name} className="related-story">
    <div className="related-image" style={{ backgroundImage: `url("${story.image_url}")` }} />
    <div className="related-copy">
      <small>{story.source.name} · {capitalize(story.analysis.sentiment_label)}</small>
      <b>{story.title}</b>
      <em><i>1 sources</i></em>
    </div>
  </RelatedStoryLink>;
}

export default function NewsDetailsPage({ article, relatedArticles }: { article?: NewsArticle; relatedArticles?: NewsArticle[] }) {
  if (!article) notFound();
  const analysis = article.analysis;
  const paragraphs = article.raw_text.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);

  return <div className="site-page detail-site-page">
    <ArticleViewTracker
      articleId={article.id}
      sourceName={article.source.name}
      biasLabel={analysis.bias_label}
      sentimentLabel={analysis.sentiment_label}
      confidence={analysis.confidence}
    />
    <header className="main-nav detail-nav"><div className="site-shell nav-content"><Link href="/" aria-label="biasly News"><Brand /></Link><Link href="/" className="login-button">Back to news</Link></div></header>
    <main className="site-shell detail-layout">
      <article className="article-column">
        <header className="article-header">
          <p className="article-kicker">{article.source.name} <span>·</span> {new Date(article.published_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
          <h1>{article.title}</h1>
          <div className="article-byline"><span>{article.source.name}</span><i /><span>Analyzed {new Date(article.analyzed_at ?? analysis.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span></div>
        </header>
        <div className="hero-image" role="img" aria-label={article.title} style={{ backgroundImage: `url("${article.image_url}")` }} />
        <p className="image-credit">Source: {article.source.name}</p>
        <section className="distribution-card" aria-labelledby="distribution-heading"><div className="distribution-heading"><h2 id="distribution-heading">Framing distribution</h2></div><div className="distribution-meter"><span className="meter-left">Left {analysis.left_percentage}%</span><span className="meter-center">Center {analysis.center_percentage}%</span><span className="meter-right">Right {analysis.right_percentage}%</span></div><b>{analysis.bias_label} framing</b></section>
        <div className="article-body"><p className="article-summary">{analysis.neutral_summary}</p>{paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
        {relatedArticles && relatedArticles.length > 0 && <section className="related-section" aria-labelledby="related-heading">
          <h2 id="related-heading">Related articles</h2>
          <div className="related-grid">{relatedArticles.map((story) => <RelatedStory key={story.id} story={story} currentArticleId={article.id} />)}</div>
        </section>}
      </article>
      <aside className="analysis-column">
        <section className="side-panel bias-panel"><div className="side-heading"><h2>Article analysis</h2></div><p className="overall-label">Bias label</p><strong className="overall-bias">{analysis.bias_label}</strong><p className="analysis-subtitle">{Math.round(analysis.confidence * 100)}% confidence</p><div className="analysis-divider" /><MeterRow label="Left" percentage={analysis.left_percentage} /><MeterRow label="Center" percentage={analysis.center_percentage} /><MeterRow label="Right" percentage={analysis.right_percentage} /><p className="bias-explainer">{analysis.framing_notes}</p></section>
        <section className="side-panel summary-panel"><div className="side-heading"><h2>Signals</h2></div><p><b>Sentiment:</b> {analysis.sentiment_label} ({analysis.sentiment_score})</p><p><b>Loaded terms:</b> {analysis.loaded_terms.length ? analysis.loaded_terms.join(", ") : "None detected"}</p><p className="mistakes-note">{analysis.disclaimer}</p><button type="button" className="feedback-button">Provide Feedback</button></section>
        <section className="side-panel sources-panel">
          <div className="side-heading"><h2>Source Breakdown</h2><InfoIcon /></div>
          <p className="source-total">1 Total Sources</p>
          <div className="source-bars">
            <SourceBarRow bucket="left" label="Left" percentage={analysis.left_percentage} count={analysis.bias_label === "left" ? 1 : 0} />
            <SourceBarRow bucket="center" label="Center" percentage={analysis.center_percentage} count={analysis.bias_label === "center" ? 1 : 0} />
            <SourceBarRow bucket="right" label="Right" percentage={analysis.right_percentage} count={analysis.bias_label === "right" ? 1 : 0} />
          </div>
          <div className="source-list-heading"><span>Top Sources</span><span>Bias</span></div>
          <div className="source-list"><div><span>{article.source.name}</span><b className={analysis.bias_label}>{capitalize(analysis.bias_label)}</b></div></div>
          <Link href="/" className="outline-action">View All Sources</Link>
        </section>
      </aside>
    </main>
    <section className="site-shell newsletter">
      <div>
        <h2>Stay Informed. Stay Balanced.</h2>
        <p>Get the top stories and bias analysis delivered to your inbox.</p>
      </div>
      <NewsletterForm />
    </section>
  </div>;
}
