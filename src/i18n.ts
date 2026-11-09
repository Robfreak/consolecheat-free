export const LANGS = ["en", "de"] as const;
export type Lang = (typeof LANGS)[number];

const en = {
  unofficial: "Unofficial. Not Sony.",
  title: "Every free PS game and demo.",
  lede: "Pick your store region. Add one title through PlayStation checkout, or paste pdccws_p and send every free game and demo in that region to the cart.",
  cookie: "pdccws_p cookie",
  cookieHelp: "Only needed for the automatic add. It stays in this browser tab.",
  save: "Save cookie",
  disconnect: "Disconnect",
  region: "Account region",
  addAll: "Add all free",
  resume: "Resume",
  stop: "Stop",
  reset: "Reset",
  openCart: "Open cart",
  checkout: "PlayStation checkout",
  addOne: "Add to cart",
  adding: "Adding…",
  search: "Search",
  all: "All",
  games: "Games",
  demos: "Demos",
  platform: "All platforms",
  added: "Added",
  skipped: "Already in",
  failed: "Failed",
  tried: "tried",
  guides: "How it works",
  back: "Back to the catalog",
  empty: "Nothing matches.",
  page: "Page",
  prev: "Previous",
  next: "Next",
  needCookie: "Save the pdccws_p cookie first.",
  workerMissing: "The cart service is not connected yet. PlayStation checkout still works for one title.",
  authFail: "PlayStation rejected the cookie. Copy a fresh pdccws_p.",
  cartFull: "The cart is full. Finish on PlayStation, then resume.",
  theme: "Theme",
  dark: "Dark",
  light: "Light",
  more: "More tools",
  avatar: "Avatar tool",
  showing: "Showing",
} as const;

const de: Record<keyof typeof en, string> = {
  unofficial: "Inoffiziell. Nicht von Sony.",
  title: "Jedes kostenlose PS-Spiel und jede Demo.",
  lede: "Region wählen. Ein Titel über die PlayStation-Kasse, oder pdccws_p einfügen und alle kostenlosen Spiele und Demos dieser Region in den Warenkorb legen.",
  cookie: "pdccws_p-Cookie",
  cookieHelp: "Nur fürs automatische Hinzufügen. Bleibt in diesem Browser-Tab.",
  save: "Cookie speichern",
  disconnect: "Trennen",
  region: "Region des Kontos",
  addAll: "Alle Gratis hinzufügen",
  resume: "Fortsetzen",
  stop: "Stopp",
  reset: "Zurücksetzen",
  openCart: "Warenkorb öffnen",
  checkout: "PlayStation-Kasse",
  addOne: "In den Warenkorb",
  adding: "Wird hinzugefügt…",
  search: "Suche",
  all: "Alle",
  games: "Spiele",
  demos: "Demos",
  platform: "Alle Plattformen",
  added: "Hinzugefügt",
  skipped: "Schon drin",
  failed: "Fehlgeschlagen",
  tried: "versucht",
  guides: "So funktioniert es",
  back: "Zurück zum Katalog",
  empty: "Nichts passt.",
  page: "Seite",
  prev: "Zurück",
  next: "Weiter",
  needCookie: "Zuerst den pdccws_p-Cookie speichern.",
  workerMissing: "Der Warenkorb-Dienst ist noch nicht verbunden. Die PlayStation-Kasse geht für einen Titel trotzdem.",
  authFail: "PlayStation hat den Cookie abgelehnt. Einen neuen pdccws_p kopieren.",
  cartFull: "Der Warenkorb ist voll. Bei PlayStation abschließen, dann fortsetzen.",
  theme: "Darstellung",
  dark: "Dunkel",
  light: "Hell",
  more: "Mehr Tools",
  avatar: "Avatar-Tool",
  showing: "Angezeigt",
};

export type Key = keyof typeof en;

export function detectLang(): Lang {
  const saved = localStorage.getItem("consolecheat-free-lang");
  if (saved === "de" || saved === "en") return saved;
  return navigator.language.toLowerCase().startsWith("de") ? "de" : "en";
}

export function translate(lang: Lang, key: Key): string {
  return (lang === "de" ? de : en)[key] || en[key];
}
