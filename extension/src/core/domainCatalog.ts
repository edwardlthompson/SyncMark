/** Local host → category map (FOSS, offline). Exact hostname match after stripping www. */

export interface DomainHit {
  category: string;
  tags: string[];
  reason: string;
}

/** Compact curated map of popular hosts (extend over time; no cloud API). */
const HOSTS: Record<string, [string, string]> = {
  // Development
  "github.com": ["Development", "code"],
  "gist.github.com": ["Development", "code"],
  "gitlab.com": ["Development", "code"],
  "bitbucket.org": ["Development", "code"],
  "stackoverflow.com": ["Development", "docs"],
  "stackexchange.com": ["Development", "docs"],
  "developer.mozilla.org": ["Development", "docs"],
  "mdn.io": ["Development", "docs"],
  "npmjs.com": ["Development", "packages"],
  "pypi.org": ["Development", "packages"],
  "crates.io": ["Development", "packages"],
  "hub.docker.com": ["Development", "devops"],
  "docker.com": ["Development", "devops"],
  "kubernetes.io": ["Development", "devops"],
  "vercel.com": ["Development", "hosting"],
  "netlify.com": ["Development", "hosting"],
  "heroku.com": ["Development", "hosting"],
  "digitalocean.com": ["Development", "cloud"],
  "aws.amazon.com": ["Development", "cloud"],
  "cloud.google.com": ["Development", "cloud"],
  "azure.microsoft.com": ["Development", "cloud"],
  "codepen.io": ["Development", "code"],
  "jsfiddle.net": ["Development", "code"],
  "replit.com": ["Development", "code"],
  "dev.to": ["Development", "blog"],
  "hashnode.dev": ["Development", "blog"],
  "css-tricks.com": ["Development", "docs"],
  "smashingmagazine.com": ["Development", "docs"],
  // Media
  "youtube.com": ["Media", "video"],
  "youtu.be": ["Media", "video"],
  "vimeo.com": ["Media", "video"],
  "netflix.com": ["Media", "video"],
  "twitch.tv": ["Media", "stream"],
  "spotify.com": ["Media", "music"],
  "music.apple.com": ["Media", "music"],
  "soundcloud.com": ["Media", "music"],
  "open.spotify.com": ["Media", "music"],
  "imdb.com": ["Media", "film"],
  "rottentomatoes.com": ["Media", "film"],
  "letterboxd.com": ["Media", "film"],
  "tiktok.com": ["Media", "video"],
  "podcasts.apple.com": ["Media", "podcast"],
  // News
  "nytimes.com": ["News", "news"],
  "bbc.com": ["News", "news"],
  "bbc.co.uk": ["News", "news"],
  "theguardian.com": ["News", "news"],
  "reuters.com": ["News", "news"],
  "apnews.com": ["News", "news"],
  "cnn.com": ["News", "news"],
  "npr.org": ["News", "news"],
  "washingtonpost.com": ["News", "news"],
  "wsj.com": ["News", "news"],
  "ft.com": ["News", "news"],
  "bloomberg.com": ["News", "news"],
  "techcrunch.com": ["News", "tech"],
  "theverge.com": ["News", "tech"],
  "arstechnica.com": ["News", "tech"],
  "wired.com": ["News", "tech"],
  "hn.algolia.com": ["News", "tech"],
  "news.ycombinator.com": ["News", "tech"],
  // Shopping
  "amazon.com": ["Shopping", "shop"],
  "amazon.co.uk": ["Shopping", "shop"],
  "ebay.com": ["Shopping", "shop"],
  "etsy.com": ["Shopping", "shop"],
  "walmart.com": ["Shopping", "shop"],
  "target.com": ["Shopping", "shop"],
  "bestbuy.com": ["Shopping", "shop"],
  "aliexpress.com": ["Shopping", "shop"],
  "shopify.com": ["Shopping", "shop"],
  "newegg.com": ["Shopping", "shop"],
  // Productivity
  "mail.google.com": ["Productivity", "email"],
  "outlook.live.com": ["Productivity", "email"],
  "outlook.office.com": ["Productivity", "email"],
  "proton.me": ["Productivity", "email"],
  "docs.google.com": ["Productivity", "docs"],
  "sheets.google.com": ["Productivity", "docs"],
  "drive.google.com": ["Productivity", "files"],
  "notion.so": ["Productivity", "notes"],
  "notion.site": ["Productivity", "notes"],
  "dropbox.com": ["Productivity", "files"],
  "evernote.com": ["Productivity", "notes"],
  "todoist.com": ["Productivity", "tasks"],
  "trello.com": ["Productivity", "tasks"],
  "asana.com": ["Productivity", "tasks"],
  "slack.com": ["Productivity", "chat"],
  "teams.microsoft.com": ["Productivity", "chat"],
  "calendar.google.com": ["Productivity", "calendar"],
  "figma.com": ["Productivity", "design"],
  "canva.com": ["Productivity", "design"],
  "miro.com": ["Productivity", "whiteboard"],
  // Social
  "twitter.com": ["Social", "social"],
  "x.com": ["Social", "social"],
  "linkedin.com": ["Social", "social"],
  "facebook.com": ["Social", "social"],
  "instagram.com": ["Social", "social"],
  "reddit.com": ["Social", "forum"],
  "old.reddit.com": ["Social", "forum"],
  "discord.com": ["Social", "chat"],
  "discord.gg": ["Social", "chat"],
  "mastodon.social": ["Social", "social"],
  "threads.net": ["Social", "social"],
  // Reference / Learning
  "wikipedia.org": ["Reference", "wiki"],
  "en.wikipedia.org": ["Reference", "wiki"],
  "britannica.com": ["Reference", "encyclopedia"],
  "archive.org": ["Reference", "archive"],
  "scholar.google.com": ["Learning", "research"],
  "coursera.org": ["Learning", "course"],
  "udemy.com": ["Learning", "course"],
  "edx.org": ["Learning", "course"],
  "khanacademy.org": ["Learning", "course"],
  "brilliant.org": ["Learning", "course"],
  "duolingo.com": ["Learning", "language"],
  "medium.com": ["Learning", "article"],
  "substack.com": ["Learning", "newsletter"],
  // Finance
  "paypal.com": ["Finance", "payments"],
  "stripe.com": ["Finance", "payments"],
  "bankofamerica.com": ["Finance", "banking"],
  "chase.com": ["Finance", "banking"],
  "wellsfargo.com": ["Finance", "banking"],
  "coinbase.com": ["Finance", "crypto"],
  "finance.yahoo.com": ["Finance", "markets"],
  // Travel
  "maps.google.com": ["Travel", "maps"],
  "airbnb.com": ["Travel", "stay"],
  "booking.com": ["Travel", "stay"],
  "expedia.com": ["Travel", "travel"],
  "kayak.com": ["Travel", "flights"],
  "tripadvisor.com": ["Travel", "travel"],
  // Food
  "allrecipes.com": ["Food", "recipe"],
  "foodnetwork.com": ["Food", "recipe"],
  "seriouseats.com": ["Food", "recipe"],
  "yelp.com": ["Food", "dining"],
  "doordash.com": ["Food", "delivery"],
  "ubereats.com": ["Food", "delivery"],
  // Health
  "webmd.com": ["Health", "medical"],
  "mayoclinic.org": ["Health", "medical"],
  "nih.gov": ["Health", "medical"],
  "cdc.gov": ["Health", "medical"],
};

