import { clamp } from "./utils";
import type { CrawlResult, Metrics, Target, VisibilityAudit } from "./types";

export function scoreFromCrawl(
crawl: CrawlResult | null,
target: Target,
visibility: VisibilityAudit | null = null,
): Metrics {
if (!crawl || !crawl.status) {
const nap = clamp(
(target.businessName ? 30 : 0) + (target.phone ? 35 : 0) + (target.location ? 20 : 0),
);
return {
schema: 8,
nap,
aeo: 10,
local: clamp(nap * 0.6),
visibility: visibility?.score ?? 6,
overall: clamp((8 + nap + 10 + nap * 0.6 + 6) / 5),
};
}

const types = crawl.jsonLdTypes.map((t) => t.toLowerCase());
let schema = 12;
if (types.some((t) => t.includes("localbusiness") || t.includes("restaurant") || t.includes("store"))) schema += 38;
if (types.some((t) => t.includes("organization"))) schema += 14;
if (types.some((t) => t.includes("service") || t.includes("product"))) schema += 16;
if (types.some((t) => t.includes("faq"))) schema += 12;
if (crawl.jsonLdCount === 0) schema = Math.min(schema, 14);

const nap = clamp(
(target.businessName || crawl.title ? 20 : 0) +
(crawl.phones.length || target.phone ? 35 : 0) +
(crawl.addresses.length ? 30 : target.location ? 12 : 0) +
(crawl.emails.length ? 10 : 0),
);

const aeo = clamp(
(crawl.description ? 22 : 0) +
(crawl.hasOg ? 14 : 0) +
(types.some((t) => t.includes("faq")) ? 24 : 0) +
(schema > 40 ? 20 : 8) +
(crawl.h1.length ? 10 : 0),
);

const local = clamp(
nap * 0.55 +
(crawl.hasOg ? 10 : 0) +
(types.some((t) => t.includes("localbusiness")) ? 22 : 0) +
(target.location ? 8 : 0),
);

const visQuick = clamp(
(crawl.socials?.length ?? 0) * 12 +
(crawl.contentHints?.length ? 18 : 0) +
(crawl.videoUrls?.length ? 22 : 0) +
(crawl.hasOg ? 8 : 0),
);
const visibilityScore = visibility?.score ?? visQuick;

const overall = clamp(
schema * 0.24 + nap * 0.18 + aeo * 0.18 + local * 0.18 + visibilityScore * 0.22,
);
return { schema: clamp(schema), nap, aeo, local, visibility: visibilityScore, overall };
}

export function projectedAfter(before: Metrics, modules: string[]): Metrics {
const bump = (key: keyof Metrics, n: number) =>
modules.length ? clamp(before[key] + n) : before[key];
const schema = modules.includes("schema") ? bump("schema", 48) : before.schema;
const nap = modules.includes("local") ? bump("nap", 28) : before.nap;
const local = modules.includes("local") ? bump("local", 32) : before.local;
const aeo = modules.includes("schema") ? bump("aeo", 36) : before.aeo;
const visibility = modules.includes("visibility") ? bump("visibility", 34) : before.visibility;
return {
schema,
nap,
aeo,
local,
visibility,
overall: clamp(schema * 0.24 + nap * 0.18 + aeo * 0.18 + local * 0.18 + visibility * 0.22),
};
}