import { projectedAfter, scoreFromCrawl } from "./score";
import type {
CitationRow,
CrawlResult,
EngineInput,
EngineResult,
Lead,
ModuleId,
OutreachPack,
SchemaBlock,
Target,
} from "./types";
import { EMPTY_VISIBILITY } from "./types";

const DIRECTORY_SEED: Array<{ directory: string; note: string }> = [
{ directory: "Google Business Profile", note: "Primary local pack listing — verify NAP and categories." },
{ directory: "Apple Maps / Maps Connect", note: "Feeds Siri and Apple Maps local results." },
{ directory: "Bing Places", note: "Still used by Copilot and some AI overviews." },
{ directory: "Yelp", note: "Common citation; watch for duplicate or stale NAP." },
{ directory: "Facebook / Instagram", note: "sameAs target for Organization schema." },
{ directory: "BBB", note: "Trust citation if the vertical qualifies." },
{ directory: "Yellow Pages", note: "Legacy citation network; fix or suppress duplicates." },
{ directory: "Foursquare / Factual", note: "Upstream data vendor for several publishers." },
];

function json(obj: unknown) {
return JSON.stringify(
obj,
(_k, v) => (v === undefined || v === "" ? undefined : v),
2,
);
}

function countryFromLocation(location: string): string {
if (/bras[ií]l|brazil|s[aã]o paulo|alphaville|sp\b/i.test(location)) return "BR";
if (/dmv|washington|maryland|virginia|\bdc\b|united states|\busa\b/i.test(location)) return "US";
return "US";
}

function businessType(target: Target, crawl: CrawlResult | null): string {
const blob = `${target.niche} ${target.businessName} ${crawl?.title ?? ""}`.toLowerCase();
if (/restaurant|bistro|diner|grill|cafe|coffee|chili|farm-to-table/.test(blob)) return "Restaurant";
if (/dentist|dental|clinic|medico|sa[uú]de|health/.test(blob)) return "MedicalBusiness";
if (/plumb|hvac|electric|roof|contractor|repair/.test(blob)) return "HomeAndConstructionBusiness";
if (/attorney|law|legal/.test(blob)) return "LegalService";
if (/hotel|inn|lodge/.test(blob)) return "LodgingBusiness";
if (/salon|spa|barber/.test(blob)) return "HealthAndBeautyBusiness";
if (/auto|car |mechanic/.test(blob)) return "AutomotiveBusiness";
return "LocalBusiness";
}

function buildSchemaBlocks(target: Target, crawl: CrawlResult | null): SchemaBlock[] {
const type = businessType(target, crawl);
const phone = target.phone || crawl?.phones[0] || "";
const email = crawl?.emails[0] || "";
const url = crawl?.finalUrl || target.websiteUrl;
const locality = target.location.split(",")[0]?.trim() || target.location;
const country = countryFromLocation(target.location);
const desc =
crawl?.description ||
`${target.businessName} is a ${target.niche || "local business"} serving ${target.location}.`;

const local = {
"@context": "https://schema.org",
"@type": type,
name: target.businessName,
url,
description: desc,
telephone: phone || undefined,
email: email || undefined,
address: {
"@type": "PostalAddress",
addressLocality: locality,
addressRegion: target.location,
addressCountry: country,
streetAddress: crawl?.addresses[0] || undefined,
},
areaServed: target.location,
priceRange: "$$",
};

const organization = {
"@context": "https://schema.org",
"@type": "Organization",
name: target.businessName,
url,
telephone: phone || undefined,
email: email || undefined,
sameAs: [] as string[],
};

const serviceName = target.niche || crawl?.h1[0] || `${target.businessName} services`;
const service = {
"@context": "https://schema.org",
"@type": "Service",
name: serviceName,
serviceType: target.niche || serviceName,
provider: {
"@type": "LocalBusiness",
name: target.businessName,
url,
},
areaServed: target.location,
description: desc,
};

const faqMain = crawl?.h2.slice(0, 4) ?? [];
const faqQs =
faqMain.length >= 2
? faqMain.map((h) => ({
"@type": "Question",
name: h,
acceptedAnswer: {
"@type": "Answer",
text: `${target.businessName} can help with this in ${target.location}. See ${url} for details.`,
},
}))
: [
{
"@type": "Question",
name: `Where is ${target.businessName} located?`,
acceptedAnswer: {
"@type": "Answer",
text: `${target.businessName} serves ${target.location}. Visit ${url}.`,
},
},
{
"@type": "Question",
name: `What does ${target.businessName} offer?`,
acceptedAnswer: {
"@type": "Answer",
text: desc,
},
},
];

const faq = {
"@context": "https://schema.org",
"@type": "FAQPage",
mainEntity: faqQs,
};

return [
{
type,
jsonld: json(local),
notes: "Primary entity for Google, Maps, and LLM business recommendations. Paste in the homepage <head>.",
},
{
type: "Organization",
jsonld: json(organization),
notes: "Supports knowledge-panel and sameAs identity. Add social profile URLs to sameAs.",
},
{
type: "Service",
jsonld: json(service),
notes: "Helps AI search engines describe what the business actually sells.",
},
{
type: "FAQPage",
jsonld: json(faq),
notes: "Answer-engine bait. Replace sample answers with the client's real copy before publish.",
},
];
}

