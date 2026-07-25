import { getArticles } from "@/lib/news";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import StoryCard from "@/components/StoryCard";
import ToastHost from "@/components/ToastHost";

export default async function Home() {
  const articles = await getArticles();
  return <div className="site-page">
    <ToastHost />
    <SiteHeader active="home" />

    <main className="site-shell" id="top-news">
      <section className="top-news" aria-labelledby="top-news-heading">
        <h1 id="top-news-heading">Top News</h1>
        {articles.length === 0 ? <p className="empty-state">No analyzed articles yet. Run the scraper and analysis pipeline to see balanced coverage here.</p> : <div className="story-grid">{articles.map((story) => <StoryCard key={story.id} story={story} />)}</div>}
      </section>
    </main>

    <SiteFooter />
  </div>;
}
