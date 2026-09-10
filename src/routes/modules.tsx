import { createFileRoute, Link } from "@tanstack/react-router";
import { MODULE_META } from "@/lib/modules";
import { MODULES } from "@/lib/types";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/modules")({ component: ModulesPage });

const DETAIL: Record<string, string[]> = {
schema: [
"Fetches the live homepage (static HTML) and reads JSON-LD, Open Graph, and NAP tokens.",
"Flags missing LocalBusiness, Service, Organization, and FAQPage.",
"Writes paste-ready JSON-LD tailored to the business name, niche, and location.",
"Exports a .jsonld file for GTM or the site <head>.",
],
local: [
"Compares extracted name, address, and phone against the intake fields.",
"Drafts a Google Business Profile description (under 750 characters).",
"Suggests a primary category plus supporting tags.",
"Produces a citation checklist for GBP, Apple, Bing, Yelp, and others.",
],
visibility: [
"Reads homepage social links, YouTube/Vimeo embeds, blog/news/press URLs, and RSS.",
"Fetches sitemap.xml and counts article-like URLs; probes Facebook, Instagram, LinkedIn, X, YouTube, TikTok.",
"Searches Google News, Wikipedia, and the open web for off-site articles, videos, and reviews to build backlinks from.",
"Outputs a Semrush-style domain overview (mentions / on-site / social / video) plus backlink moves. Not a traffic or keyword database.",
],
leads: [
"Targets the same niche and geo as the engagement.",
"Scores digital maturity (schema, GBP, site quality) so outreach goes to the weakest first.",
"Exports CSV. Candidates are starting points — verify before you send.",
"If directory APIs are offline, stores the analyst search queries instead of inventing a fake scrape.",
],
outreach: [
"Email and WhatsApp copy that names the exact crawl gaps.",
"Follow-ups at day 3 and day 7.",
"Voice is M2 Digital Solutions LLC — third person, proof-of-work, no fluff.",
"Copy-to-clipboard and .txt export for the SDR queue.",
],
};

function ModulesPage() {
return (
<div className="mx-auto max-w-5xl">
<p className="text-xs uppercase tracking-[0.16em] text-muted">Engine</p>
<h1 className="font-display text-3xl md:text-4xl tracking-tight mt-1">Modules</h1>
<p className="mt-2 text-muted text-sm max-w-xl">
Each module is a worker. Toggle them on the dashboard, then watch the log as they run.
</p>

<Link
to="/handoff"
className="mt-6 block rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)] transition-[box-shadow]"
>
<p className="text-xs uppercase tracking-[0.16em] text-muted">Handoff</p>
<h2 className="font-display text-2xl tracking-tight mt-1">Copy source for Claude</h2>
<p className="mt-2 text-sm text-muted leading-6">
Full app source in one tap. Paste into another AI to rebuild this workbench.
</p>
</Link>

<div className="mt-8 grid gap-4 md:grid-cols-2">
{MODULES.map((id) => (
<article key={id} className="rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)]">
<h2 className="font-display text-2xl tracking-tight">{MODULE_META[id].title}</h2>
<p className="mt-2 text-sm text-muted leading-6">{MODULE_META[id].blurb}</p>
<ul className="mt-4 space-y-2">
{DETAIL[id].map((line) => (
<li key={line} className="text-sm leading-6 pl-4 border-l border-border">
{line}
</li>
))}
</ul>
</article>
))}
</div>

<Button asChild className="mt-8">
<Link to="/">Run an engagement</Link>
</Button>
</div>
);
}