const PATH_RULES: Array<{ match: RegExp; category: string; tags: string[]; reason: string }> = [
  { match: /\/(recipe|recipes|cooking)\b/i, category: "Food", tags: ["recipe"], reason: "URL path looks like recipes" },
  { match: /\/(docs?|documentation|api|reference)\b/i, category: "Development", tags: ["docs"], reason: "URL path looks like docs" },
  { match: /\/(blog|article|posts?)\b/i, category: "Learning", tags: ["article"], reason: "URL path looks like articles" },
  { match: /\/(product|shop|cart|checkout|store)\b/i, category: "Shopping", tags: ["shop"], reason: "URL path looks like shopping" },
  { match: /\/(news|politics|world)\b/i, category: "News", tags: ["news"], reason: "URL path looks like news" },
  { match: /\/(watch|video|episode)\b/i, category: "Media", tags: ["video"], reason: "URL path looks like video" },
  { match: /\/(wiki)\b/i, category: "Reference", tags: ["wiki"], reason: "URL path looks like a wiki" },
  { match: /\/(course|lesson|learn|tutorial)\b/i, category: "Learning", tags: ["course"], reason: "URL path looks like learning" },
];

const TITLE_RULES: Array<{ match: RegExp; category: string; tags: string[]; reason: string }> = [
  { match: /\brecipe\b|\bcook(ing)?\b|\bingredient/i, category: "Food", tags: ["recipe"], reason: "Title mentions food/cooking" },
  { match: /\btutorial\b|\bhow to\b|\bguide\b|\bcourse\b/i, category: "Learning", tags: ["tutorial"], reason: "Title looks like a guide" },
  { match: /\breview\b|\bunboxing\b/i, category: "Shopping", tags: ["review"], reason: "Title looks like a product review" },
  { match: /\bbreaking\b|\bheadline\b|\bop-?ed\b/i, category: "News", tags: ["news"], reason: "Title looks like news" },
  { match: /\bapi\b|\bsdk\b|\brepository\b|\bchangelog\b/i, category: "Development", tags: ["code"], reason: "Title looks like developer content" },
  { match: /\btrailer\b|\bepisode\b|\bseason\b|\balbum\b/i, category: "Media", tags: ["media"], reason: "Title looks like media" },
];

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

