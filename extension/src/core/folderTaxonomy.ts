/** Controlled folder vocabulary: keeps LLM answers tight, consistent, and SHORT (top-level folders sit on the bar). */

export const TOP_LEVEL_FOLDERS: Array<{ name: string; scope: string }> = [
  { name: "Gaming", scope: "anything remotely about games: titles, guides, mods, stats, stores, launchers, communities" },
  { name: "Music", scope: "music AND audio: songs, podcasts, karaoke, audio production, sound libraries, audio gear" },
  { name: "Video", scope: "movies, TV, streaming, video platforms, video editing" },
  { name: "Photo", scope: "photography, cameras, lenses, drones, photo locations and services" },
  { name: "3D Print", scope: "3D printers, models, filaments, CAD and 3D modeling, cosplay builds" },
  { name: "Auto", scope: "cars, trucks, campers/overlanding, motorcycles, parts, manuals, DMV, car culture" },
  { name: "Hardware", scope: "PC components, benchmarks, peripherals, displays, storage, networking, drivers" },
  { name: "Mobile", scope: "phones, Android/iOS as a device or OS, accessories, carriers, comparisons" },
  { name: "Software", scope: "apps, utilities, OS, browsers, privacy, downloaders (not programming)" },
  { name: "AI", scope: "AI chat, image/video generators, models, AI tools and services" },
  { name: "Dev", scope: "programming, GitHub, APIs, hosting, web dev, developer tutorials" },
  { name: "Crypto", scope: "exchanges, trading, wallets, mining, markets, tokens, crypto jobs" },
  { name: "Finance", scope: "banking, payments, taxes, companies, logistics, domains, entrepreneurship" },
  { name: "Shopping", scope: "stores, deals, gadgets, apparel, auto/home parts retailers" },
  { name: "Travel", scope: "flights, lodging, tours, attractions, boating, work exchange" },
  { name: "Property", scope: "real estate: listings, rentals, commercial property, property data" },
  { name: "Learn", scope: "education: courses, languages, schools, classrooms, brain training" },
  { name: "Ref", scope: "reference: encyclopedic, legal, maps, statistics, academic, how-to knowledge" },
  { name: "News", scope: "news outlets, politics, government and civic information" },
  { name: "Social", scope: "social networks, forums, profiles, messaging communities" },
  { name: "Tasks", scope: "productivity: notes, calendars, contacts, task boards, lists, chat tools" },
  { name: "Home", scope: "furniture, decor, solar, repairs, DIY, home improvement" },
  { name: "Food", scope: "recipes, cooking, restaurants, groceries" },
  { name: "Health", scope: "medical, fitness, wellness" },
  { name: "Outdoor", scope: "firearms, airguns, tactical gear, camping and survival" },
  { name: "Jobs", scope: "job boards, remote work, careers, voice acting careers, resumes" },
  { name: "Adult", scope: "adult content of any kind" },
  { name: "Personal", scope: "family, genealogy, personal accounts and profiles" },
];

export const MAX_TOP_LEN = 10;
export const MAX_SUB_LEN = 18;

const A = (name: string, ...aliases: string[]): Array<[string, string]> =>
  aliases.map((a) => [a, name] as [string, string]);

const ALIASES = new Map<string, string>([
  ...A("Gaming", "games", "game", "video games", "videogames", "gamer", "esports"),
  ...A("Music", "audio", "sound", "podcasts", "podcast", "audio & music", "music & audio", "music and audio", "audio/music"),
  ...A("Video", "videos", "movies", "movie", "film", "tv", "youtube", "streaming", "media", "video & film"),
  ...A("Photo", "photography", "photos", "cameras", "camera"),
  ...A("3D Print", "3d printing", "3d", "cad", "3d printing & cad", "3d printing and cad", "3d modeling"),
  ...A("Auto", "automotive", "cars", "car", "vehicles", "automobile", "motorcycles"),
  ...A("Hardware", "pc", "pcs", "computers", "computer hardware", "pc hardware", "electronics", "hardware & pcs"),
  ...A("Mobile", "phones", "phone", "smartphones", "mobile & phones"),
  ...A("Software", "apps", "app", "tools", "utilities", "programs", "software & apps"),
  ...A("AI", "artificial intelligence", "ai tools", "a.i."),
  ...A("Dev", "development", "programming", "coding", "developer", "web development"),
  ...A("Crypto", "cryptocurrency", "blockchain", "bitcoin"),
  ...A("Finance", "business", "money", "banking", "finance & business", "finance and business"),
  ...A("Shopping", "shops", "ecommerce", "e-commerce", "retail", "stores", "deals"),
  ...A("Travel", "trips", "vacation"),
  ...A("Property", "real estate", "realestate", "housing"),
  ...A("Learn", "education", "learning", "courses", "school", "training"),
  ...A("Ref", "reference", "research", "docs", "documentation", "knowledge"),
  ...A("News", "politics", "government", "news & politics"),
  ...A("Social", "social media", "community", "forums", "forum", "social & community"),
  ...A("Tasks", "productivity", "organization", "organisation"),
  ...A("Home", "diy", "home improvement", "house", "home & diy"),
  ...A("Food", "cooking", "recipes", "recipe", "food & cooking"),
  ...A("Health", "fitness", "medical", "wellness", "health & fitness"),
  ...A("Outdoor", "outdoors", "tactical", "firearms", "camping", "survival", "outdoors & tactical"),
  ...A("Jobs", "careers", "career", "work", "employment", "jobs & careers"),
  ...A("Adult", "nsfw", "xxx"),
  ...A("Personal", "family", "me"),
]);

