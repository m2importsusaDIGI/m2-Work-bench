export const MODULES = ["schema", "local", "visibility", "leads", "outreach"] as const;
export type ModuleId = (typeof MODULES)[number];

export type Target = {
businessName: string;
websiteUrl: string;
location: string;
niche: string;
phone: string;
};

export type LogChannel =
| "queue"
| "crawl"
| "parse"
| "schema"
| "local"
| "visibility"
| "leads"
| "outreach"
| "report"
| "error";

export type LogLine = {
id: string;
t: string;
channel: LogChannel;
message: string;
};

export type SocialHit = {
network: string;
url: string;
};

export type ContentHint = {
kind: "blog" | "news" | "press" | "video" | "rss" | "podcast";
url: string;
label: string;
};

export type CrawlResult = {
ok: boolean;
error: string | null;
url: string;
finalUrl: string;
status: number;
elapsedMs: number;
bytes: number;
title: string;
description: string;
canonical: string | null;
language: string | null;
h1: string[];
h2: string[];
jsonLdTypes: string[];
jsonLdCount: number;
hasOg: boolean;
hasTwitter: boolean;
robots: string | null;
phones: string[];
emails: string[];
addresses: string[];
imageCount: number;
imagesMissingAlt: number;
internalLinks: number;
externalLinks: number;
gaps: string[];
socials: SocialHit[];
contentHints: ContentHint[];
videoUrls: string[];
};

export type SocialProfile = {
network: string;
url: string;
status: "linked" | "live" | "missing" | "unverified";
note: string;
};

export type ContentAsset = {
kind: string;
url: string;
status: "found" | "missing" | "empty";
count: number;
note: string;
};

export type BacklinkMove = {
channel: string;
why: string;
action: string;
priority: "high" | "medium" | "low";
};

export type WebMention = {
kind: "article" | "blog" | "news" | "video" | "review" | "wiki" | "directory" | "social" | "other";
title: string;
url: string;
source: string;
note: string;
};

export type VisibilityAudit = {
score: number;
contentScore: number;
socialScore: number;
videoScore: number;
mentionScore: number;
social: SocialProfile[];
content: ContentAsset[];
videos: { url: string; source: string }[];
mentions: WebMention[];
sitemapUrls: number;
articleUrls: number;
backlinks: BacklinkMove[];
notes: string[];
searchedWeb: boolean;
};

export const EMPTY_VISIBILITY: VisibilityAudit = {
score: 0,
contentScore: 0,
socialScore: 0,
videoScore: 0,
mentionScore: 0,
social: [],
content: [],
videos: [],
mentions: [],
sitemapUrls: 0,
articleUrls: 0,
backlinks: [],
notes: [],
searchedWeb: false,
};

export function visOf(v?: VisibilityAudit | null): VisibilityAudit {
return {
score: v?.score ?? 0,
contentScore: v?.contentScore ?? 0,
socialScore: v?.socialScore ?? 0,
videoScore: v?.videoScore ?? 0,
mentionScore: v?.mentionScore ?? 0,
social: v?.social ?? [],
content: v?.content ?? [],
videos: v?.videos ?? [],
mentions: v?.mentions ?? [],
sitemapUrls: v?.sitemapUrls ?? 0,
articleUrls: v?.articleUrls ?? 0,
backlinks: v?.backlinks ?? [],
notes: v?.notes ?? [],
searchedWeb: v?.searchedWeb ?? false,
};
}

export type Metrics = {
schema: number;
nap: number;
aeo: number;
local: number;
visibility: number;
overall: number;
};

export type SchemaBlock = {
type: string;
jsonld: string;
notes: string;
};

export type CitationRow = {
directory: string;
status: "likely-missing" | "inconsistent" | "present-unverified" | "recommended";
note: string;
};

export type Lead = {
name: string;
category: string;
city: string;
website: string;
phone: string;
maturity: number;
priority: "high" | "medium" | "low";
gaps: string[];
};

export type OutreachPack = {
emailSubject: string;
emailBody: string;
whatsapp: string;
followUps: { day: number; channel: string; body: string }[];
};

export type EngineResult = {
summary: string;
recommendations: string[];
scores: { before: Metrics; after: Metrics };
schema: {
existing: string[];
missing: string[];
blocks: SchemaBlock[];
};
local: {
nap: { name: string; address: string; phone: string; issues: string[] };
gbpDescription: string;
categories: { primary: string; additional: string[] };
citations: CitationRow[];
};
visibility: VisibilityAudit;
leads: Lead[];
leadQueries: string[];
outreach: OutreachPack;
usedAi: boolean;
};

export type EngineInput = {
target: Target;
modules: ModuleId[];
crawl: CrawlResult | null;
visibility: VisibilityAudit | null;
};

export type JobStatus = "queued" | "running" | "completed" | "failed";

export type Job = {
id: string;
target: Target;
modules: ModuleId[];
status: JobStatus;
logs: LogLine[];
createdAt: string;
startedAt: string | null;
completedAt: string | null;
crawl: CrawlResult | null;
visibility: VisibilityAudit | null;
result: EngineResult | null;
error: string | null;
};

export const PIPELINE_STAGES = ["prospecting", "contacted", "qualified", "won", "lost"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const STAGE_LABEL: Record<PipelineStage, string> = {
prospecting: "Prospecting",
contacted: "Contacted",
qualified: "Qualified",
won: "Won",
lost: "Lost",
};

export type Contact = {
id: string;
businessName: string;
contactName: string;
email: string;
phone: string;
websiteUrl: string;
location: string;
niche: string;
address: string;
socials: SocialHit[];
stage: PipelineStage;
notes: string;
sourceJobId: string | null;
createdAt: string;
updatedAt: string;
};

export type ProspectHit = {
placeId: string;
businessName: string;
websiteUrl: string;
phone: string;
address: string;
socials: SocialHit[];
};

export type ProspectSearchResult = {
ok: boolean;
error: string | null;
niche: string;
location: string;
results: ProspectHit[];
};

export type TaskChannel = "email" | "whatsapp" | "call" | "other";

export type Task = {
id: string;
contactId: string;
title: string;
body: string;
channel: TaskChannel;
dueAt: string;
done: boolean;
createdAt: string;
};