export function lookupDomainCategory(url: string, title = ""): DomainHit | null {
  let host = "";
  let path = "";
  try {
    const u = new URL(url);
    host = normalizeHost(u.hostname);
    path = u.pathname + u.search;
  } catch {
    return null;
  }

  // Exact host, then parent domains (a.b.example.com → example.com)
  const parts = host.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    const candidate = parts.slice(i).join(".");
    const hit = HOSTS[candidate];
    if (hit) {
      return {
        category: hit[0],
        tags: [hit[1]],
        reason: `Known site: ${candidate}`,
      };
    }
  }

  for (const rule of PATH_RULES) {
    if (rule.match.test(path) || rule.match.test(url)) {
      return { category: rule.category, tags: rule.tags, reason: rule.reason };
    }
  }
  for (const rule of TITLE_RULES) {
    if (rule.match.test(title)) {
      return { category: rule.category, tags: rule.tags, reason: rule.reason };
    }
  }
  return null;
}

/** Map a suggested category onto a close existing folder name when possible. */
export function mapToExistingFolder(category: string, folders: Iterable<string>): string | null {
  const want = category.toLowerCase();
  const list = [...folders].filter(
    (f) => f && !/^(other bookmarks|bookmarks (bar|toolbar|menu))$/i.test(f),
  );
  for (const f of list) {
    if (f.toLowerCase() === want) return f;
  }
  for (const f of list) {
    const fl = f.toLowerCase();
    if (fl.includes(want) || want.includes(fl)) return f;
  }
  // Synonyms
  const syn: Record<string, string[]> = {
    development: ["dev", "coding", "programming", "code"],
    media: ["video", "movies", "music", "entertainment"],
    news: ["articles", "press", "headlines"],
    shopping: ["shop", "buys", "purchases", "store"],
    productivity: ["work", "tools", "office"],
    social: ["social media", "networks"],
    learning: ["education", "courses", "study"],
    reference: ["refs", "wiki", "docs"],
    finance: ["money", "banking"],
    travel: ["trips", "maps"],
    food: ["recipes", "cooking"],
    health: ["medical", "fitness"],
  };
  const alts = syn[want] ?? [];
  for (const f of list) {
    const fl = f.toLowerCase();
    if (alts.some((a) => fl === a || fl.includes(a))) return f;
  }
  return null;
}