/** Subfolder names that say nothing — dropped so the link lands in its top-level folder. */
const GENERIC_SUB = new Set([
  "tools", "resources", "guides", "guide", "tips", "misc", "miscellaneous", "other", "others", "general",
  "links", "link", "websites", "website", "sites", "site", "info", "information", "stuff", "various",
  "uncategorized", "unsorted", "bookmarks", "favorites", "favourites", "useful", "random", "references",
]);

const WORD_ABBR: Record<string, string> = {
  development: "Dev", photography: "Photo", applications: "Apps", application: "App", information: "Info",
  documentation: "Docs", management: "Mgmt", automotive: "Auto", overlanding: "Overland", accessories: "Accessory",
  entertainment: "Fun", international: "Intl", professional: "Pro", technology: "Tech",
};

const VAGUE_TOP = /^(general|misc|miscellaneous|other|others|uncategorized|unsorted|unknown|various|stuff|n\/a|none|-+)$/i;
const TRAILING_GENERIC = /\s*(?:&\s*)?\b(?:tools?|resources?|guides?|tips|links|sites?|websites?|info|community|forums?|stuff)$/i;

export const isGenericSub = (name: string): boolean => GENERIC_SUB.has(name.trim().toLowerCase());

/** Short, readable subfolder name: no “The”, no trailing generic word, common abbreviations, ≤ max chars. */
export function shortName(raw: string, max = MAX_SUB_LEN): string {
  let s = raw.replace(/\s+/g, " ").trim().replace(/^the\s+/i, "").replace(/\band\b/gi, "&");
  const stripped = s.replace(TRAILING_GENERIC, "").trim();
  if (stripped) s = stripped;
  s = s.split(" ").map((w) => WORD_ABBR[w.toLowerCase()] ?? w).join(" ");
  const words = s.split(" ");
  while (s.length > max && words.length > 1) {
    words.pop();
    while (words.length > 1 && /^[&\-–]$/.test(words[words.length - 1])) words.pop();
    s = words.join(" ");
  }
  return s.length > max ? s.slice(0, max).trim() : s;
}

/** Canonical top-level folder name for a raw name (unknown names pass through, shortened if very long). */
export function canonicalTopLevel(raw: string): string {
  const key = raw.trim().toLowerCase();
  const exact = TOP_LEVEL_FOLDERS.find((t) => t.name.toLowerCase() === key);
  const known = exact?.name ?? ALIASES.get(key);
  if (known) return known;
  const name = raw.trim();
  return name.length > MAX_TOP_LEN + 6 ? shortName(name, MAX_TOP_LEN + 6) : name;
}

/** Canonicalize an LLM folder answer: ≤2 levels, canonical short top-level, no generic subfolder. */
export function canonicalizeParts(parts: string[]): string[] | null {
  const [rawTop, ...rest] = parts;
  if (!rawTop || VAGUE_TOP.test(rawTop.trim())) return null;
  const top = canonicalTopLevel(rawTop);
  const rawSub = rest.find((p) => p && !isGenericSub(p) && !VAGUE_TOP.test(p.trim()));
  const sub = rawSub ? shortName(rawSub) : "";
  if (!sub || isGenericSub(sub) || sub.toLowerCase() === top.toLowerCase()) return [top];
  return [top, sub];
}
