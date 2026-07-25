import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ToastHost from "@/components/ToastHost";

export default function PrivacyPolicyPage() {
  return <div className="site-page">
    <ToastHost />
    <SiteHeader />

    <main className="site-shell" id="top-news">
      <section className="static-page">
        <h1>Privacy Policy</h1>
        <p>This is a placeholder privacy policy for biasly and does not yet reflect final legal review.</p>
        <p>We collect account information through our authentication provider to let you sign in and personalize your feed. We do not sell your personal data to third parties.</p>
        <p>Article data we display is drawn from publicly available news sources and analyzed with AI models to produce sentiment and framing insights.</p>
        <p>Questions about this policy can be sent to <a href="mailto:hello@biasly.news">hello@biasly.news</a>.</p>
      </section>
    </main>

    <SiteFooter />
  </div>;
}
