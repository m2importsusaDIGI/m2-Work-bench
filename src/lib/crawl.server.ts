import * as cheerio from "cheerio";
import type { ContentHint, CrawlResult, SocialHit } from "./types";

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 12_000;

export const WORKBENCH_UA =
"M2Workbench/1.0 (+https://m2.digital; technical SEO audit; contact via M2 Digital Solutions LLC)";

export const FETCH_HEADERS = {
Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
"Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8",
"User-Agent": WORKBENCH_UA,
};

function blockedHost(host: string): boolean {
const h = host.toLowerCase().replace(/\.+$/, "");
if (
h === "localhost" ||
h.endsWith(".localhost") ||
h === "0.0.0.0" ||
h === "::1" ||
h === "metadata.google.internal" ||
h.endsWith(".internal") ||
h.endsWith(".local")
) {
return true;
}
if (h.startsWith("[") || h.includes(":")) return true;
const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/.exec(h);
if (ipv4) {
const p = h.split(".").map(Number);
const [a, b] = p;
if (a === 10 || a === 127 || a === 0) return true;
if (a === 169 && b === 254) return true;
if (a === 192 && b === 168) return true;
if (a === 172 && b >= 16 && b <= 31) return true;
}
return false;
}

export function publicUrl(raw: string): URL {
let u: URL;
try {
u = new URL(raw);
} catch {
throw new Error("Enter a full website URL, including https://");
}
if (u.protocol !== "http:" && u.protocol !== "https:") {
throw new Error("Only http and https URLs can be crawled.");
}
if (blockedHost(u.hostname)) {
throw new Error("That host cannot be crawled from this workbench.");
}
return u;
}

const PHONE_RE =
/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}|\+\d{2}\s?\d{2}\s?\d{4,5}[-\s]?\d{4}/g;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function unique(list: string[], max = 8): string[] {
const seen = new Set<string>();
const out: string[] = [];
for (const item of list) {
const t = item.replace(/\s+/g, " ").trim();
if (!t || t.length < 6) continue;
const key = t.toLowerCase();
if (seen.has(key)) continue;
seen.add(key);
out.push(t);
if (out.length >= max) break;
}
return out;
}

function jsonLdTypes(raw: string): string[] {
try {
const data = JSON.parse(raw) as unknown;
const types: string[] = [];
const walk = (node: unknown) => {
if (!node) return;
if (Array.isArray(node)) {
node.forEach(walk);
return;
}
if (typeof node === "object") {
const obj = node as Record<string, unknown>;
const t = obj["@type"];
if (typeof t === "string") types.push(t);
if (Array.isArray(t)) {
for (const x of t) if (typeof x === "string") types.push(x);
}
if (obj["@graph"]) walk(obj["@graph"]);
}
};
walk(data);
return unique(types, 20);
} catch {
return [];
}
}

