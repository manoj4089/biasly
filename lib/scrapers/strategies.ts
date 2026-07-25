const SOURCE_LINK_PATTERNS: Record<string, RegExp> = {
  reuters: /^https:\/\/www\.reuters\.com\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+-\d{4}-\d{2}-\d{2}\/?(?:\?.*)?$/i,
  bbc: /^https:\/\/www\.bbc\.(?:com|co\.uk)\/news\/(?:articles|videos)\/[a-z0-9]+/i,
  guardian: /^https:\/\/www\.theguardian\.com\/[a-z0-9-]+\/\d{4}\/[a-z]{3}\/\d{2}\/[a-z0-9-]+/i,
  npr: /^https:\/\/www\.npr\.org\/\d{4}\/\d{2}\/\d{2}\/\d+\/[a-z0-9-]+/i,
  ap: /^https:\/\/apnews\.com\/article\/[a-z0-9-]+\/?(?:\?.*)?$/i,
};

const ASSET_EXTENSION = /\.(jpg|jpeg|png|gif|svg|webp|css|js|pdf|xml|ico|json)(?:\?.*)?$/i;

const NON_ARTICLE_PATH_SEGMENTS = /^\/(hub|projects|video|videos|live|show|shows|podcast|podcasts|newsletters?|subscribe|tag|tags|topic|topics|author|authors|search)(\/|$)/i;

function isNonArticlePath(url: string, listingUrl: string): boolean {
  try {
    const target = new URL(url);
    const base = new URL(listingUrl);
    if (target.pathname === base.pathname || target.pathname === "/") return true;
    return NON_ARTICLE_PATH_SEGMENTS.test(target.pathname);
  } catch {
    return true;
  }
}

export function isArticleLink(strategy: string, url: string, listingUrl: string): boolean {
  if (isNonArticlePath(url, listingUrl)) return false;

  const pattern = SOURCE_LINK_PATTERNS[strategy];
  if (pattern) return pattern.test(url);

  try {
    const target = new URL(url);
    const base = new URL(listingUrl);
    if (target.origin !== base.origin) return false;
    if (ASSET_EXTENSION.test(target.pathname)) return false;
    const segments = target.pathname.split("/").filter(Boolean);
    return segments.length >= 2;
  } catch {
    return false;
  }
}
