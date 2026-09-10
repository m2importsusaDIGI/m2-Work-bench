import { createFileRoute, Link } from "@tanstack/react-router";
import { StatusBadge } from "@/components/status-badge";
import { useWorkbench } from "@/lib/store";
import { visOf } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export const Route = createFileRoute("/reports/")({ component: ReportsPage });

function ReportsPage() {
const jobs = useWorkbench((s) => s.jobs);
const reports = jobs.filter((j) => j.status === "completed" && j.result);

return (
<div className="mx-auto max-w-5xl">
<p className="text-xs uppercase tracking-[0.16em] text-muted">Proof of work</p>
<h1 className="font-display text-3xl md:text-4xl tracking-tight mt-1">Reports</h1>
<p className="mt-2 text-muted text-sm max-w-xl">
Work completion reports — schema, local SEO, social, visibility, leads, and outreach — ready
to send to a client.
</p>

{reports.length === 0 ? (
<div className="mt-10 rounded-2xl bg-surface p-8 shadow-[var(--shadow-border)] text-center">
<p className="text-muted">Finished jobs will appear here.</p>
<Link to="/" className="inline-block mt-3 text-sm text-accent hover:underline">
Run the workbench
</Link>
</div>
) : (
<ul className="mt-6 grid gap-3 sm:grid-cols-2">
{reports.map((job) => {
const v = visOf(job.result?.visibility ?? job.visibility);
const socialLive = v.social.filter((s) => s.status === "linked" || s.status === "live").length;
return (
<li key={job.id}>
<Link
to="/reports/$reportId"
params={{ reportId: job.id }}
className="block rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)] transition-[box-shadow] min-h-28"
>
<div className="flex items-center justify-between gap-2">
<h2 className="font-medium truncate">{job.target.businessName}</h2>
<StatusBadge status={job.status} />
</div>
<p className="text-xs text-muted mt-1 truncate">{job.target.location}</p>
<p className="text-sm mt-3 text-fg/90 line-clamp-2">{job.result?.summary}</p>
<p className="text-[11px] text-subtle mt-3 tabular-nums">
{job.result ? `${job.result.scores.before.overall} → ${job.result.scores.after.overall}` : ""}
{socialLive ? ` · ${socialLive} social live` : ""}
{" · "}
{formatDate(job.completedAt || job.createdAt)}
</p>
</Link>
</li>
);
})}
</ul>
)}
</div>
);
}