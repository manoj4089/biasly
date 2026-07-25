import Link from "next/link";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import ThemeToggle from "@/components/ThemeToggle";
import MastheadDate from "@/components/MastheadDate";
import LocationPicker from "@/components/LocationPicker";
import EditionPicker from "@/components/EditionPicker";
import MobileNavDrawer from "@/components/MobileNavDrawer";
import TopicBar from "@/components/TopicBar";
import { Brand, Icon } from "@/components/StoryCard";
import { getArticles } from "@/lib/news";
import { deriveTopics } from "@/lib/topics";

export type ActiveNav = "home" | "for-you" | "local" | "blindspot";

function navClass(active: ActiveNav | undefined, tab: ActiveNav) {
  return active === tab ? "active" : undefined;
}

export default async function SiteHeader({ active }: { active?: ActiveNav }) {
  const articles = await getArticles();
  const topics = deriveTopics(articles);
  const todayIso = new Date().toISOString();
  const dateLabel = new Date(todayIso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <header>
      <div className="utility-bar">
        <div className="site-shell utility-content">
          <div className="utility-left"><span>Browser Extension</span><i /><ThemeToggle /></div>
          <div className="utility-right">
            <MastheadDate initialIso={todayIso} initialLabel={dateLabel} />
            <i />
            <LocationPicker />
            <i />
            <EditionPicker globeIcon={<Icon name="globe" size={12} />} chevronIcon={<Icon name="chevron" size={13} />} />
          </div>
        </div>
      </div>
      <div className="main-nav">
        <div className="site-shell nav-content">
          <MobileNavDrawer menuIcon={<Icon name="menu" size={23} />} closeIcon={<Icon name="x" size={20} />} active={active} />
          <Brand />
          <nav className="primary-nav" aria-label="Primary navigation">
            <Link className={navClass(active, "home")} href="/">Home</Link>
            <Link className={navClass(active, "for-you")} href="/for-you">For You <em /></Link>
            <Link className={navClass(active, "local")} href="/local">Local</Link>
            <Link className={navClass(active, "blindspot")} href="/blindspot">Blindspot</Link>
          </nav>
          <div className="nav-actions">
            <Show when="signed-out">
              <SignUpButton mode="redirect" fallbackRedirectUrl="/">
                <button className="subscribe-button">Subscribe</button>
              </SignUpButton>
              <SignInButton mode="redirect" fallbackRedirectUrl="/">
                <button className="login-button">Login</button>
              </SignInButton>
            </Show>
            <Show when="signed-in"><UserButton /></Show>
          </div>
        </div>
      </div>
      <div className="topic-bar"><div className="site-shell topic-scroll"><TopicBar baseTopics={topics} addIcon={<Icon name="plus" size={16} />} chipIcon={<Icon name="plus" size={14} />} /><span className="topic-fade" /></div></div>
    </header>
  );
}
