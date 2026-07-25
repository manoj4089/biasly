import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ToastHost from "@/components/ToastHost";

export default function PressPage() {
  return <div className="site-page">
    <ToastHost />
    <SiteHeader />

    <main className="site-shell" id="top-news">
      <section className="static-page">
        <h1>Press</h1>
        <p>Resources for journalists and press covering biasly, including brand assets and background on how our AI analysis works.</p>
        <p>We don&apos;t have a formal press kit published yet. For interview requests or media inquiries, please reach out via our <a href="/contact">Contact page</a>.</p>
      </section>
    </main>

    <SiteFooter />
  </div>;
}