function citationsFromCrawl(crawl: CrawlResult | null): CitationRow[] {
return DIRECTORY_SEED.map((d, i) => {
const missingPhone = !crawl?.phones.length;
const missingAddr = !crawl?.addresses.length;
if (i === 0 && (missingPhone || missingAddr)) {
return {
directory: d.directory,
status: "inconsistent" as const,
note: `${d.note} Homepage NAP is incomplete.`,
};
}
return {
directory: d.directory,
status: "recommended" as const,
note: d.note,
};
});
}

function fallbackGbp(target: Target, crawl: CrawlResult | null): string {
const services = (crawl?.h2.slice(0, 3) ?? []).join(", ");
const extra = services ? ` Known for ${services}.` : "";
return `${target.businessName} is a ${target.niche || "local business"} serving ${target.location}. ${
crawl?.description || `We help nearby customers with straightforward, reliable service.`
}${extra} Visit us online or call to get started.`.slice(0, 740);
}

function fallbackOutreach(target: Target, crawl: CrawlResult | null): OutreachPack {
const gaps = crawl?.gaps.slice(0, 3).join("; ") || "thin schema and incomplete local signals";
const url = target.websiteUrl;
return {
emailSubject: `${target.businessName}: 3 search gaps we already fixed on paper`,
emailBody: `Hi ${target.businessName} team,\n\nI audited ${url} against how Google and AI search engines (ChatGPT, Gemini, Perplexity) recommend businesses in ${target.location}.\n\nWhat stood out:\n- ${gaps}\n\nWe already drafted LocalBusiness JSON-LD, a Google Business Profile description, and a short list of nearby prospects in your category. Happy to walk through the before/after in 15 minutes.\n\n— M2 Digital Solutions LLC`,
whatsapp: `Hi, this is M2 Digital. We ran a live audit on ${url} for ${target.location}. Biggest gap: ${crawl?.gaps[0] || "missing LocalBusiness schema"}. I have the JSON-LD and a GBP draft ready if you want it.`,
followUps: [
{
day: 3,
channel: "email",
body: `Following up on the ${target.businessName} audit — the schema draft is sitting in the report if you'd like me to send the file.`,
},
{
day: 7,
channel: "whatsapp",
body: `Quick bump: still seeing the same AI-search gaps on ${url}. Want the Work Completion Report?`,
},
],
};
}

function fallbackLeads(target: Target): { leads: Lead[]; queries: string[] } {
const queries = [
`${target.niche || target.businessName} near ${target.location}`,
`${target.niche || "local business"} ${target.location} site:.com`,
`${target.location} contractors OR restaurants OR clinics -job -salary`,
];
return { leads: [], queries };
}

