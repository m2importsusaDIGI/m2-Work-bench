import { useState } from "react";
import { Check, Copy, ExternalLink, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { DownloadBar } from "@/components/download-bar";
import { ScoreRing } from "@/components/score-ring";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Job, ModuleId, SocialProfile } from "@/lib/types";
import { visOf } from "@/lib/types";
import { useWorkbench } from "@/lib/store";
import { cn, copyText } from "@/lib/utils";

const TABS: { id: Tab; label: string; module?: ModuleId }[] = [
{ id: "overview", label: "Overview" },
{ id: "schema", label: "Schema", module: "schema" },
{ id: "local", label: "Local", module: "local" },
{ id: "visibility", label: "Social", module: "visibility" },
{ id: "leads", label: "Leads", module: "leads" },
{ id: "outreach", label: "Outreach", module: "outreach" },
];

type Tab = "overview" | "schema" | "local" | "visibility" | "leads" | "outreach";

export function ResultsPanel({ job }: { job: Job }) {
const [tab, setTab] = useState<Tab>("overview");
const r = job.result;
if (!r) {
return (
<div className="rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)] text-sm text-muted">
Results land here when the engine finishes.
</div>
);
}

const visible = TABS.filter((t) => !t.module || (job.modules ?? []).includes(t.module));

return (
<div className="flex flex-col gap-4 min-w-0">
<div className="flex items-center justify-between gap-3 flex-wrap">
<div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
{visible.map((t) => (
<button
key={t.id}
type="button"
onClick={() => setTab(t.id)}
className={cn(
"h-11 px-3 rounded-full text-sm shrink-0 transition-colors",
tab === t.id ? "bg-fg text-bg" : "text-muted hover:text-fg hover:bg-surface-2",
)}
>
{t.label}
</button>
))}
</div>
<DownloadBar job={job} />
</div>

{tab === "overview" ? <Overview job={job} onOpenSocial={() => setTab("visibility")} /> : null}
{tab === "schema" ? <SchemaView job={job} /> : null}
{tab === "local" ? <LocalView job={job} /> : null}
{tab === "visibility" ? <VisibilityView job={job} /> : null}
{tab === "leads" ? <LeadsView job={job} /> : null}
{tab === "outreach" ? <OutreachView job={job} /> : null}
</div>
);
}

function Overview({ job, onOpenSocial }: { job: Job; onOpenSocial: () => void }) {
const r = job.result!;
const v = visOf(r.visibility ?? job.visibility);
const showVis = (job.modules ?? []).includes("visibility") || v.social.length > 0 || v.mentions.length > 0;
const socialLive = v.social.filter((s) => s.status === "linked" || s.status === "live");

return (
<div className="flex flex-col gap-4">
<div className="rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)]">
<p className="text-xs uppercase tracking-wide text-muted mb-2">Summary</p>
<p className="text-[15px] leading-relaxed text-fg">{r.summary}</p>
{!r.usedAi ? (
<p className="mt-3 text-xs text-muted">
Compiled with the template engine. AI refinement was unavailable for this run.
</p>
) : null}
</div>

{showVis ? (
<div className="rounded-2xl bg-surface overflow-hidden shadow-[var(--shadow-border)]">
<div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
<p className="text-xs uppercase tracking-wide text-muted">Social media</p>
<button
type="button"
onClick={onOpenSocial}
className="text-xs text-muted hover:text-fg h-11 px-2"
>
Full social report
</button>
</div>
<SocialList social={v.social} />
<p className="px-4 py-3 text-xs text-subtle border-t border-border">
{socialLive.length} live · {v.mentions.length} off-site mentions · video {v.videoScore}
</p>
</div>
) : null}

<div className="rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)] overflow-x-auto">
<p className="text-xs uppercase tracking-wide text-muted mb-3">Before / after</p>
<div className="flex gap-5 min-w-max">
<ScoreRing value={r.scores.before.overall} label="Before" />
<ScoreRing value={r.scores.after.overall} label="After" />
<ScoreRing value={r.scores.after.schema} label="Schema" />
<ScoreRing value={r.scores.after.nap} label="NAP" />
<ScoreRing value={r.scores.after.aeo} label="AEO" />
<ScoreRing value={r.scores.after.local} label="Local" />
<ScoreRing value={r.scores.after.visibility ?? v.score} label="Visibility" />
</div>
</div>

<div className="rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)]">
<p className="text-xs uppercase tracking-wide text-muted mb-3">Recommended next</p>
<ol className="space-y-2">
{(r.recommendations ?? []).map((item, i) => (
<li key={i} className="flex gap-3 text-sm leading-6">
<span className="text-muted tabular-nums w-5 shrink-0">{i + 1}</span>
<span>{item}</span>
</li>
))}
</ol>
</div>
</div>
);
}

