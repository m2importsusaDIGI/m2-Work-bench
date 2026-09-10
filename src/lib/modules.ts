import type { ModuleId } from "./types";

export const MODULE_META: Record<
ModuleId,
{ title: string; blurb: string; log: string }
> = {
schema: {
title: "AI Search Fixer",
blurb:
"Crawls the site, reads existing JSON-LD, and writes LocalBusiness, Service, and Organization markup LLMs can cite.",
log: "Injecting LocalBusiness schema",
},
local: {
title: "Local SEO & Citations",
blurb:
"Extracts NAP, flags inconsistencies, and drafts a Google Business Profile description plus category tags.",
log: "Auditing NAP and citation footprint",
},
visibility: {
title: "Visibility & Social",
blurb:
"Scans news, blogs, videos, Wikipedia, reviews, and socials — then lists backlink moves. A Semrush-style footprint, not a traffic guess.",
log: "Scanning content, social, and web mentions",
},
leads: {
title: "Lead Generation",
blurb:
"Builds a geo-targeted prospect list in the same niche, scored by digital maturity, ready as CSV.",
log: "Scoring local prospect candidates",
},
outreach: {
title: "Outreach Pack",
blurb:
"Writes a personalized email, WhatsApp script, and follow-ups that name the exact audit gaps.",
log: "Drafting outreach from audit gaps",
},
};

export const PRESETS: Array<{
label: string;
businessName: string;
websiteUrl: string;
location: string;
niche: string;
phone: string;
}> = [
{
label: "DC restaurant",
businessName: "Founding Farmers",
websiteUrl: "https://www.wearefoundingfarmers.com",
location: "Washington, DC / DMV",
niche: "Farm-to-table restaurant",
phone: "",
},
{
label: "DC landmark eatery",
businessName: "Ben's Chili Bowl",
websiteUrl: "https://benschilibowl.com",
location: "Washington, DC",
niche: "Casual restaurant",
phone: "",
},
];