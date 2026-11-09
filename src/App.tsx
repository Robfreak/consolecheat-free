import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ExternalLink, Moon, Sun } from "lucide-react";
import { addBatch, checkoutUrl, WORKER_URL } from "./cart";
import { loadCatalog, loadRegions, type Item, type RegionInfo } from "./catalog";
import { detectLang, translate, type Key, type Lang } from "./i18n";

const TOKEN_KEY = "consolecheat-free-token";
const REGION_KEY = "consolecheat-free-region";
const THEME_KEY = "consolecheat-theme";
const PAGE = 24;
const BATCH = 4;

type LogLine = { sku: string; name: string; status: "added" | "skipped" | "failed" };

function flag(code: string): string {
  return `${import.meta.env.BASE_URL}flags/${code}.svg`;
}

function countryName(lang: Lang, id: string, fallback: string): string {
  try {
    return new Intl.DisplayNames([lang], { type: "region" }).of(id.toUpperCase()) || fallback;
  } catch {
    return fallback;
  }
}

export function App() {
  const [lang, setLang] = useState<Lang>("en");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [view, setView] = useState(location.hash === "#guides" ? "guides" : "home");
  const [regions, setRegions] = useState<RegionInfo[]>([]);
  const [region, setRegion] = useState("us");
  const [regionOpen, setRegionOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "game" | "demo">("all");
  const [platform, setPlatform] = useState("all");
  const [page, setPage] = useState(0);
  const [draft, setDraft] = useState("");
  const [token, setToken] = useState("");
  const [cursor, setCursor] = useState(0);
  const [counts, setCounts] = useState({ added: 0, skipped: 0, failed: 0 });
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const [note, setNote] = useState("");
  const stopRef = useRef(false);
  const regionBox = useRef<HTMLDivElement>(null);
  const t = (key: Key) => translate(lang, key);

  useEffect(() => {
    setLang(detectLang());
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
    setToken(sessionStorage.getItem(TOKEN_KEY) ?? "");
    setDraft(sessionStorage.getItem(TOKEN_KEY) ?? "");
    loadRegions()
      .then((list) => {
        setRegions(list);
        const saved = sessionStorage.getItem(REGION_KEY);
        const browser = navigator.language.toLowerCase().split("-")[1];
        const next = [saved, browser, "us"].find((id) => id && list.some((entry) => entry.id === id)) ?? list[0]?.id ?? "us";
        setRegion(next);
      })
      .catch(() => setNote("Catalog missing."));
  }, []);

  useEffect(() => {
    if (!region) return;
    setItems([]);
    setPage(0);
    setCursor(Number(sessionStorage.getItem(`consolecheat-free-index-${region}`) || 0));
    loadCatalog(region).then(setItems).catch(() => setItems([]));
  }, [region]);

  useEffect(() => {
    if (!regionOpen) return;
    const close = (event: PointerEvent) => {
      if (!regionBox.current?.contains(event.target as Node)) setRegionOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [regionOpen]);

  const platforms = useMemo(() => {
    const values = new Set<string>();
    for (const item of items) for (const platformName of item.platforms) values.add(platformName);
    return [...values].sort();
  }, [items]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (kind !== "all" && item.kind !== kind) return false;
      if (platform !== "all" && !item.platforms.includes(platform)) return false;
      if (needle && !item.name.toLowerCase().includes(needle) && !item.sku.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [items, query, kind, platform]);

  const queue = useMemo(
    () => items.filter((item) => (kind === "all" ? true : item.kind === kind)),
    [items, kind],
  );
  const pages = Math.max(1, Math.ceil(visible.length / PAGE));
  const safePage = Math.min(page, pages - 1);
  const slice = visible.slice(safePage * PAGE, safePage * PAGE + PAGE);
  const selected = regions.find((entry) => entry.id === region);

  function applyTheme(next: "dark" | "light") {
    document.documentElement.dataset.theme = next;
    localStorage.setItem(THEME_KEY, next);
    setTheme(next);
  }

  function saveToken() {
    const value = draft.trim();
    sessionStorage.setItem(TOKEN_KEY, value);
    setToken(value);
  }

  function changeRegion(next: string) {
    sessionStorage.setItem(REGION_KEY, next);
    setRegion(next);
    setRegionOpen(false);
    setCounts({ added: 0, skipped: 0, failed: 0 });
    setLog([]);
    setNote("");
  }

  async function addSkus(list: Item[], from: number) {
    if (!WORKER_URL.trim()) {
      setNote(t("workerMissing"));
      return;
    }
    if (token.length < 20) {
      setNote(t("needCookie"));
      return;
    }
    stopRef.current = false;
    setRunning(true);
    setNote("");
    let index = from;
    const nextCounts = { ...counts };
    try {
      while (index < list.length && !stopRef.current) {
        const batch = list.slice(index, index + BATCH);
        const result = await addBatch({ token, region, skus: batch.map((item) => item.sku) });
        const bySku = new Map(result.results.map((row) => [row.sku, row]));
        for (const item of batch) {
          const row = bySku.get(item.sku);
          const status = row?.status ?? "failed";
          nextCounts[status] += 1;
          setLog((current) => [{ sku: item.sku, name: item.name, status }, ...current].slice(0, 40));
        }
        setCounts({ ...nextCounts });
        index += batch.length;
        setCursor(index);
        sessionStorage.setItem(`consolecheat-free-index-${region}`, String(index));
        if (result.authFailed) {
          setNote(t("authFail"));
          break;
        }
        if (result.cartFull) {
          setNote(t("cartFull"));
          break;
        }
      }
    } catch (error) {
      setNote(error instanceof Error && error.message === "not_configured" ? t("workerMissing") : t("failed"));
    } finally {
      setRunning(false);
    }
  }

  async function addOne(item: Item) {
    if (!WORKER_URL.trim()) {
      setNote(t("workerMissing"));
      return;
    }
    if (token.length < 20) {
      setNote(t("needCookie"));
      return;
    }
    setBusy(item.sku);
    try {
      const result = await addBatch({ token, region, skus: [item.sku] });
      const status = result.results[0]?.status ?? "failed";
      setCounts((current) => ({ ...current, [status]: current[status] + 1 }));
      setLog((current) => [{ sku: item.sku, name: item.name, status }, ...current].slice(0, 40));
      if (result.authFailed) setNote(t("authFail"));
      if (result.cartFull) setNote(t("cartFull"));
    } catch {
      setNote(t("workerMissing"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <header className="header">
        <div className="wrap header-row">
          <a className="brand" href="#catalog" onClick={() => setView("home")}>
            <span className="mark">PS</span>
            <span>
              <strong>consolecheat</strong>
              <small>{t("unofficial")}</small>
            </span>
          </a>
          <nav className="nav">
            <a className="chip" href="#guides" onClick={() => setView("guides")}>{t("guides")}</a>
            <a className="chip" href="https://avatar.consolecheat.com/">{t("avatar")}</a>
            <button type="button" className="chip" aria-label={t("theme")} onClick={() => applyTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              <span className="hide-sm">{theme === "dark" ? t("light") : t("dark")}</span>
            </button>
            <select className="select" aria-label="Language" value={lang} onChange={(event) => {
              const next = event.target.value === "de" ? "de" : "en";
              localStorage.setItem("consolecheat-free-lang", next);
              setLang(next);
            }}>
              <option value="en">English</option>
              <option value="de">Deutsch</option>
            </select>
          </nav>
        </div>
      </header>
      {view === "guides" ? <Guides lang={lang} onBack={() => setView("home")} /> : (
        <main className="wrap" id="catalog">
          <section className="hero">
            <p className="kicker">free.consolecheat</p>
            <h1>{t("title")}</h1>
            <p className="lede">{t("lede")}</p>
          </section>
          <div className="grid cards">
            <section className="panel">
              <h2>{t("cookie")}</h2>
              <p className="muted">{t("cookieHelp")}</p>
              <textarea className="field" rows={4} value={draft} spellCheck={false} onChange={(event) => setDraft(event.target.value)} />
              <div className="toolbar" style={{ marginTop: 8 }}>
                <button type="button" className="btn primary" onClick={saveToken}>{t("save")}</button>
                {token ? <button type="button" className="btn" onClick={() => { sessionStorage.removeItem(TOKEN_KEY); setToken(""); setDraft(""); }}>{t("disconnect")}</button> : null}
              </div>
              <label style={{ display: "block", marginTop: 16 }}>{t("region")}</label>
              <div className="region" ref={regionBox}>
                <button type="button" className="btn region-btn" style={{ marginTop: 6 }} onClick={() => setRegionOpen((open) => !open)} disabled={running}>
                  <img className="flag" alt="" src={flag(region)} />
                  <span style={{ flex: 1 }}>{selected ? `${countryName(lang, selected.id, selected.label)} · ${selected.games} / ${selected.demos}` : region}</span>
                  <ChevronDown size={16} />
                </button>
                {regionOpen ? (
                  <div className="region-list" role="listbox">
                    {regions.map((entry) => (
                      <button type="button" className="region-item" key={entry.id} aria-selected={entry.id === region} onClick={() => changeRegion(entry.id)}>
                        <img className="flag" alt="" src={flag(entry.id)} />
                        <span>{countryName(lang, entry.id, entry.label)} · {entry.games} {t("games").toLowerCase()} / {entry.demos} {t("demos").toLowerCase()}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>
            <section className="panel">
              <h2>{t("addAll")}</h2>
              <p className="muted">{Math.min(cursor, queue.length).toLocaleString()} / {queue.length.toLocaleString()} {t("tried")}</p>
              <div className="bar"><span style={{ width: `${queue.length ? Math.min(100, (cursor / queue.length) * 100) : 0}%` }} /></div>
              <div className="stats">
                <span className="ok">{t("added")} <b>{counts.added}</b></span>
                <span className="warn">{t("skipped")} <b>{counts.skipped}</b></span>
                <span className="bad">{t("failed")} <b>{counts.failed}</b></span>
              </div>
              <div className="toolbar" style={{ marginTop: 12 }}>
                <button type="button" className="btn primary" disabled={running} onClick={() => void addSkus(queue, cursor >= queue.length ? 0 : cursor)}>{cursor > 0 && cursor < queue.length ? t("resume") : t("addAll")}</button>
                <button type="button" className="btn" disabled={!running} onClick={() => { stopRef.current = true; }}>{t("stop")}</button>
                <button type="button" className="btn" disabled={running} onClick={() => { setCursor(0); sessionStorage.removeItem(`consolecheat-free-index-${region}`); setCounts({ added: 0, skipped: 0, failed: 0 }); setLog([]); }}>{t("reset")}</button>
                <a className="btn" href="https://checkout.playstation.com/cart" target="_blank" rel="noreferrer">{t("openCart")} <ExternalLink size={14} /></a>
              </div>
              {note ? <p className="warn">{note}</p> : null}
              <div className="log">
                {log.map((line) => <div key={`${line.sku}-${line.status}`} className={line.status === "added" ? "ok" : line.status === "skipped" ? "warn" : "bad"}>{line.name}</div>)}
              </div>
            </section>
          </div>
          <section className="panel" style={{ marginTop: 16 }}>
            <div className="toolbar">
              <input className="field" style={{ maxWidth: 280 }} placeholder={t("search")} value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} />
              {(["all", "game", "demo"] as const).map((value) => (
                <button type="button" key={value} className={kind === value ? "btn primary" : "btn"} onClick={() => { setKind(value); setPage(0); setCursor(0); }}>
                  {value === "all" ? t("all") : value === "game" ? t("games") : t("demos")}
                </button>
              ))}
              <select className="select" value={platform} onChange={(event) => { setPlatform(event.target.value); setPage(0); }}>
                <option value="all">{t("platform")}</option>
                {platforms.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <span className="muted">{t("showing")} {visible.length.toLocaleString()}</span>
            </div>
            <div className="catalog">
              {slice.map((item) => (
                <article className="card" key={item.sku}>
                  <div className="cover">{item.image ? <img src={item.image} alt="" /> : item.name.slice(0, 1)}</div>
                  <strong>{item.name}</strong>
                  <div>
                    <span className={item.kind === "demo" ? "badge demo" : "badge"}>{item.kind === "demo" ? t("demos") : t("games")}</span>
                    <span className="muted"> {item.platforms.join(", ")}</span>
                  </div>
                  <button type="button" className="btn ghost" disabled={running || busy === item.sku} onClick={() => void addOne(item)}>{busy === item.sku ? t("adding") : t("addOne")}</button>
                  <a className="btn" href={checkoutUrl(item.sku)} target="_blank" rel="noreferrer">{t("checkout")}</a>
                </article>
              ))}
            </div>
            {slice.length === 0 ? <p className="muted">{t("empty")}</p> : null}
            <div className="pager" style={{ marginTop: 12 }}>
              <button type="button" className="btn" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>{t("prev")}</button>
              <span className="muted">{t("page")} {safePage + 1} / {pages}</span>
              <button type="button" className="btn" disabled={safePage + 1 >= pages} onClick={() => setPage(safePage + 1)}>{t("next")}</button>
            </div>
          </section>
        </main>
      )}
      <footer className="footer">
        <div className="wrap footer-row">
          <p className="muted">consolecheat · free games and demos. Payments stay on PlayStation.</p>
          <a href="https://consolecheat.com/">{t("more")} <ExternalLink size={14} /></a>
        </div>
      </footer>
    </>
  );
}

function Guides({ lang, onBack }: { lang: Lang; onBack: () => void }) {
  const german = lang === "de";
  return (
    <main className="wrap guides">
      <p className="kicker">free.consolecheat</p>
      <h1>{german ? "So funktioniert es" : "How it works"}</h1>
      <section className="panel">
        <h2>1. {german ? "Zwei Wege" : "Two ways"}</h2>
        <p>{german
          ? "PlayStation-Kasse braucht keinen Cookie und öffnet genau einen Titel bei Sony. Alle Gratis hinzufügen schickt jedes kostenlose Spiel und jede Demo der gewählten Region über den Cookie in den Warenkorb."
          : "PlayStation checkout needs no cookie and opens one title on Sony’s page. Add all free sends every free game and demo in the selected region through the cookie."}</p>
      </section>
      <section className="panel">
        <h2>2. {german ? "Cookie kopieren" : "Copy the cookie"}</h2>
        <ol>
          <li>{german ? "Auf store.playstation.com anmelden." : "Sign in at store.playstation.com."}</li>
          <li>{german ? "F12, Application bzw. Speicher, Cookies, store.playstation.com." : "F12, Application or Storage, Cookies, store.playstation.com."}</li>
          <li>{german ? "pdccws_p öffnen, URL-decoded anzeigen, den ganzen Wert kopieren." : "Open pdccws_p, show the URL-decoded value, and copy all of it."}</li>
          <li>{german ? "Hier einfügen und speichern. Der Tab vergisst ihn beim Schließen." : "Paste it here and save. This tab forgets it when closed."}</li>
        </ol>
      </section>
      <section className="panel">
        <h2>3. {german ? "Region und Filter" : "Region and filters"}</h2>
        <p>{german
          ? "Die Flagge ist das Land des PSN-Kontos. Spiele und Demos lassen sich trennen, ebenso die Plattform. Der Lauf nimmt nur das, was der Filter gerade zeigt, wenn du Spiele oder Demos gewählt hast."
          : "The flag is the country of the PSN account. You can split games and demos, and filter by platform. The bulk run follows that games-or-demos filter."}</p>
      </section>
      <button type="button" className="btn" onClick={onBack}>{german ? "Zurück zum Katalog" : "Back to the catalog"}</button>
    </main>
  );
}
