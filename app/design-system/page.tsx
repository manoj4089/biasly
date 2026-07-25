import type { Metadata } from "next";

type DsIconName = "menu" | "search" | "bookmark" | "clock" | "info" | "share" | "external" | "calendar" | "chart" | "tag" | "profile" | "bell" | "sliders" | "check" | "more";

const icons: Record<DsIconName, React.ReactNode> = {
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
  bookmark: <path d="M7 4h10a1 1 0 0 1 1 1v15l-6-3.6L6 20V5a1 1 0 0 1 1-1Z" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 10.5v5M12 7.5h.01" /></>,
  share: <><path d="M5 11v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8M12 4v11M8 8l4-4 4 4" /></>,
  external: <><path d="M13 5h6v6M19 5l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></>,
  calendar: <><rect x="4" y="6" width="16" height="14" rx="1" /><path d="M8 4v4M16 4v4M4 10h16M8 14h.01M12 14h.01M16 14h.01" /></>,
  chart: <><path d="M4 19V5M4 19h16M8 16v-3M12 16V9M16 16V6" /><path d="m6 10 4-3 3 2 5-4" /></>,
  tag: <path d="M4 5.5V11l8.5 8.5a2 2 0 0 0 2.8 0l4.2-4.2a2 2 0 0 0 0-2.8L11 4H5a1 1 0 0 0-1 1.5ZM8 8h.01" />,
  profile: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-3.5 3.1-5.3 7-5.3s6.2 1.8 7 5.3" /></>,
  bell: <><path d="M18 10a6 6 0 1 0-12 0c0 7-2 7-2 8h16c0-1-2-1-2-8ZM10 21h4" /></>,
  sliders: <><path d="M4 7h5M14 7h6M4 17h8M17 17h3M9 7a2 2 0 1 0 4 0 2 2 0 0 0-4 0ZM12 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z" /></>,
  check: <><circle cx="12" cy="12" r="8.5" /><path d="m8.5 12 2.2 2.2 4.8-4.8" /></>,
  more: <path d="M5 12h.01M12 12h.01M19 12h.01" />,
};

const typeRows = [
  ["H1", "Page / Screen Title", "32px", "Bold", "1.2"], ["H2", "Section Title", "24px", "SemiBold", "1.3"], ["H3", "Card / Module Title", "20px", "SemiBold", "1.3"], ["H4", "Subheading", "16px", "Medium", "1.4"], ["Body Large", "Important content", "16px", "Regular", "1.6"], ["Body Medium", "Body text", "14px", "Regular", "1.6"], ["Body Small", "Supporting text", "13px", "Regular", "1.6"], ["Caption", "Labels, meta text", "11px", "Regular", "1.4"],
];

export const metadata: Metadata = {
  title: "Biasly Design System",
  description: "Biasly visual tokens and component reference.",
};

