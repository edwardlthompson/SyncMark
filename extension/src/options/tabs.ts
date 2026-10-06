/** Settings sections: one visible at a time, driven by the URL hash (keyboard- and link-friendly). */

const TABS = ["setup", "sync", "organize", "export"] as const;
type Tab = (typeof TABS)[number];
const LAST_KEY = "syncmark.lastTab";

function current(): Tab {
  const hash = location.hash.replace("#", "") as Tab;
  if (TABS.includes(hash)) return hash;
  const saved = localStorage.getItem(LAST_KEY) as Tab | null;
  return saved && TABS.includes(saved) ? saved : "setup";
}

function show(tab: Tab): void {
  document.querySelectorAll<HTMLElement>("[data-panel]").forEach((p) => {
    p.classList.toggle("hidden", p.dataset.panel !== tab);
  });
  document.querySelectorAll<HTMLAnchorElement>("#nav a").forEach((a) => {
    if (a.dataset.tab === tab) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  localStorage.setItem(LAST_KEY, tab);
}

window.addEventListener("hashchange", () => show(current()));
show(current());

// Mirror the link status into the sidebar so it is visible from every section.
const statusEl = document.getElementById("spaceStatus");
const navStatus = document.getElementById("navStatus");
if (statusEl && navStatus) {
  const sync = () => (navStatus.textContent = statusEl.textContent || "No folder linked yet.");
  new MutationObserver(sync).observe(statusEl, { childList: true, characterData: true, subtree: true });
  sync();
}

export {};