function SchemaView({ job }: { job: Job }) {
const r = job.result!;
return (
<div className="flex flex-col gap-3">
<div className="flex flex-wrap gap-2">
{(r.schema.existing ?? []).map((t) => (
<Badge key={t} tone="ok">
{t}
</Badge>
))}
{(r.schema.missing ?? []).map((t) => (
<Badge key={t} tone="warn">
+ {t}
</Badge>
))}
</div>
{(r.schema.blocks ?? []).map((b) => (
<article key={b.type} className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
<div className="flex items-start justify-between gap-3 mb-2">
<div>
<h3 className="font-medium">{b.type}</h3>
<p className="text-xs text-muted mt-1 leading-5">{b.notes}</p>
</div>
<CopyBtn text={b.jsonld} />
</div>
<pre className="mt-3 max-h-64 overflow-auto rounded-xl bg-bg p-3 text-[11px] leading-5 font-mono text-muted">
{b.jsonld}
</pre>
</article>
))}
</div>
);
}

function LocalView({ job }: { job: Job }) {
const l = job.result!.local;
return (
<div className="flex flex-col gap-3">
<div className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)] grid gap-3 sm:grid-cols-3">
<NapCell label="Name" value={l.nap.name} />
<NapCell label="Address" value={l.nap.address} />
<NapCell label="Phone" value={l.nap.phone || "—"} />
</div>
{(l.nap.issues ?? []).length ? (
<ul className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)] text-sm space-y-1.5">
{(l.nap.issues ?? []).map((issue) => (
<li key={issue} className="text-warn">
{issue}
</li>
))}
</ul>
) : null}
<div className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
<div className="flex items-center justify-between mb-2">
<p className="text-xs uppercase tracking-wide text-muted">GBP description</p>
<CopyBtn text={l.gbpDescription} />
</div>
<p className="text-sm leading-6">{l.gbpDescription}</p>
<p className="mt-3 text-xs text-muted">
Primary: {l.categories.primary}
{(l.categories.additional ?? []).length
? ` · Additional: ${l.categories.additional.join(", ")}`
: ""}
</p>
</div>
<div className="rounded-2xl bg-surface overflow-hidden shadow-[var(--shadow-border)]">
<table className="w-full text-sm">
<thead className="text-xs uppercase tracking-wide text-muted">
<tr className="border-b border-border">
<th className="text-left font-medium px-4 py-3">Directory</th>
<th className="text-left font-medium px-4 py-3">Status</th>
<th className="text-left font-medium px-4 py-3 hidden sm:table-cell">Note</th>
</tr>
</thead>
<tbody>
{(l.citations ?? []).map((c) => (
<tr key={c.directory} className="border-b border-border last:border-0">
<td className="px-4 py-3">{c.directory}</td>
<td className="px-4 py-3">
<Badge
tone={
c.status === "inconsistent"
? "warn"
: c.status === "likely-missing"
? "danger"
: "muted"
}
>
{c.status.replace("-", " ")}
</Badge>
</td>
<td className="px-4 py-3 text-muted hidden sm:table-cell">{c.note}</td>
</tr>
))}
</tbody>
</table>
</div>
</div>
);
}