function assembleFallback(input: EngineInput, usedAi: boolean, extra?: Partial<EngineResult>): EngineResult {
const { target, crawl, modules } = input;
const before = scoreFromCrawl(crawl, target, input.visibility);
const after = projectedAfter(before, modules);
const existing = crawl?.jsonLdTypes ?? [];
const blocks = buildSchemaBlocks(target, crawl);
const missing = blocks.map((b) => b.type).filter((t) => !existing.some((e) => e.toLowerCase().includes(t.toLowerCase())));
const { leads, queries } = fallbackLeads(target);
const phone = target.phone || crawl?.phones[0] || "";
const address = crawl?.addresses[0] || target.location;
const issues: string[] = [];
if (!phone) issues.push("Phone not found on homepage");
if (!crawl?.addresses.length) issues.push("Street address not marked up");
if (crawl && crawl.phones.length > 1) issues.push("Multiple phone formats detected");

const vis = input.visibility;
const mentionN = vis?.mentions?.length ?? 0;
const mentionBit = vis
? mentionN
? ` Off-site scan found ${mentionN} mentions to work as citations.`
: " Off-site scan found no indexed articles or videos — a syndication opening."
: "";

const base: EngineResult = {
summary:
extra?.summary ||
`${target.businessName} was audited from ${crawl?.ok ? "a live homepage crawl" : "intake fields only"}. ${
missing.length
? `Primary gaps: ${missing.slice(0, 3).join(", ")}.`
: "Core schema types are present and were tightened."
}${mentionBit}`,
recommendations:
extra?.recommendations ||
[
"Paste the LocalBusiness JSON-LD into the homepage head (or GTM).",
"Align Google Business Profile NAP with the homepage exactly.",
"Add FAQ copy the business actually uses before publishing FAQPage schema.",
...(input.visibility && input.visibility.backlinks[0]
? [input.visibility.backlinks[0].action]
: ["Verify every prospect before outreach — candidates are starting points, not a CRM."]),
],
scores: { before, after },
schema: { existing, missing, blocks },
local: {
nap: { name: target.businessName, address, phone, issues },
gbpDescription: fallbackGbp(target, crawl),
categories: {
primary: target.niche || "Local Business",
additional: [target.location.split(",")[0] || target.location, "Service establishment"],
},
citations: citationsFromCrawl(crawl),
},
leads: extra?.leads ?? leads,
leadQueries: extra?.leadQueries ?? queries,
outreach: extra?.outreach ?? fallbackOutreach(target, crawl),
visibility: extra?.visibility ?? input.visibility ?? EMPTY_VISIBILITY,
usedAi,
};
return {
...base,
...extra,
usedAi,
scores: { before, after },
schema: extra?.schema ?? base.schema,
visibility: extra?.visibility ?? input.visibility ?? EMPTY_VISIBILITY,
};
}

function normalizeLeads(raw: unknown): Lead[] {
if (!Array.isArray(raw)) return [];
return raw.slice(0, 12).map((item) => {
const l = (item ?? {}) as Record<string, unknown>;
const n = typeof l.maturity === "number" ? l.maturity : Number.parseInt(String(l.maturity ?? ""), 10);
const gaps = Array.isArray(l.gaps)
? l.gaps.map(String)
: String(l.gaps || "")
.split(/[,;]/)
.map((s) => s.trim())
.filter(Boolean);
const p = l.priority;
return {
name: String(l.name || "Unnamed"),
category: String(l.category || ""),
city: String(l.city || ""),
website: String(l.website || ""),
phone: String(l.phone || ""),
maturity: Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 45,
priority: p === "high" || p === "low" ? p : "medium",
gaps,
};
});
}

