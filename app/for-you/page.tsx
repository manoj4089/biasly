import { getArticles } from "@/lib/news";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ForYouFeed from "@/components/ForYouFeed";
import ToastHost from "@/components/ToastHost";

export default async function ForYouPage() {
  const articles = await getArticles();
  return <div className="site-page">
    <ToastHost />
    <SiteHeader active="for-you" />

    <main className="site-shell" id="top-news">
      <section className="top-news" aria-labelledby="for-you-heading">
        <h1 id="for-you-heading">For You</h1>
        <ForYouFeed articles={articles} />
      </section>
    </main>

    <SiteFooter />
  </div>;
}
