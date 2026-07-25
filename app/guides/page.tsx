import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ToastHost from "@/components/ToastHost";

export default function GuidesPage() {
  return <div className="site-page">
    <ToastHost />
    <SiteHeader />

    <main className="site-shell" id="top-news">
      <section className="static-page">
        <h1>Guides</h1>
        <p>Practical guides for getting the most out of biasly — how to read a bias meter, what our sentiment labels mean, and how AI-estimated framing is calculated.</p>
        <p>We&apos;re still writing our first set of guides. Check back soon, or visit the <a href="/help-center">Help Center</a> in the meantime.</p>
      </section>
    </main>

    <SiteFooter />
  </div>;
}