function VisibilityView({ job }: { job: Job }) {
const v = visOf(job.result?.visibility ?? job.visibility);
const newsN = v.mentions.filter((m) => m.kind === "news" || m.kind === "article" || m.kind === "blog").length;
const wikiN = v.mentions.filter((m) => m.kind === "wiki").length;
const reviewN = v.mentions.filter((m) => m.kind === "review" || m.kind === "directory").length;
const videoN = v.mentions.filter((m) => m.kind === "video").length + v.videos.length;
const socialLive = v.social.filter((s) => s.status === "linked" || s.status === "live").length;

return (
<div className="flex flex-col gap-3">
<div className="rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)] overflow-x-auto">
<p className="text-xs uppercase tracking-wide text-muted mb-3">Domain overview</p>
<div className="flex gap-5 min-w-max">
<ScoreRing value={v.score} label="Overall" />
<ScoreRing value={v.socialScore} label="Social" />
<ScoreRing value={v.mentionScore} label="Mentions" />
<ScoreRing value={v.contentScore} label="On-site" />
<ScoreRing value={v.videoScore} label="Video" />
</div>
<div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
<StatChip label="Social live" value={String(socialLive)} />
<StatChip label="News / articles" value={String(newsN)} />
<StatChip label="Wikipedia" value={wikiN ? "Yes" : "No"} />
<StatChip label="Reviews" value={String(reviewN)} />
<StatChip label="Videos" value={String(videoN)} />
</div>
<p className="mt-3 text-xs text-muted leading-5">
Live footprint of social profiles, articles, videos, and reviews — not Semrush traffic, keywords, or
Domain Authority. Sitemap {v.sitemapUrls} URLs · {v.articleUrls} look like posts
{v.searchedWeb ? " · open-web search ran" : ""}.
</p>
</div>

<div className="rounded-2xl bg-surface overflow-hidden shadow-[var(--shadow-border)]">
<p className="px-4 py-3 text-xs uppercase tracking-wide text-muted border-b border-border">
Social media
</p>
<SocialList social={v.social} />
</div>

<div className="rounded-2xl bg-surface overflow-hidden shadow-[var(--shadow-border)]">
<p className="px-4 py-3 text-xs uppercase tracking-wide text-muted border-b border-border">
Off-site mentions · backlink fuel
</p>
{v.mentions.length === 0 ? (
<p className="px-4 py-4 text-sm text-muted leading-6">
No indexed news, Wikipedia, reviews, or videos turned up for this name + city. That is the gap M2
syndication is built to fill.
</p>
) : (
<ul>
{v.mentions.map((m) => (
<li
key={m.kind + m.url}
className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 px-4 py-3 border-b border-border last:border-0"
>
<Badge
tone={
m.kind === "wiki" || m.kind === "news" || m.kind === "article"
? "ok"
: m.kind === "video" || m.kind === "review"
? "accent"
: "muted"
}
className="w-fit shrink-0 mt-0.5"
>
{m.kind}
</Badge>
<div className="min-w-0 flex-1">
<div className="text-sm leading-5">{m.title}</div>
<a
href={m.url}
target="_blank"
rel="noreferrer"
className="text-xs text-muted truncate hover:text-fg inline-flex items-center gap-1 min-w-0 max-w-full"
>
<span className="truncate">
{m.source} · {m.url.replace(/^https?:\/\//, "")}
</span>
<ExternalLink className="size-3 shrink-0" />
</a>
<p className="text-xs text-subtle mt-0.5 leading-5">{m.note}</p>
</div>
</li>
))}
</ul>
)}
</div>

<div className="rounded-2xl bg-surface overflow-hidden shadow-[var(--shadow-border)]">
<p className="px-4 py-3 text-xs uppercase tracking-wide text-muted border-b border-border">
On-site articles, blogs, video
</p>
<ul>
{v.content.map((c) => (
<li
key={c.kind + c.url}
className="flex items-start justify-between gap-3 px-4 py-3 border-b border-border last:border-0"
>
<div className="min-w-0">
<div className="text-sm capitalize">{c.kind}</div>
<div className="text-xs text-muted mt-0.5 leading-5">{c.note}</div>
</div>
<Badge tone={c.status === "found" ? "ok" : "muted"}>{c.status}</Badge>
</li>
))}
{v.videos.map((vid) => (
<li key={vid.url} className="px-4 py-3 border-b border-border last:border-0">
<div className="text-sm">{vid.source}</div>
<a
href={vid.url}
target="_blank"
rel="noreferrer"
className="text-xs text-muted truncate block hover:text-fg"
>
{vid.url}
</a>
</li>
))}
</ul>
</div>

<div className="rounded-2xl bg-surface overflow-hidden shadow-[var(--shadow-border)]">
<p className="px-4 py-3 text-xs uppercase tracking-wide text-muted border-b border-border">
Backlink & presence moves
</p>
<ol>
{v.backlinks.map((b, i) => (
<li key={b.channel} className="px-4 py-3 border-b border-border last:border-0">
<div className="flex items-center gap-2">
<span className="text-muted tabular-nums text-xs w-4">{i + 1}</span>
<span className="text-sm font-medium">{b.channel}</span>
<Badge tone={b.priority === "high" ? "warn" : b.priority === "medium" ? "accent" : "muted"}>
{b.priority}
</Badge>
</div>
<p className="mt-1 text-xs text-muted leading-5 pl-6">{b.why}</p>
<p className="mt-1 text-sm leading-6 pl-6">{b.action}</p>
</li>
))}
</ol>
</div>

{v.notes.length ? (
<p className="text-xs text-subtle leading-5 px-1">{v.notes[v.notes.length - 1]}</p>
) : null}
</div>
);
}

function SocialList({ social }: { social: SocialProfile[] }) {
if (social.length === 0) {
return (
<p className="px-4 py-4 text-sm text-muted leading-6">
No Facebook, Instagram, LinkedIn, X, YouTube, TikTok, or Pinterest profiles were confirmed. Add them in
the footer and Organization sameAs.
</p>
);
}
return (
<ul>
{social.map((s) => (
<li
key={s.network + s.url}
className="flex flex-col gap-1 px-4 py-3 border-b border-border last:border-0 min-h-14"
>
<div className="flex items-center gap-2 min-w-0">
<span className="text-sm font-medium">{s.network}</span>
<Badge
tone={
s.status === "linked"
? "ok"
: s.status === "live"
? "accent"
: s.status === "unverified"
? "warn"
: "danger"
}
>
{s.status}
</Badge>
</div>
<a
href={s.url}
target="_blank"
rel="noreferrer"
className="text-xs text-muted truncate hover:text-fg inline-flex items-center gap-1 min-w-0"
>
<span className="truncate">{s.url.replace(/^https?:\/\//, "")}</span>
<ExternalLink className="size-3 shrink-0" />
</a>
<span className="text-xs text-subtle leading-5">{s.note}</span>
</li>
))}
</ul>
);
}

function StatChip({ label, value }: { label: string; value: string }) {
return (
<div className="rounded-xl bg-bg px-3 py-2">
<p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
<p className="mt-0.5 text-sm tabular-nums">{value}</p>
</div>
);
}

function LeadsView({ job }: { job: Job }) {
const r = job.result!;
const addContactFromLead = useWorkbench((s) => s.addContactFromLead);
const contacts = useWorkbench((s) => s.contacts);
if (!r.leads.length) {
return (
<div className="rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)]">
<p className="text-sm leading-6 text-fg">
Live directory scraping is not connected. Use these analyst queries, then import the CSV
once you have a list.
</p>
<ul className="mt-3 space-y-2">
{(r.leadQueries ?? []).map((q) => (
<li key={q} className="font-mono text-xs text-muted bg-bg rounded-lg px-3 py-2">
{q}
</li>
))}
</ul>
</div>
);
}
return (
<div className="rounded-2xl bg-surface overflow-hidden shadow-[var(--shadow-border)]">
<p className="px-4 py-3 text-xs text-muted border-b border-border">
Prospect candidates for {job.target.location}. Verify before contact.
</p>
<div className="overflow-x-auto">
<table className="w-full text-sm min-w-[720px]">
<thead className="text-xs uppercase tracking-wide text-muted">
<tr className="border-b border-border">
<th className="text-left font-medium px-4 py-3">Business</th>
<th className="text-left font-medium px-4 py-3">City</th>
<th className="text-left font-medium px-4 py-3">Maturity</th>
<th className="text-left font-medium px-4 py-3">Priority</th>
<th className="text-left font-medium px-4 py-3">Gaps</th>
<th className="text-left font-medium px-4 py-3">CRM</th>
</tr>
</thead>
<tbody>
{r.leads.map((l) => {
const inCrm = contacts.some(
(c) =>
c.businessName.trim().toLowerCase() === l.name.trim().toLowerCase() ||
(l.website && c.websiteUrl && c.websiteUrl.toLowerCase() === l.website.toLowerCase()),
);
return (
<tr key={l.name + l.city} className="border-b border-border last:border-0">
<td className="px-4 py-3">
<div className="font-medium">{l.name}</div>
<div className="text-xs text-muted">{l.category}</div>
</td>
<td className="px-4 py-3 text-muted">{l.city}</td>
<td className="px-4 py-3 tabular-nums">{l.maturity}</td>
<td className="px-4 py-3">
<Badge
tone={l.priority === "high" ? "warn" : l.priority === "medium" ? "accent" : "muted"}
>
{l.priority}
</Badge>
</td>
<td className="px-4 py-3 text-muted text-xs">{l.gaps.join(", ")}</td>
<td className="px-4 py-3">
<Button
type="button"
size="sm"
variant={inCrm ? "ghost" : "outline"}
disabled={inCrm}
onClick={() => {
addContactFromLead(l, job.id);
toast.success(`${l.name} added to CRM`);
}}
>
<UserPlus />
{inCrm ? "In CRM" : "Add"}
</Button>
</td>
</tr>
);
})}
</tbody>
</table>
</div>
</div>
);
}

function OutreachView({ job }: { job: Job }) {
const o = job.result!.outreach;
const addContactFromTarget = useWorkbench((s) => s.addContactFromTarget);
const addFollowUpTasks = useWorkbench((s) => s.addFollowUpTasks);
const [saved, setSaved] = useState(false);

function saveToCrm() {
const contactId = addContactFromTarget(job.target, job.id);
if (o.followUps?.length) {
addFollowUpTasks(contactId, o.followUps, job.completedAt ?? undefined);
}
setSaved(true);
toast.success(
o.followUps?.length
? `${job.target.businessName} saved to CRM with ${o.followUps.length} follow-up task(s)`
: `${job.target.businessName} saved to CRM`,
);
}

return (
<div className="flex flex-col gap-3">
<div className="flex justify-end">
<Button type="button" size="sm" variant={saved ? "ghost" : "accent"} disabled={saved} onClick={saveToCrm}>
<UserPlus />
{saved ? "Saved to CRM" : "Save to CRM + schedule follow-ups"}
</Button>
</div>
<CopyBlock title={`Email · ${o.emailSubject}`} body={`${o.emailSubject}\n\n${o.emailBody}`} />
<CopyBlock title="WhatsApp" body={o.whatsapp} />
{(o.followUps ?? []).map((f) => (
<CopyBlock key={f.day + f.channel} title={`Follow-up · day ${f.day} · ${f.channel}`} body={f.body} />
))}
</div>
);
}

function CopyBlock({ title, body }: { title: string; body: string }) {
return (
<article className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
<div className="flex items-center justify-between gap-3 mb-2">
<h3 className="text-sm font-medium">{title}</h3>
<CopyBtn text={body} />
</div>
<pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-fg/90">{body}</pre>
</article>
);
}

function NapCell({ label, value }: { label: string; value: string }) {
return (
<div>
<p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
<p className="mt-1 text-sm">{value}</p>
</div>
);
}

function CopyBtn({ text }: { text: string }) {
const [done, setDone] = useState(false);
return (
<Button
type="button"
size="sm"
variant="ghost"
className="shrink-0"
onClick={async () => {
await copyText(text);
setDone(true);
toast.success("Copied");
setTimeout(() => setDone(false), 1200);
}}
>
{done ? <Check /> : <Copy />}
{done ? "Copied" : "Copy"}
</Button>
);
}