export function classifySocial(href: string): SocialHit | null {
let u: URL;
try {
u = new URL(href);
} catch {
return null;
}
if (u.protocol !== "http:" && u.protocol !== "https:") return null;
const host = u.hostname.replace(/^www\./, "").toLowerCase();
const path = u.pathname.toLowerCase();
if (/\/(sharer|share|intent|dialog)\b/.test(path)) return null;
if (host === "facebook.com" || host === "fb.com" || host.endsWith(".facebook.com")) {
if (path === "/" || path === "/login" || path.startsWith("/share")) return null;
return { network: "Facebook", url: u.origin + u.pathname.replace(/\/$/, "") };
}
if (host === "instagram.com" || host.endsWith(".instagram.com")) {
if (path === "/" || path.startsWith("/accounts")) return null;
return { network: "Instagram", url: u.origin + u.pathname.replace(/\/$/, "") };
}
if (host === "linkedin.com" || host.endsWith(".linkedin.com")) {
if (!path.includes("/company") && !path.includes("/in/") && !path.includes("/school")) return null;
return { network: "LinkedIn", url: u.origin + u.pathname.replace(/\/$/, "") };
}
if (host === "x.com" || host === "twitter.com" || host === "mobile.twitter.com") {
if (path === "/" || path.startsWith("/intent") || path.startsWith("/share") || path.startsWith("/i/"))
return null;
return { network: "X", url: `https://x.com${u.pathname.replace(/\/$/, "")}` };
}
if (host === "youtube.com" || host === "youtu.be" || host === "m.youtube.com") {
if (path.startsWith("/watch") || host === "youtu.be") return { network: "YouTube", url: href.split("&")[0] };
if (path.startsWith("/@") || path.startsWith("/channel") || path.startsWith("/c/") || path.startsWith("/user")) {
return { network: "YouTube", url: u.origin + u.pathname.replace(/\/$/, "") };
}
return null;
}
if (host === "tiktok.com" || host.endsWith(".tiktok.com")) {
if (!path.startsWith("/@")) return null;
return { network: "TikTok", url: u.origin + u.pathname.replace(/\/$/, "") };
}
if (host === "pinterest.com" || host.endsWith(".pinterest.com")) {
return { network: "Pinterest", url: u.origin + u.pathname.replace(/\/$/, "") };
}
if (host === "yelp.com" || host.endsWith(".yelp.com")) {
if (!path.includes("/biz/")) return null;
return { network: "Yelp", url: u.origin + u.pathname.replace(/\/$/, "") };
}
if (host.includes("tripadvisor")) {
return { network: "Tripadvisor", url: u.origin + u.pathname.replace(/\/$/, "") };
}
if (host === "threads.net") {
return { network: "Threads", url: u.origin + u.pathname.replace(/\/$/, "") };
}
if (host === "vimeo.com") {
return { network: "Vimeo", url: u.origin + u.pathname.replace(/\/$/, "") };
}
return null;
}

function classifyContent(href: string, label: string): ContentHint | null {
let u: URL;
try {
u = new URL(href);
} catch {
return null;
}
const path = (u.pathname + u.search).toLowerCase();
const blob = `${path} ${label}`.toLowerCase();
if (/\brss\b|\/feed|atom\.xml/.test(blob)) return { kind: "rss", url: u.toString(), label: label || "RSS" };
if (/podcast/.test(blob)) return { kind: "podcast", url: u.toString(), label: label || "Podcast" };
if (/\/videos?|youtube|vimeo/.test(blob)) return { kind: "video", url: u.toString(), label: label || "Video" };
if (/\/press|newsroom|media-kit/.test(blob)) return { kind: "press", url: u.toString(), label: label || "Press" };
if (/\/news|\/noticias/.test(blob)) return { kind: "news", url: u.toString(), label: label || "News" };
if (/\/blog|\/articles?|\/journal|\/stories|\/insights/.test(blob))
return { kind: "blog", url: u.toString(), label: label || "Blog" };
return null;
}

function emptyCrawl(url: string, error: string): CrawlResult {
return {
ok: false,
error,
url,
finalUrl: url,
status: 0,
elapsedMs: 0,
bytes: 0,
title: "",
description: "",
canonical: null,
language: null,
h1: [],
h2: [],
jsonLdTypes: [],
jsonLdCount: 0,
hasOg: false,
hasTwitter: false,
robots: null,
phones: [],
emails: [],
addresses: [],
imageCount: 0,
imagesMissingAlt: 0,
internalLinks: 0,
externalLinks: 0,
gaps: ["Site could not be crawled — engine will use the intake fields only."],
socials: [],
contentHints: [],
videoUrls: [],
};
}

