import Link from "next/link";
import ComingSoonLink from "@/components/ComingSoonLink";
import { Brand, Icon } from "@/components/StoryCard";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-shell footer-content">
        <div className="footer-brand"><Brand footer /><p>Balanced news coverage<br />powered by AI.</p></div>
        <div className="footer-links">
          <div><b>Company</b><Link href="/about">About</Link><Link href="/careers">Careers</Link><Link href="/press">Press</Link><Link href="/contact">Contact</Link></div>
          <div><b>Help</b><Link href="/help-center">Help Center</Link><Link href="/guides">Guides</Link><Link href="/privacy-policy">Privacy Policy</Link><Link href="/terms-of-service">Terms of Service</Link></div>
          <div className="connect"><b>Connect</b><p>
            <ComingSoonLink aria-label="X"><Icon name="x" /></ComingSoonLink>
            <a href="https://www.linkedin.com/in/manoj-r-6391091b7" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"><Icon name="linkedin" /></a>
            <ComingSoonLink aria-label="Instagram"><Icon name="instagram" /></ComingSoonLink>
            <ComingSoonLink aria-label="YouTube"><Icon name="youtube" /></ComingSoonLink>
          </p></div>
        </div>
      </div>
      <div className="footer-copyright"><div className="site-shell">© 2026 Biasly News. All rights reserved.</div></div>
    </footer>
  );
}