function parseModelJson(text: string): Partial<EngineResult> | null {
const trimmed = text.trim();
const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
const raw = fence ? fence[1] : trimmed;
const start = raw.indexOf("{");
const end = raw.lastIndexOf("}");
if (start === -1 || end === -1) return null;
try {
return JSON.parse(raw.slice(start, end + 1)) as Partial<EngineResult>;
} catch {
return null;
}
}

export async function runWorkEngine(input: EngineInput): Promise<EngineResult> {
const apiKey = process.env.XAI_API_KEY;
const fallback = assembleFallback(input, false);
if (!apiKey) return fallback;

const { target, crawl, modules } = input;
const moduleList = modules.join(", ");
const crawlBlob = crawl
? {
title: crawl.title,
description: (crawl.description || "").slice(0, 180),
h1: crawl.h1.slice(0, 3),
types: crawl.jsonLdTypes,
phones: crawl.phones.slice(0, 2),
gaps: crawl.gaps.slice(0, 4),
url: crawl.finalUrl,
}
: null;

const prompt = `M2 Digital JSON only.
{"summary":"2 sentences + crawl gaps","recommendations":["4 actions"],"local":{"nap":{"name":"","address":"","phone":"","issues":[]},"gbpDescription":"<500 chars","categories":{"primary":"","additional":[]},"citations":[{"directory":"Google Business Profile","status":"recommended","note":""}]},"leads":[{"name":"independent local, not a chain","category":"","city":"","website":"","phone":"","maturity":40,"priority":"high","gaps":[]}],"leadQueries":["query"],"outreach": {"emailSubject":"","emailBody":"<120 words, M2 Digital Solutions LLC, 2 gaps","whatsapp":"","followUps":[{"day":3,"channel":"email","body":""},{"day":7,"channel":"whatsapp","body":""}]}}
Exactly 6 leads, same niche+location.
Modules: ${moduleList}
${JSON.stringify({ target, crawl: crawlBlob })}`;

try {
const res = await fetch("https://api.x.ai/v1/chat/completions", {
method: "POST",
headers: {
"Content-Type": "application/json",
Authorization: `Bearer ${apiKey}`,
},
signal: AbortSignal.timeout(50_000),
body: JSON.stringify({
model: "grok-4.5",
temperature: 0.4,
max_tokens: 1100,
response_format: { type: "json_object" },
messages: [
{
role: "system",
content: "Return only a JSON object for an agency workbench.",
},
{ role: "user", content: prompt },
],
}),
});
if (!res.ok) {
console.error("[m2-engine] xAI HTTP", res.status);
return fallback;
}
const body = (await res.json()) as {
choices?: { message?: { content?: string } }[];
};
const text = body.choices?.[0]?.message?.content ?? "";
const parsed = parseModelJson(text);
if (!parsed) {
console.error("[m2-engine] JSON parse failed", text.slice(0, 180));
return fallback;
}

const merged = assembleFallback(input, true, {
summary: parsed.summary,
recommendations: parsed.recommendations,
schema: fallback.schema,
local: parsed.local
? {
nap: {
name: parsed.local.nap?.name || target.businessName,
address: parsed.local.nap?.address || fallback.local.nap.address,
phone: parsed.local.nap?.phone || fallback.local.nap.phone,
issues: parsed.local.nap?.issues ?? fallback.local.nap.issues,
},
gbpDescription: parsed.local.gbpDescription || fallback.local.gbpDescription,
categories: parsed.local.categories || fallback.local.categories,
citations:
parsed.local.citations && parsed.local.citations.length
? parsed.local.citations
: fallback.local.citations,
}
: fallback.local,
leads: normalizeLeads(parsed.leads).length ? normalizeLeads(parsed.leads) : fallback.leads,
leadQueries: parsed.leadQueries ?? fallback.leadQueries,
outreach: parsed.outreach ?? fallback.outreach,
});
return { ...merged, usedAi: true };
} catch (err) {
console.error("[m2-engine]", err instanceof Error ? err.message : err);
return fallback;
}
}

export type { ModuleId };