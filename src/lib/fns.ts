import { createServerFn } from "@tanstack/react-start";
import type { CrawlResult, EngineInput, EngineResult, ProspectSearchResult, Target, VisibilityAudit } from "./types";

export const crawlTarget = createServerFn({ method: "POST" })
.validator((input: { url: string }) => input)
.handler(async ({ data }): Promise<CrawlResult> => {
const { crawlUrl } = await import("./crawl.server");
return crawlUrl(data.url);
});

export const auditVisibility = createServerFn({ method: "POST" })
.validator((input: { target: Target; crawl: CrawlResult | null }) => input)
.handler(async ({ data }): Promise<VisibilityAudit> => {
const { probeVisibility } = await import("./visibility.server");
return probeVisibility(data);
});

export const runEngine = createServerFn({ method: "POST" })
.validator((input: EngineInput) => input)
.handler(async ({ data }): Promise<EngineResult> => {
const { runWorkEngine } = await import("./engine.server");
return runWorkEngine(data);
});

export const findProspects = createServerFn({ method: "POST" })
.validator((input: { niche: string; location: string }) => input)
.handler(async ({ data }): Promise<ProspectSearchResult> => {
const { searchProspects } = await import("./prospect.server");
return searchProspects(data);
});