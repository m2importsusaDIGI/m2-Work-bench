import type { ProspectHit, ProspectSearchResult, SocialHit } from "./types";

// Free, keyless public OpenStreetMap services — no API key, no billing account.
// Nominatim: turns "Alexandria, VA" into coordinates.
// Overpass: finds named businesses matching the niche near those coordinates.
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const USER_AGENT = "M2WorkbenchProspecting/1.0 (agency prospecting tool)";
const DEFAULT_RADIUS_METERS = 32000; // ~20 miles — fixed default, no UI slider
const MAX_RESULTS = 25;
const CRAWL_CONCURRENCY = 4;

type OverpassElement = {
type: "node" | "way" | "relation";
id: number;
lat?: number;
lon?: number;
center?: { lat: number; lon: number };
tags?: Record<string, string>;
};

async function batched<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
const out: R[] = [];
for (let i = 0; i < items.length; i += size) {
const slice = items.slice(i, i + size);
out.push(...(await Promise.all(slice.map(fn))));
}
return out;
}

async function geocode(location: string): Promise<{ lat: number; lon: number } | null> {
const url = new URL(NOMINATIM_URL);
url.searchParams.set("q", location);
url.searchParams.set("format", "json");
url.searchParams.set("limit", "1");
try {
const res = await fetch(url.toString(), {
headers: { "User-Agent": USER_AGENT },
signal: AbortSignal.timeout(10_000),
});
const json = await res.json();
if (!Array.isArray(json) || json.length === 0) return null;
return { lat: parseFloat(json[0].lat), lon: parseFloat(json[0].lon) };
} catch {
return null;
}
}

function escapeRegex(s: string) {
return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function queryOverpass(niche: string, lat: number, lon: number): Promise<OverpassElement[]> {
const term = escapeRegex(niche.trim());
const around = `around:${DEFAULT_RADIUS_METERS},${lat},${lon}`;
// Matches businesses whose name, shop type, office type, or craft mentions the niche —
// a practical heuristic since trade/service businesses usually name themselves after their trade.
const query = `
[out:json][timeout:20];
(
nwr(${around})["name"~"${term}",i];
nwr(${around})["shop"~"${term}",i];
nwr(${around})["craft"~"${term}",i];
nwr(${around})["office"~"${term}",i];
);
out center tags 60;
`;
try {
const res = await fetch(OVERPASS_URL, {
method: "POST",
headers: { "Content-Type": "text/plain", "User-Agent": USER_AGENT },
body: query,
signal: AbortSignal.timeout(25_000),
});
const json = await res.json();
return (json.elements ?? []) as OverpassElement[];
} catch {
return [];
}
}

function addressFromTags(tags: Record<string, string>): string {
const parts = [
[tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
tags["addr:city"],
tags["addr:state"],
tags["addr:postcode"],
].filter(Boolean);
return parts.join(", ");
}

async function socialsFromWebsite(websiteUrl: string): Promise<SocialHit[]> {
if (!websiteUrl) return [];
try {
const { crawlUrl } = await import("./crawl.server");
const crawl = await crawlUrl(websiteUrl);
return crawl.ok ? crawl.socials : [];
} catch {
return [];
}
}

export async function searchProspects(input: { niche: string; location: string }): Promise<ProspectSearchResult> {
const niche = input.niche.trim();
const location = input.location.trim();
const empty = { ok: false, error: null, niche, location, results: [] } as ProspectSearchResult;

if (!niche || !location) {
return { ...empty, error: "Enter both an industry/niche and a location." };
}

const point = await geocode(location);
if (!point) {
return { ...empty, error: `Couldn't find "${location}" — try a more specific city/state.` };
}

const elements = await queryOverpass(niche, point.lat, point.lon);
if (elements.length === 0) {
return { ...empty, ok: true };
}

// Dedupe by name + rough position (OSM often has the same business split across
// a node and a building outline) before spending crawl calls on it twice.
const seen = new Set<string>();
const unique: OverpassElement[] = [];
for (const el of elements) {
const name = el.tags?.name;
if (!name) continue;
const lat = el.lat ?? el.center?.lat ?? 0;
const lon = el.lon ?? el.center?.lon ?? 0;
const key = `${name.trim().toLowerCase()}|${lat.toFixed(3)}|${lon.toFixed(3)}`;
if (seen.has(key)) continue;
seen.add(key);
unique.push(el);
if (unique.length >= MAX_RESULTS) break;
}

const results: ProspectHit[] = await batched(unique, CRAWL_CONCURRENCY, async (el) => {
const tags = el.tags ?? {};
const website = tags.website ?? tags["contact:website"] ?? "";
const socials = await socialsFromWebsite(website);
return {
placeId: `${el.type}/${el.id}`,
businessName: tags.name ?? "",
websiteUrl: website,
phone: tags.phone ?? tags["contact:phone"] ?? "",
address: addressFromTags(tags),
socials,
};
});

return { ok: true, error: null, niche, location, results };
}
