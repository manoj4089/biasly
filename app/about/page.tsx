import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ToastHost from "@/components/ToastHost";

export default function AboutPage() {
  return <div className="site-page">
    <ToastHost />
    <SiteHeader />

    <main className="site-shell" id="top-news">
      <section className="static-page">
        <h1>About biasly</h1>
        <p>biasly is an AI-powered news analysis platform. We collect articles from a range of news sources and use AI to surface how each story is framed, so readers can see the same event covered from multiple angles in one place.</p>
        <p>Our goal is simple: help readers recognize bias, not eliminate it. Every article we analyze is scored for sentiment and political framing, with the underlying evidence shown alongside the score so you can judge for yourself.</p>
        <p>biasly is under active development. This page is a placeholder — more about our mission, team, and methodology is coming soon.</p>
      </section>
    </main>

    <SiteFooter />
  </div>;
}
