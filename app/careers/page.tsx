import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ToastHost from "@/components/ToastHost";

export default function CareersPage() {
  return <div className="site-page">
    <ToastHost />
    <SiteHeader />

    <main className="site-shell" id="top-news">
      <section className="static-page">
        <h1>Careers at biasly</h1>
        <p>We&apos;re building tools to help people better understand how news is framed. If that sounds interesting to you, we&apos;d love to hear from you.</p>
        <p>We don&apos;t have any open roles listed right now, but we&apos;re always happy to connect with engineers, journalists, and researchers who care about media literacy and AI.</p>
        <p>Reach out via our <a href="/contact">Contact page</a> and tell us a bit about yourself.</p>
      </section>
    </main>

    <SiteFooter />
  </div>;
}
