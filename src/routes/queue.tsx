import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { useWorkbench } from "@/lib/store";
import { formatDate } from "@/lib/utils";

export const Route = createFileRoute("/queue")({ component: QueuePage });

function QueuePage() {
const jobs = useWorkbench((s) => s.jobs);
const remove = useWorkbench((s) => s.remove);
const clearCompleted = useWorkbench((s) => s.clearCompleted);
const run = useWorkbench((s) => s.run);

return (
<div className="mx-auto max-w-5xl">
<div className="flex items-end justify-between gap-3 flex-wrap">
<div>
<p className="text-xs uppercase tracking-[0.16em] text-muted">Execution</p>
<h1 className="font-display text-3xl md:text-4xl tracking-tight mt-1">Queue</h1>
</div>
{jobs.length > 0 ? (
<Button variant="ghost" size="sm" onClick={clearCompleted}>
Clear finished
</Button>
) : null}
</div>

{jobs.length === 0 ? (
<div className="mt-10 rounded-2xl bg-surface p-8 shadow-[var(--shadow-border)] text-center">
<p className="text-muted">Nothing in the queue.</p>
<Link to="/" className="inline-block mt-3 text-sm text-accent hover:underline">
Start an engagement
</Link>
</div>
) : (
<ul className="mt-6 divide-y divide-border rounded-2xl bg-surface shadow-[var(--shadow-border)] overflow-hidden">
{jobs.map((job) => (
<li key={job.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-4">
<Link
to="/jobs/$jobId"
params={{ jobId: job.id }}
className="min-w-0 flex-1"
>
<div className="font-medium truncate">{job.target.businessName}</div>
<div className="text-xs text-muted truncate">
{job.target.location} · {job.target.websiteUrl.replace(/^https?:\/\//, "")}
</div>
</Link>
<div className="flex items-center gap-2 flex-wrap">
<StatusBadge status={job.status} />
<span className="text-xs text-subtle tabular-nums">{formatDate(job.createdAt)}</span>
{job.status === "queued" || job.status === "failed" ? (
<Button size="sm" variant="outline" onClick={() => void run(job.id)}>
{job.status === "failed" ? "Retry" : "Start"}
</Button>
) : null}
{job.status !== "running" ? (
<Button size="sm" variant="ghost" onClick={() => remove(job.id)}>
Remove
</Button>
) : null}
</div>
</li>
))}
</ul>
)}
</div>
);
}