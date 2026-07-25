import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ToastHost from "@/components/ToastHost";

export default function HelpCenterPage() {
  return <div className="site-page">
    <ToastHost />
    <SiteHeader />

    <main className="site-shell" id="top-news">
      <section className="static-page">
        <h1>Help Center</h1>
        <p>Answers to common questions about using biasly, understanding sentiment and framing scores, and managing your account.</p>
        <p>Our full help center is still being written. In the meantime, check out our <a href="/guides">Guides</a> or <a href="/contact">contact us</a> directly with any question.</p>
      </section>
    </main>

    <SiteFooter />
  </div>;
}
