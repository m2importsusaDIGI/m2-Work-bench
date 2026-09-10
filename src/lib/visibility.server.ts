import * as cheerio from "cheerio";
import { classifySocial } from "./crawl.server";
import type {
BacklinkMove,
ContentAsset,
CrawlResult,
SocialProfile,
Target,
VisibilityAudit,
WebMention,
} from "./types";
import { FETCH_HEADERS, publicUrl } from "./crawl.server";

const HEAD_MS = 5_000;
const GET_MS = 7_000;
const SEARCH_MS = 28_000;
const MAX_TEXT = 400_000;
const NEWS_HEADERS = {
...FETCH_HEADERS,
Accept: "application/rss+xml, application/xml, text/xml, */*;q=0.8",
"User-Agent": "Mozilla/5.0 (compatible; M2Workbench/1.0; +https://m2.digital)",
};

type Probe = { ok: boolean; status: number; finalUrl: string; text: string };

async function probe(raw: string, method: "GET" | "HEAD", headers = FETCH_HEADERS): Promise<Probe> {
let url: URL;
try {
url = publicUrl(raw);
} catch {
return { ok: false, status: 0, finalUrl: raw, text: "" };
}
try {
const res = await fetch(url.toString(), {
method,
redirect: "follow",
signal: AbortSignal.timeout(method === "HEAD" ? HEAD_MS : GET_MS),
headers,
});
if (method === "HEAD") {
return { ok: res.ok, status: res.status, finalUrl: res.url || url.toString(), text: "" };
}
const buf = await res.arrayBuffer();
const slice = buf.byteLength > MAX_TEXT ? buf.slice(0, MAX_TEXT) : buf;
const text = new TextDecoder("utf-8", { fatal: false }).decode(slice);
return { ok: res.ok, status: res.status, finalUrl: res.url || url.toString(), text };
} catch {
return { ok: false, status: 0, finalUrl: raw, text: "" };
}
}

function slugsFrom(target: Target, crawl: CrawlResult | null): string[] {
const host = (() => {
try {
return new URL(crawl?.finalUrl || target.websiteUrl).hostname.replace(/^www\./, "").split(".")[0] || "";
} catch {
return "";
}
})();
const compact = target.businessName.toLowerCase().replace(/[^a-z0-9]+/g, "");
const dashed = target.businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const out: string[] = [];
for (const s of [host, dashed, compact]) {
if (s && s.length >= 3 && s.length <= 40 && !out.includes(s)) out.push(s);
}
return out.slice(0, 2);
}

