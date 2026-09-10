import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { TargetForm } from "@/components/target-form";
import { StatusBadge } from "@/components/status-badge";
import { MODULE_META } from "@/lib/modules";
import { useWorkbench } from "@/lib/store";
import { MODULES } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
const jobs = useWorkbench((s) => s.jobs);
const recent = jobs.slice(0, 4);

return (
<div className="mx-auto max-w-6xl stagger-in">
<p className="text-xs uppercase tracking-[0.16em] text-muted">M2 Digital Solutions LLC</p>
<h1 className="mt-2 font-display text-4xl md:text-5xl leading-[1.1] tracking-tight max-w-xl">
Point it at a business. Do the work.
</h1>
<p className="mt-3 max-w-xl text-muted leading-relaxed">
Crawl the site, write the schema, scan articles and socials, score nearby prospects, and hand over a
completion report — the technical half of an AEO / local SEO engagement.
</p>

<div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
<section className="rounded-2xl bg-surface p-5 md:p-6 shadow-[var(--shadow-border)]">
<h2 className="text-sm font-medium mb-4">New engagement</h2>
<TargetForm />
</section>

<aside className="flex flex-col gap-4">
<section className="rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)]">
<h2 className="text-sm font-medium mb-3">What a run does</h2>
<ol className="space-y-3">
{MODULES.map((id, i) => (
<li key={id} className="flex gap-3">
<span className="tabular-nums text-muted text-sm w-5">{i + 1}</span>
<div>
<div className="text-sm">{MODULE_META[id].title}</div>
<p className="text-xs text-muted leading-5 mt-0.5">{MODULE_META[id].blurb}</p>
</div>
</li>
))}
</ol>
</section>

<section className="rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)]">
<div className="flex items-center justify-between mb-3">
<h2 className="text-sm font-medium">Recent</h2>
<Link to="/queue" className="text-xs text-muted hover:text-fg inline-flex items-center gap-1">
Queue <ArrowUpRight className="size-3" />
</Link>
</div>
{recent.length === 0 ? (
<p className="text-sm text-muted">No jobs yet. Run an engagement to fill the queue.</p>
) : (
<ul className="space-y-2">
{recent.map((job) => (
<li key={job.id}>
<Link
to="/jobs/$jobId"
params={{ jobId: job.id }}
className="flex items-center gap-3 rounded-xl px-2 py-2 -mx-2 hover:bg-surface-2 min-h-11"
>
<div className="min-w-0 flex-1">
<div className="text-sm truncate">{job.target.businessName}</div>
<div className="text-[11px] text-muted">{formatDate(job.createdAt)}</div>
</div>
<StatusBadge status={job.status} />
</Link>
</li>
))}
</ul>
)}
</section>
</aside>
</div>
</div>
);
}