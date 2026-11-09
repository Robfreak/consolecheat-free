export type Kind = "game" | "demo";

export type Item = {
  sku: string;
  name: string;
  image: string | null;
  kind: Kind;
  platforms: string[];
};

export type RegionInfo = {
  id: string;
  label: string;
  locale: string;
  count: number;
  games: number;
  demos: number;
};

function fileUrl(name: string): string {
  return `${import.meta.env.BASE_URL}data/games/${name}`;
}

export async function loadRegions(): Promise<RegionInfo[]> {
  const response = await fetch(fileUrl("index.json"));
  if (!response.ok) throw new Error("index");
  const data = (await response.json()) as RegionInfo[];
  return data.filter((region) => /^[a-z]{2}$/.test(region.id));
}

export async function loadCatalog(regionId: string): Promise<Item[]> {
  if (!/^[a-z]{2}$/.test(regionId)) throw new Error("region");
  const response = await fetch(fileUrl(`${regionId}.json`));
  if (!response.ok) throw new Error("catalog");
  const raw = (await response.json()) as unknown[];
  const items: Item[] = [];
  for (const row of raw) {
    if (!Array.isArray(row) || typeof row[0] !== "string" || typeof row[1] !== "string") continue;
    items.push({
      sku: row[0],
      name: row[1],
      image: typeof row[2] === "string" ? row[2] : null,
      kind: row[3] === "demo" ? "demo" : "game",
      platforms: Array.isArray(row[4]) ? row[4].filter((platform) => typeof platform === "string") : [],
    });
  }
  return items;
}