function locCount(xml: string, pred: (loc: string) => boolean): { total: number; match: number } {
const locs = [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((m) => m[1].trim());
const total = locs.length;
const match = locs.filter(pred).length;
return { total, match };
}

function isArticlePath(loc: string): boolean {
return /\/(blog|news|article|press|post|story|stories|insights|journal|noticias|media)\b/i.test(loc);
}

function clamp(n: number) {
return Math.max(0, Math.min(100, Math.round(n)));
}

function ownHostOf(target: Target, crawl: CrawlResult | null): string {
try {
return new URL(crawl?.finalUrl || target.websiteUrl).hostname.replace(/^www\./, "").toLowerCase();
} catch {
return "";
}
}

function isOwnUrl(raw: string, ownHost: string): boolean {
if (!ownHost) return false;
try {
const h = new URL(raw).hostname.replace(/^www\./, "").toLowerCase();
return h === ownHost || h.endsWith(`.${ownHost}`);
} catch {
return false;
}
}

function mentionKey(url: string): string {
try {
const u = new URL(url);
return `${u.hostname.replace(/^www\./, "").toLowerCase()}${u.pathname.replace(/\/$/, "").toLowerCase()}`;
} catch {
return url.toLowerCase();
}
}

function hostOf(url: string): string {
try {
return new URL(url).hostname.replace(/^www\./, "");
} catch {
return "";
}
}

function sourceName(url: string): string {
const host = hostOf(url);
if (!host) return "Web";
const map: Record<string, string> = {
"en.wikipedia.org": "Wikipedia",
"wikipedia.org": "Wikipedia",
"youtube.com": "YouTube",
"youtu.be": "YouTube",
"vimeo.com": "Vimeo",
"yelp.com": "Yelp",
"tripadvisor.com": "Tripadvisor",
"opentable.com": "OpenTable",
"resy.com": "Resy",
"facebook.com": "Facebook",
"instagram.com": "Instagram",
"linkedin.com": "LinkedIn",
"x.com": "X",
"twitter.com": "X",
"tiktok.com": "TikTok",
"pinterest.com": "Pinterest",
"bbb.org": "BBB",
"threads.net": "Threads",
};
return map[host] || host.replace(/\.(com|org|net|co)$/i, "");
}

function classifyUrl(url: string, title = "", note = ""): WebMention | null {
let u: URL;
try {
u = publicUrl(url);
} catch {
return null;
}
const host = u.hostname.replace(/^www\./, "").toLowerCase();
const path = u.pathname.toLowerCase();
if (
host === "google.com" ||
(host.endsWith(".google.com") && !host.startsWith("news.google")) ||
host === "bing.com" ||
host.includes("duckduckgo") ||
host === "x.ai" ||
host === "grok.com" ||
/^(consent|accounts|support|help|policies)\./.test(host)
) {
return null;
}
if ((path === "/" || path === "") && !host.includes("wikipedia")) return null;
if (/\/search\b/.test(path)) return null;
const src = sourceName(u.toString());
const label = title || src;
if (host.includes("wikipedia.org")) {
if (/\/wiki\/[^/:]+:/.test(path) || !/\/wiki\//.test(path)) return null;
return { kind: "wiki", title: label, url: u.toString(), source: "Wikipedia", note: note || "Encyclopedia listing." };
}
if (host.includes("youtube") || host === "youtu.be" || host.includes("vimeo")) {
return { kind: "video", title: label, url: u.toString(), source: src, note: note || "Video on a public platform." };
}
if (
host.includes("yelp") ||
host.includes("tripadvisor") ||
host.includes("opentable") ||
host.includes("resy.com")
) {
return { kind: "review", title: label, url: u.toString(), source: src, note: note || "Review / reservation listing." };
}
if (host.includes("bbb.org") || host.includes("yellowpages") || host.includes("foursquare") || host.includes("mapquest")) {
return { kind: "directory", title: label, url: u.toString(), source: src, note: note || "Directory citation." };
}
const social = classifySocial(u.toString());
if (social) {
return {
kind: "social",
title: social.network,
url: social.url,
source: social.network,
note: note || "Public profile.",
};
}
if (/\/(blog|article|press|post|story|insights)\b/.test(path) || host.includes("medium.com") || host.includes("substack")) {
return { kind: "article", title: label, url: u.toString(), source: src, note: note || "Off-site article." };
}
if (host.includes("news") || host.startsWith("news.")) {
return { kind: "news", title: label, url: u.toString(), source: src, note: note || "News coverage." };
}
return { kind: "other", title: label, url: u.toString(), source: src, note: note || "Off-site mention." };
}

function tokenOverlap(a: string, b: string): number {
const stop = new Set(["the", "and", "of", "for", "llc", "inc", "group", "restaurant", "cafe"]);
const toks = (s: string) =>
s
.toLowerCase()
.split(/[^a-z0-9]+/)
.filter((t) => t.length >= 4 && !stop.has(t));
const A = new Set(toks(a));
let n = 0;
for (const t of toks(b)) if (A.has(t)) n += 1;
return n;
}

function wikiMatches(pageTitle: string, businessName: string): boolean {
const a = pageTitle.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const b = businessName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
if (!a || !b) return false;
if (a === b || a.startsWith(b) || b.startsWith(a)) return true;
return tokenOverlap(pageTitle, businessName) >= 2;
}

function collectHttpUrls(node: unknown, out: string[] = []): string[] {
if (node == null) return out;
if (typeof node === "string") {
const m = node.match(/https?:\/\/[^\s"'<>\\]+/gi);
if (m) {
for (const raw of m) {
const clean = raw.replace(/[),.;]+$/, "");
if (clean.length < 500) out.push(clean);
}
}
return out;
}
if (Array.isArray(node)) {
for (const x of node) collectHttpUrls(x, out);
return out;
}
if (typeof node === "object") {
for (const v of Object.values(node as Record<string, unknown>)) collectHttpUrls(v, out);
}
return out;
}

function parseModelJson(text: string): { mentions?: unknown[] } | null {
const trimmed = text.trim();
const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
const raw = fence ? fence[1] : trimmed;
const start = raw.indexOf("{");
const end = raw.lastIndexOf("}");
if (start === -1 || end === -1) return null;
try {
return JSON.parse(raw.slice(start, end + 1)) as { mentions?: unknown[] };
} catch {
return null;
}
}

function takeByKind(items: WebMention[], kind: WebMention["kind"], n: number): WebMention[] {
return items.filter((m) => m.kind === kind).slice(0, n);
}

function pickMentions(items: WebMention[]): WebMention[] {
const seen = new Set<string>();
const unique: WebMention[] = [];
for (const m of items) {
const key = mentionKey(m.url);
if (seen.has(key)) continue;
seen.add(key);
unique.push(m);
}
const picked = [
...takeByKind(unique, "wiki", 2),
...takeByKind(unique, "video", 4),
...takeByKind(unique, "review", 4),
...takeByKind(unique, "directory", 3),
...takeByKind(unique, "news", 8),
...takeByKind(unique, "article", 4),
...takeByKind(unique, "blog", 3),
...takeByKind(unique, "social", 4),
...takeByKind(unique, "other", 2),
];
const keys = new Set(picked.map((m) => mentionKey(m.url)));
const extra = unique.filter((m) => !keys.has(mentionKey(m.url))).slice(0, Math.max(0, 18 - picked.length));
return [...picked, ...extra].slice(0, 18);
}

async function fetchNewsMentions(target: Target): Promise<WebMention[]> {
const city = target.location.split(",")[0]?.trim() || target.location;
const q = `"${target.businessName}" ${city}`;
const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
const got = await probe(url, "GET", NEWS_HEADERS);
if (!got.ok || !got.text.includes("<item")) return [];
const $ = cheerio.load(got.text, { xmlMode: true });
const out: WebMention[] = [];
$("item").each((_, el) => {
if (out.length >= 10) return;
const titleRaw = $(el).find("title").first().text().trim();
const link = $(el).find("link").first().text().trim();
const source = $(el).find("source").first().text().trim() || hostOf(link) || "News";
if (!titleRaw || !link) return;
const title = titleRaw.replace(new RegExp(`\\s[-–|]\\s*${source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i"), "");
const videoish = /youtube|\bwatch\b|\bvideo\b/i.test(titleRaw);
out.push({
kind: videoish ? "video" : "news",
title: title.slice(0, 160),
url: link,
source,
note: videoish ? "Video-style coverage in the news index." : "Indexed news / article mention.",
});
});
return out;
}

async function fetchWikiMention(target: Target): Promise<WebMention | null> {
const api =`https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(target.businessName)}&limit=5&namespace=0&format=json`;
const got = await probe(api, "GET");
if (!got.ok) return null;
try {
const data = JSON.parse(got.text) as [string, string[], string[], string[]];
const titles = data[1] || [];
const urls = data[3] || [];
for (let i = 0; i < titles.length; i++) {
if (!wikiMatches(titles[i], target.businessName)) continue;
return {
kind: "wiki",
title: titles[i],
url: urls[i],
source: "Wikipedia",
note: "Encyclopedia page — a high-trust citation and Knowledge Panel signal.",
};
}
} catch {
return null;
}
return null;
}

async function searchWebMentions(target: Target, ownHost: string): Promise<{ mentions: WebMention[]; ok: boolean }> {
const apiKey = process.env.XAI_API_KEY;
if (!apiKey) return { mentions: [], ok: false };
const prompt = `Find off-site public URLs for "${target.businessName}", a ${target.niche || "local business"} in ${target.location} (owned site ${ownHost}). Search news, blogs, YouTube, Wikipedia, Yelp, Tripadvisor, Facebook, Instagram, LinkedIn, TikTok, X. JSON only: {"mentions":[{"kind":"news|article|video|review|wiki|directory|social","title":"","url":"","source":""}]}. Max 10. Exclude ${ownHost}.`;
try {
const res = await fetch("https://api.x.ai/v1/responses", {
method: "POST",
headers: {
"Content-Type": "application/json",
Authorization: `Bearer ${apiKey}`,
},
signal: AbortSignal.timeout(SEARCH_MS),
body: JSON.stringify({
model: "grok-4.5",
max_output_tokens: 500,
reasoning: { effort: "low" },
input: [{ role: "user", content: prompt }],
tools: [
{
type: "web_search",
filters: ownHost ? { excluded_domains: [ownHost] } : undefined,
},
{ type: "x_search" },
],
}),
});
if (!res.ok) return { mentions: [], ok: false };
const body = (await res.json()) as Record<string, unknown>;
const found: WebMention[] = [];
const urls = collectHttpUrls(body);
for (const url of urls) {
if (isOwnUrl(url, ownHost)) continue;
const m = classifyUrl(url);
if (m) found.push(m);
}
const output = Array.isArray(body.output) ? body.output : [];
for (const item of output) {
if (!item || typeof item !== "object") continue;
const rec = item as { type?: string; content?: unknown };
if (rec.type !== "message") continue;
const blocks = Array.isArray(rec.content) ? rec.content : [];
for (const block of blocks) {
if (!block || typeof block !== "object") continue;
const text = String((block as { text?: string }).text || "");
const parsed = parseModelJson(text);
if (!Array.isArray(parsed?.mentions)) continue;
for (const raw of parsed.mentions) {
const row = (raw ?? {}) as Record<string, unknown>;
const url = String(row.url || "");
if (!url || isOwnUrl(url, ownHost)) continue;
const m = classifyUrl(url, String(row.title || ""), "Live web search hit.");
if (m) {
if (row.kind && typeof row.kind === "string") {
const k = row.kind as WebMention["kind"];
if (["article", "blog", "news", "video", "review", "wiki", "directory", "social", "other"].includes(k)) {
m.kind = k;
}
}
if (row.source) m.source = String(row.source);
if (row.title) m.title = String(row.title).slice(0, 160);
found.push(m);
}
}
}
}
return { mentions: found, ok: true };
} catch {
return { mentions: [], ok: false };
}
}

export async function probeVisibility(input: {
target: Target;
crawl: CrawlResult | null;
}): Promise<VisibilityAudit> {
const { target, crawl } = input;
let origin = "";
try {
origin = new URL(crawl?.finalUrl || target.websiteUrl).origin;
} catch {
origin = "";
}
const ownHost = ownHostOf(target, crawl);

const content: ContentAsset[] = [];
const social: SocialProfile[] = [];
const notes: string[] = [];
const videos = (crawl?.videoUrls ?? []).map((url) => ({
url,
source: /youtube|youtu\.be/i.test(url) ? "YouTube" : /vimeo/i.test(url) ? "Vimeo" : "Video",
}));

const tasks: Array<Promise<void>> = [];
let sitemapUrls = 0;
let articleUrls = 0;
const harvested: WebMention[] = [];
let searchedWeb = false;

tasks.push(
(async () => {
const news = await fetchNewsMentions(target);
harvested.push(...news);
})(),
);
tasks.push(
(async () => {
const wiki = await fetchWikiMention(target);
if (wiki) harvested.push(wiki);
})(),
);
tasks.push(
(async () => {
const web = await searchWebMentions(target, ownHost);
searchedWeb = web.ok;
harvested.push(...web.mentions);
})(),
);

if (origin) {
tasks.push(
(async () => {
const robots = await probe(`${origin}/robots.txt`, "GET");
const sitemapLines = [...robots.text.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]);
const candidates = sitemapLines.length ? sitemapLines.slice(0, 2) : [`${origin}/sitemap.xml`];
let xml = "";
for (const sm of candidates) {
const got = await probe(sm, "GET");
if (got.ok && /<urlset|<sitemapindex/i.test(got.text)) {
xml = got.text;
break;
}
}
if (!xml) {
content.push({
kind: "sitemap",
url: `${origin}/sitemap.xml`,
status: "missing",
count: 0,
note: "No sitemap.xml found — search engines and LLMs crawl less of the site.",
});
return;
}
if (/<sitemapindex/i.test(xml)) {
const child = [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((m) => m[1].trim())[0];
if (child) {
const nested = await probe(child, "GET");
if (nested.ok) xml = nested.text;
}
}
const counts = locCount(xml, isArticlePath);
sitemapUrls = counts.total;
articleUrls = counts.match;
content.push({
kind: "sitemap",
url: candidates[0],
status: "found",
count: counts.total,
note: `${counts.total} URLs in sitemap · ${counts.match} look like articles, news, or posts.`,
});
})(),
);

const pathProbes: Array<{ kind: string; path: string; label: string }> = [
{ kind: "blog", path: "/blog", label: "Blog" },
{ kind: "news", path: "/news", label: "News" },
{ kind: "press", path: "/press", label: "Press" },
{ kind: "press", path: "/newsroom", label: "Newsroom" },
{ kind: "blog", path: "/stories", label: "Stories" },
{ kind: "blog", path: "/insights", label: "Insights" },
{ kind: "video", path: "/videos", label: "Videos" },
{ kind: "podcast", path: "/podcasts", label: "Podcasts" },
{ kind: "rss", path: "/feed", label: "RSS /feed" },
{ kind: "rss", path: "/rss.xml", label: "RSS" },
];

for (const p of pathProbes) {
tasks.push(
(async () => {
const got = await probe(`${origin}${p.path}`, "GET");
const looksHtml = /<html|<article|<item|<rss|<feed/i.test(got.text);
const live = got.ok && got.status < 400 && looksHtml;
if (!live && content.some((c) => c.kind === p.kind && c.status === "found")) return;
content.push({
kind: p.kind,
url: `${origin}${p.path}`,
status: live ? "found" : "missing",
count: live ? 1 : 0,
note: live ? `${p.label} responds ${got.status}` : `${p.label} not published at ${p.path}`,
});
})(),
);
}
}

const linked = crawl?.socials ?? [];
for (const s of linked) {
tasks.push(
(async () => {
const got = await probe(s.url, "HEAD");
social.push({
network: s.network,
url: s.url,
status: got.ok ? "linked" : "unverified",
note: got.ok
? "Linked from the homepage and the profile URL responds."
: "Linked from the homepage — profile did not respond from this check.",
});
})(),
);
}

const haveNet = new Set(linked.map((s) => s.network));
const slugs = slugsFrom(target, crawl);
const guesses: Array<{ network: string; url: string }> = [];
for (const slug of slugs) {
if (!haveNet.has("Facebook")) guesses.push({ network: "Facebook", url: `https://www.facebook.com/${slug}` });
if (!haveNet.has("Instagram")) guesses.push({ network: "Instagram", url: `https://www.instagram.com/${slug}` });
if (!haveNet.has("LinkedIn")) guesses.push({ network: "LinkedIn", url: `https://www.linkedin.com/company/${slug}` });
if (!haveNet.has("X")) guesses.push({ network: "X", url: `https://x.com/${slug}` });
if (!haveNet.has("YouTube")) guesses.push({ network: "YouTube", url: `https://www.youtube.com/@${slug}` });
if (!haveNet.has("TikTok")) guesses.push({ network: "TikTok", url: `https://www.tiktok.com/@${slug}` });
if (!haveNet.has("Pinterest")) guesses.push({ network: "Pinterest", url: `https://www.pinterest.com/${slug}` });
}
for (const g of guesses.slice(0, 10)) {
tasks.push(
(async () => {
const got = await probe(g.url, "HEAD");
if (!got.ok) {
if (!social.some((s) => s.network === g.network && s.status === "missing")) {
social.push({
network: g.network,
url: g.url,
status: "missing",
note: "No homepage link and the guessed handle did not respond.",
});
}
return;
}
social.push({
network: g.network,
url: got.finalUrl || g.url,
status: "live",
note: "Possible match from the business name — verify it is actually theirs before citing.",
});
})(),
);
}

await Promise.all(tasks);

const rank: Record<SocialProfile["status"], number> = {
linked: 0,
live: 1,
unverified: 2,
missing: 3,
};
const best = new Map<string, SocialProfile>();
for (const s of social) {
const prev = best.get(s.network);
if (!prev || rank[s.status] < rank[prev.status]) best.set(s.network, s);
}

const mentions = pickMentions(harvested.filter((m) => !isOwnUrl(m.url, ownHost)));

for (const m of mentions) {
const hit = classifySocial(m.url);
if (!hit) continue;
const prev = best.get(hit.network);
if (!prev || rank.live < rank[prev.status]) {
best.set(hit.network, {
network: hit.network,
url: hit.url,
status: prev?.status === "linked" ? "linked" : "live",
note: prev?.status === "linked" ? prev.note : `Found off-site (${m.source}) — confirm ownership, then add to the footer and sameAs.`,
});
}
}

const uniqueSocial = [...best.values()].sort((a, b) => a.network.localeCompare(b.network));

for (const hint of crawl?.contentHints ?? []) {
if (content.some((c) => c.kind === hint.kind && c.status === "found")) continue;
content.push({
kind: hint.kind,
url: hint.url,
status: "found",
count: 1,
note: `Linked from homepage as “${hint.label}”.`,
});
}

const foundKinds = new Set(content.filter((c) => c.status === "found").map((c) => c.kind));
const primaryMissing = new Set(["sitemap", "blog", "news", "press", "video", "rss"]);
const compactContent: ContentAsset[] = [];
for (const c of content) {
if (c.status === "found") {
compactContent.push(c);
continue;
}
if (!primaryMissing.has(c.kind) || foundKinds.has(c.kind)) continue;
if (compactContent.some((k) => k.kind === c.kind && k.status === "missing")) continue;
compactContent.push(c);
}
content.length = 0;
content.push(...compactContent);

for (const m of mentions.filter((x) => x.kind === "video")) {
if (videos.some((v) => mentionKey(v.url) === mentionKey(m.url))) continue;
videos.push({ url: m.url, source: m.source || "Video" });
}

const hasBlog = content.some((c) => (c.kind === "blog" || c.kind === "news") && c.status === "found") || articleUrls > 0;
const hasRss = content.some((c) => c.kind === "rss" && c.status === "found");
const hasPress = content.some((c) => c.kind === "press" && c.status === "found");
const linkedSocial = uniqueSocial.filter((s) => s.status === "linked" || s.status === "live");
const hasVideo = videos.length > 0 || content.some((c) => c.kind === "video" && c.status === "found");
const hasYt =
uniqueSocial.some((s) => s.network === "YouTube" && s.status !== "missing") || videos.some((v) => v.source === "YouTube");
const newsCount = mentions.filter((m) => m.kind === "news" || m.kind === "article" || m.kind === "blog").length;
const wikiCount = mentions.filter((m) => m.kind === "wiki").length;
const reviewCount = mentions.filter((m) => m.kind === "review" || m.kind === "directory").length;
const offsiteVideo = mentions.filter((m) => m.kind === "video").length;

const contentScore = clamp(
(hasBlog ? 40 : 0) +
(sitemapUrls > 0 ? 20 : 0) +
(articleUrls > 3 ? 20 : articleUrls > 0 ? 10 : 0) +
(hasRss ? 10 : 0) +
(hasPress ? 10 : 0),
);
const socialScore = clamp(linkedSocial.length * 12 + (crawl?.hasOg ? 8 : 0) + (crawl?.hasTwitter ? 6 : 0));
const videoScore = clamp((hasVideo ? 45 : 0) + (hasYt ? 25 : 0) + Math.min(videos.length, 6) * 5);
const mentionScore = clamp(newsCount * 6 + wikiCount * 18 + reviewCount * 8 + offsiteVideo * 8 + (searchedWeb ? 6 : 0));
const score = clamp(contentScore * 0.28 + socialScore * 0.22 + videoScore * 0.18 + mentionScore * 0.32);

const backlinks: BacklinkMove[] = [];
const topNews = mentions.find((m) => m.kind === "news" || m.kind === "article");
if (newsCount === 0) {
backlinks.push({
channel: "Earned media / article syndication",
why: "No indexed news or blog mentions turned up. AI overviews and Google have nothing independent to cite.",
action: "Place 2–3 third-person articles via M2 Digital’s 400+ outlet distribution, then index them on /press.",
priority: "high",
});
} else {
backlinks.push({
channel: "Build on existing coverage",
why: `${newsCount} off-site articles/news mentions found${topNews ? `, including ${topNews.source}` : ""}.`,
action: topNews
? `Pitch a follow-up or expert quote to ${topNews.source}, then link the piece from /press and Organization sameAs.`
: "Collect the URLs onto a /press page and use them as sameAs / citation proof.",
priority: "high",
});
}
if (!hasBlog) {
backlinks.push({
channel: "Owned blog / news",
why: "No article index to earn links into. Directories and press have nothing durable to point at.",
action: "Stand up /blog or /news and publish 4–6 location + service pages worth citing.",
priority: "high",
});
} else if (articleUrls < 4) {
backlinks.push({
channel: "Content depth",
why: `Sitemap only shows ${articleUrls} article-like URLs.`,
action: "Add FAQ and city-service posts so PR and partners have specific URLs to link.",
priority: "medium",
});
}
if (!hasYt) {
backlinks.push({
channel: "YouTube",
why: offsiteVideo
? "Third-party video exists, but no owned channel was confirmed."
: "No channel or embed found. Video is a second ranking property and a transcript for AEO.",
action: "Publish one 60–90s walkthrough, embed it, and add VideoObject schema.",
priority: "high",
});
}
if (wikiCount === 0) {
backlinks.push({
channel: "Wikipedia / Wikidata",
why: "No encyclopedia page matched the business name. Knowledge Panels often start here.",
action: "If notable (press, awards, multiple locations), draft a sourced article; otherwise skip and invest in news citations.",
priority: "low",
});
}
if (reviewCount === 0) {
backlinks.push({
channel: "Review sites",
why: "No Yelp / Tripadvisor / OpenTable listing surfaced in the scan.",
action: "Claim the listing, match NAP to the homepage, and add the URL to Organization sameAs.",
priority: "medium",
});
}
if (!uniqueSocial.some((s) => s.network === "Facebook" && s.status !== "missing")) {
backlinks.push({
channel: "Facebook Page",
why: "Not linked from the site. Facebook is still a citation and sameAs target.",
action: "Create or claim the page, add it to the footer, and put the URL in Organization sameAs.",
priority: "medium",
});
}
if (!uniqueSocial.some((s) => s.network === "Instagram" && s.status !== "missing")) {
backlinks.push({
channel: "Instagram",
why: "No Instagram on the homepage — local pack and AI recs often look for it.",
action: "Link the profile in the header/footer and keep NAP in the bio identical to the site.",
priority: "medium",
});
}
if (!uniqueSocial.some((s) => s.network === "TikTok" && s.status !== "missing")) {
backlinks.push({
channel: "TikTok",
why: "No TikTok profile confirmed. Short-form video is a discovery surface younger local searchers use.",
action: "If the niche is visual (food, retail, services), claim @handle and cross-link it.",
priority: "low",
});
}
if (!hasRss) {
backlinks.push({
channel: "RSS / Google News",
why: "No feed found. RSS is how aggregators and some LLMs discover new URLs.",
action: "Expose /feed or /rss.xml for the blog and submit it in Google Search Console.",
priority: "low",
});
}
backlinks.push({
channel: "Local associations",
why: "Chamber, tourism board, and industry directories pass topical links Google still counts.",
action: `Get listed with the ${target.location} chamber / tourism site and add the listing URL as a citation.`,
priority: "medium",
});

if (linked.length === 0) notes.push("Homepage has no social profile links — add them in the footer.");
if (!hasBlog) notes.push("No blog or news section detected on-site or in the sitemap.");
if (!hasVideo) notes.push("No YouTube/Vimeo embed or /videos index.");
if (sitemapUrls === 0) notes.push("Sitemap missing or empty.");
if (newsCount === 0) notes.push("No indexed news/articles found off-site for this name + city.");
if (wikiCount) notes.push("Wikipedia page matched — treat it as a citation, not a traffic score.");
notes.push(
searchedWeb
? "Live footprint: on-site crawl + Google News + Wikipedia + open-web search. Not a Semrush traffic, keyword, or Domain Authority database."
: "Live footprint: on-site crawl + Google News + Wikipedia. Open-web search was unavailable this run. Not a Semrush traffic or keyword database.",
);

return {
score,
contentScore,
socialScore,
videoScore,
mentionScore,
social: uniqueSocial,
content,
videos,
mentions,
sitemapUrls,
articleUrls,
backlinks,
notes,
searchedWeb,
};
}