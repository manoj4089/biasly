import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ToastHost from "@/components/ToastHost";

export default function ContactPage() {
  return <div className="site-page">
    <ToastHost />
    <SiteHeader />

    <main className="site-shell" id="top-news">
      <section className="static-page">
        <h1>Contact us</h1>
        <p>Have a question, found an issue, or want to share feedback about an article&apos;s analysis? We&apos;d like to hear from you.</p>
        <p>Email us at <a href="mailto:hello@biasly.news">hello@biasly.news</a> and we&apos;ll get back to you as soon as we can.</p>
      </section>
    </main>

    <SiteFooter />
  </div>;
}
