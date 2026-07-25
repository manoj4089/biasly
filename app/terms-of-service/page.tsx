import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ToastHost from "@/components/ToastHost";

export default function TermsOfServicePage() {
  return <div className="site-page">
    <ToastHost />
    <SiteHeader />

    <main className="site-shell" id="top-news">
      <section className="static-page">
        <h1>Terms of Service</h1>
        <p>This is a placeholder terms of service for biasly and does not yet reflect final legal review.</p>
        <p>By using biasly, you agree to use the site for personal, non-commercial purposes. Political framing and sentiment scores are AI-estimated and provided for informational purposes only — they are not a statement of objective fact.</p>
        <p>We may update these terms as the product evolves. Continued use of the site after changes constitutes acceptance of the updated terms.</p>
        <p>Questions about these terms can be sent to <a href="mailto:hello@biasly.news">hello@biasly.news</a>.</p>
      </section>
    </main>

    <SiteFooter />
  </div>;
}