function DsIcon({ name, size = 22 }: { name: DsIconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>;
}

function DsSection({ title, className = "", children }: { title: string; className?: string; children: React.ReactNode }) {
  return <section className={`ds-panel ${className}`}><h2>{title}</h2><div className="ds-rule" />{children}</section>;
}

function DsTokenGroup({ label, values }: { label: string; values: [string, string][] }) {
  return <div className="ds-token-group"><h3>{label}</h3><div className="ds-tokens">{values.map(([name, color]) => <div className="ds-token" key={name}><i style={{ background: color }} /><b>{name}</b><span>{color}</span></div>)}</div></div>;
}

function DsBiasMeter({ compact = false }: { compact?: boolean }) {
  return <div className={`ds-bias-meter ${compact ? "ds-compact-meter" : ""}`}><span>Left 25%</span><span>Center 50%</span><span>Right {compact ? "49%" : "25%"}</span></div>;
}

function Foundation({ type, title, value }: { type: string; title: string; value: string }) {
  return <div className="ds-foundation"><i className={type} /><span><b>{title}</b>{value}</span></div>;
}

export default function DesignSystemPage() {
  return <main className="ds-page">
    <div className="ds-board">
      <aside className="ds-left">
        <DsSection title="Brand" className="ds-brand-panel"><div className="ds-wordmark">biasly<span>News</span></div><p>Balanced news coverage,<br />powered by AI.</p></DsSection>
        <DsSection title="Colors" className="ds-colors-panel"><DsTokenGroup label="Primary" values={[["Text primary", "#0D0D0F"], ["Text secondary", "#687280"], ["Surface", "#F6F6F6"]]} /><DsTokenGroup label="Semantic" values={[["Left bias", "#B42318"], ["Center", "#E5E7EB"], ["Right bias", "#1D4ED8"]]} /><DsTokenGroup label="Neutrals" values={[["Bg primary", "#FFFFFF"], ["Bg secondary", "#F0F0F0"], ["Border", "#E5E7EB"], ["Divider", "#E5E7EB"]]} /></DsSection>
        <DsSection title="Spacing System" className="ds-spacing-panel"><span className="ds-base-unit">(4PX BASE UNIT)</span><div className="ds-spacing-bars">{[4, 8, 16, 24, 32, 40, 64].map((n) => <div key={n}><i style={{ height: `${Math.max(8, n)}px` }} /><b>{n}px</b></div>)}</div><p>Consistent spacing scale based on 4px base unit</p></DsSection>
      </aside>

      <section className="ds-middle">
        <DsSection title="Typography" className="ds-type-panel"><div className="ds-type-content"><div className="ds-font-sample"><span>Font family</span><strong>Poppins</strong><p>Poppins is a modern geometric sans-serif typeface that ensures clarity and excellent readability.</p></div><div className="ds-type-table"><div className="ds-type-head"><span>Style</span><span>Size</span><span>Weight</span><span>Line height</span></div>{typeRows.map((row) => <div className="ds-type-row" key={row[0]}><b>{row[0]}</b><span>{row[1]}</span><span>{row[2]}</span><span>{row[3]}</span><span>{row[4]}</span></div>)}</div></div></DsSection>
        <div className="ds-middle-bottom"><DsSection title="Icons" className="ds-icons-panel"><div className="ds-icons-grid">{(Object.keys(icons) as DsIconName[]).map((name) => <div key={name}><DsIcon name={name} /></div>)}</div><p>Line style&nbsp; • &nbsp;2px stroke&nbsp; • &nbsp;Rounded caps</p></DsSection><DsSection title="Grid System" className="ds-grid-panel"><div className="ds-grid-demo"><div className="ds-grid-columns">{Array.from({ length: 12 }).map((_, index) => <i key={index} />)}</div><div><span>Container<b>1280px</b></span><span>Columns<b>12</b></span><span>Gutter<b>24px</b></span><span>Margin<b>24px</b></span></div></div></DsSection></div>
      </section>

      <aside className="ds-right">
        <DsSection title="UI Elements" className="ds-ui-panel"><h3>Buttons</h3><div className="ds-button-head"><span /><span>Default</span><span>Hover</span><span>Outline</span><span>Disabled</span></div><div className="ds-button-row ds-primary"><b>Primary</b><button>Button</button><button>Button</button><button>Button</button><button>Button</button></div><div className="ds-button-row ds-secondary"><b>Secondary</b><button>Button</button><button>Button</button><button>Button</button><button>Button</button></div><div className="ds-button-row ds-text-row"><b>Text</b><button>Button</button><button>Button</button><span>—</span><span>—</span></div><h3 className="ds-chip-heading">Chip / Category</h3><div className="ds-chips">{["World Cup", "IPL", "Business & Markets", "More"].map((chip) => <button key={chip}>{chip}<b>+</b></button>)}</div><h3 className="ds-meter-heading">Bias Meter</h3><DsBiasMeter /><div className="ds-meter-scale"><span>0%</span><span>50%</span><span>100%</span></div></DsSection>
        <DsSection title="Card Example" className="ds-card-panel"><article className="ds-story-card"><div className="ds-story-image"><span><DsIcon name="info" size={14} /></span></div><div><p>Politics&nbsp; · &nbsp;United States</p><h3>Trump Sends Iran Revised Peace Proposal With Tougher Terms: Report</h3><small>The proposal includes stricter limits on uranium enrichment and enhanced verification measures.</small><DsBiasMeter compact /><footer><span><DsIcon name="clock" size={16} />2h ago</span><span><DsIcon name="bookmark" size={16} />12 min read</span></footer></div></article></DsSection>
        <div className="ds-foundations"><DsSection title="Shadows" className="ds-shadow-panel"><Foundation type="ds-shadow-small" title="Small" value="0px 1px 2px rgba(0,0,0,0.05)" /><Foundation type="ds-shadow-medium" title="Medium" value="0px 4px 12px rgba(0,0,0,0.08)" /><Foundation type="ds-shadow-large" title="Large" value="0px 12px 24px rgba(0,0,0,0.12)" /></DsSection><DsSection title="Border Radius" className="ds-radius-panel"><Foundation type="ds-radius-small" title="Small" value="4px" /><Foundation type="ds-radius-medium" title="Medium" value="8px" /><Foundation type="ds-radius-large" title="Large" value="12px" /><Foundation type="ds-radius-full" title="Full" value="9999px" /></DsSection></div>
      </aside>
    </div>
    <footer className="ds-footer"><div className="ds-footer-brand">biasly<span>News</span></div><p>Balanced news coverage,<br />powered by AI.</p><span>Design System v1.0</span><span>June 1, 2026</span><strong>Stay consistent. Stay unbiased.</strong></footer>
  </main>;
}
