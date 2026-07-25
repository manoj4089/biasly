import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ToastHost from "@/components/ToastHost";

export default async function LocalPage() {
  return <div className="site-page">
    <ToastHost />
    <SiteHeader active="local" />

    <main className="site-shell" id="top-news">
      <section className="top-news" aria-labelledby="local-heading">
        <h1 id="local-heading">Local</h1>
        <p className="empty-state">Local coverage isn&apos;t available yet — biasly doesn&apos;t currently tag sources by region.</p>
      </section>
    </main>

    <SiteFooter />
  </div>;
}