export async function crawlUrl(rawUrl: string): Promise<CrawlResult> {
let url: URL;
try {
url = publicUrl(rawUrl);
} catch (err) {
return emptyCrawl(rawUrl, err instanceof Error ? err.message : "Invalid URL");
}

const started = Date.now();
let res: Response;
try {
res = await fetch(url.toString(), {
method: "GET",
redirect: "follow",
signal: AbortSignal.timeout(TIMEOUT_MS),
headers: FETCH_HEADERS,
});
} catch (err) {
const msg =
err instanceof Error && err.name === "TimeoutError"
? "Crawl timed out after 12s."
: err instanceof Error
? err.message
: "Network error while crawling.";
return { ...emptyCrawl(url.toString(), msg), elapsedMs: Date.now() - started };
}

const elapsedMs = Date.now() - started;
const buf = await res.arrayBuffer();
const bytes = buf.byteLength;
if (bytes > MAX_BYTES) {
return {
...emptyCrawl(url.toString(), "Response was larger than 1.5 MB — skipped parse."),
status: res.status,
elapsedMs,
bytes,
finalUrl: res.url || url.toString(),
};
}

const html = new TextDecoder("utf-8", { fatal: false }).decode(buf);
const contentType = res.headers.get("content-type") ?? "";
if (!/html|xml|text\/plain/i.test(contentType) && !html.includes("<html") && !html.includes("<HTML")) {
return {
...emptyCrawl(url.toString(), `Unexpected content type (${contentType || "unknown"}).`),
status: res.status,
elapsedMs,
bytes,
finalUrl: res.url || url.toString(),
};
}

const $ = cheerio.load(html);

const jsonNodes = $('script[type="application/ld+json"]');
const types: string[] = [];
jsonNodes.each((_, el) => {
const raw = $(el).contents().text();
types.push(...jsonLdTypes(raw));
});
const jsonLdCount = jsonNodes.length;

const origin = new URL(res.url || url.toString()).origin;
const socials: SocialHit[] = [];
const socialSeen = new Set<string>();
const contentHints: ContentHint[] = [];
const contentSeen = new Set<string>();
const videoUrls: string[] = [];
const videoSeen = new Set<string>();

function addVideo(raw: string) {
try {
const abs = new URL(raw, origin).toString().split("&")[0];
if (videoSeen.has(abs)) return;
videoSeen.add(abs);
videoUrls.push(abs);
} catch {
/* ignore */
}
}

$("a[href]").each((_, el) => {
const href = $(el).attr("href") ?? "";
if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
let abs: URL;
try {
abs = new URL(href, origin);
} catch {
return;
}
const social = classifySocial(abs.toString());
if (social && !socialSeen.has(social.network + social.url)) {
socialSeen.add(social.network + social.url);
socials.push(social);
}
const label = $(el).text().replace(/\s+/g, " ").trim();
const hint = classifyContent(abs.toString(), label);
if (hint && !contentSeen.has(hint.kind + hint.url)) {
contentSeen.add(hint.kind + hint.url);
contentHints.push(hint);
}
if (/youtube\.com|youtu\.be|vimeo\.com/.test(abs.hostname)) addVideo(abs.toString());
});

$("iframe[src], embed[src], video source[src], link[type='application/rss+xml'], link[type='application/atom+xml']").each(
(_, el) => {
const src = $(el).attr("src") || $(el).attr("href") || "";
if (!src) return;
try {
const abs = new URL(src, origin);
if (/youtube\.com|youtu\.be|vimeo\.com/.test(abs.hostname)) addVideo(abs.toString());
const type = ($(el).attr("type") || "").toLowerCase();
if (type.includes("rss") || type.includes("atom") || /rss|atom|feed/.test(abs.pathname)) {
const hint: ContentHint = { kind: "rss", url: abs.toString(), label: "Feed" };
if (!contentSeen.has(hint.kind + hint.url)) {
contentSeen.add(hint.kind + hint.url);
contentHints.push(hint);
}
}
} catch {
/* ignore */
}
},
);

$("script, style, noscript, svg").remove();

const title =
$("title").first().text().trim() ||
$('meta[property="og:title"]').attr("content")?.trim() ||
"";
const description =
$('meta[name="description"]').attr("content")?.trim() ||
$('meta[property="og:description"]').attr("content")?.trim() ||
"";
const canonical = $('link[rel="canonical"]').attr("href")?.trim() || null;
const language = $("html").attr("lang")?.trim() || null;
const robots = $('meta[name="robots"]').attr("content")?.trim() || null;
const hasOg = $('meta[property^="og:"]').length > 0;
const hasTwitter = $('meta[name^="twitter:"]').length > 0;

const h1 = unique(
$("h1")
.toArray()
.map((el) => $(el).text()),
6,
);
const h2 = unique(
$("h2")
.toArray()
.map((el) => $(el).text()),
10,
);

const images = $("img");
let imagesMissingAlt = 0;
images.each((_, el) => {
const alt = $(el).attr("alt");
if (alt === undefined || alt.trim() === "") imagesMissingAlt += 1;
});

let internalLinks = 0;
let externalLinks = 0;
$("a[href]").each((_, el) => {
const href = $(el).attr("href") ?? "";
if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
try {
const abs = new URL(href, origin);
if (abs.origin === origin) internalLinks += 1;
else if (abs.protocol === "http:" || abs.protocol === "https:") externalLinks += 1;
} catch {
/* ignore */
}
});

const textSample = $("body").text().replace(/\s+/g, " ").slice(0, 20000);
const phones = unique(
[
...((textSample.match(PHONE_RE) as string[] | null) ?? []),
...$('a[href^="tel:"]')
.toArray()
.map((el) => $(el).attr("href")?.replace(/^tel:/, "") ?? ""),
],
6,
);
const emails = unique(
[
...((textSample.match(EMAIL_RE) as string[] | null) ?? []),
...$('a[href^="mailto:"]')
.toArray()
.map((el) => $(el).attr("href")?.replace(/^mailto:/, "").split("?")[0] ?? ""),
],
6,
);

const addresses = unique(
$("[itemprop='streetAddress'], [itemprop='address']")
.toArray()
.map((el) => $(el).text()),
4,
);

const typeSet = new Set(types.map((t) => t.toLowerCase()));
const gaps: string[] = [];
if (![...typeSet].some((t) => t.includes("localbusiness") || t.includes("restaurant") || t.includes("store"))) {
gaps.push("Missing LocalBusiness (or subtype) JSON-LD");
}
if (![...typeSet].some((t) => t.includes("service") || t.includes("product"))) {
gaps.push("No Service or Product schema");
}
if (![...typeSet].some((t) => t.includes("organization"))) {
gaps.push("No Organization schema");
}
if (![...typeSet].some((t) => t.includes("faq"))) {
gaps.push("No FAQPage schema for AI-answer engines");
}
if (!description) gaps.push("Missing meta description");
if (!hasOg) gaps.push("Missing Open Graph tags");
if (phones.length === 0) gaps.push("No phone number detected on the homepage");
if (addresses.length === 0) gaps.push("No structured address detected");
if (imagesMissingAlt > 0) gaps.push(`${imagesMissingAlt} images missing alt text`);
if (!res.ok) gaps.push(`Homepage returned HTTP ${res.status}`);
if (socials.length === 0) gaps.push("No social profiles linked from the homepage");
if (contentHints.filter((c) => c.kind === "blog" || c.kind === "news").length === 0) {
gaps.push("No blog or news index linked from the homepage");
}
if (videoUrls.length === 0) gaps.push("No YouTube or Vimeo video detected");

return {
ok: res.ok,
error: res.ok ? null : `HTTP ${res.status}`,
url: url.toString(),
finalUrl: res.url || url.toString(),
status: res.status,
elapsedMs,
bytes,
title,
description,
canonical,
language,
h1,
h2,
jsonLdTypes: unique(types, 16),
jsonLdCount,
hasOg,
hasTwitter,
robots,
phones,
emails,
addresses,
imageCount: images.length,
imagesMissingAlt,
internalLinks,
externalLinks,
gaps,
socials: socials.slice(0, 16),
contentHints: contentHints.slice(0, 16),
videoUrls: videoUrls.slice(0, 12),
};
}