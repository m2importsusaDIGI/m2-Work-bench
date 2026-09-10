import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Terminal } from "lucide-react";
import { JobTerminal } from "@/components/job-terminal";
import { ResultsPanel } from "@/components/results-panel";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { useWorkbench } from "@/lib/store";

export const Route = createFileRoute("/jobs/$jobId")({ component: JobPage });

function JobPage() {
const { jobId } = Route.useParams();
const job = useWorkbench((s) => s.jobs.find((j) => j.id === jobId));
const run = useWorkbench((s) => s.run);
const [showLog, setShowLog] = useState(false);

useEffect(() => {
if (job?.status === "queued") void run(job.id);
}, [job?.id, job?.status, run]);

if (!job) {
return (
<div className="mx-auto max-w-lg py-16 text-center">
<h1 className="font-display text-3xl">Job not found</h1>
<p className="mt-2 text-muted text-sm">It may have been cleared from this device.</p>
<Button asChild className="mt-6">
<Link to="/">New engagement</Link>
</Button>
</div>
);
}

const finished = job.status === "completed" || job.status === "failed";

return (
<div className="mx-auto max-w-6xl">
<div className="flex flex-wrap items-start justify-between gap-3">
<div className="min-w-0">
<p className="text-xs uppercase tracking-[0.16em] text-muted">Job {job.id.slice(-6)}</p>
<h1 className="font-display text-3xl md:text-4xl tracking-tight mt-1 truncate">
{job.target.businessName}
</h1>
<p className="text-sm text-muted mt-1 truncate">
{job.target.websiteUrl} · {job.target.location}
</p>
</div>
<div className="flex items-center gap-2">
<StatusBadge status={job.status} />
<Button size="sm" variant="outline" onClick={() => setShowLog((v) => !v)}>
<Terminal />
{showLog ? "Hide log" : "Show log"}
</Button>
{job.status === "failed" ? (
<Button size="sm" onClick={() => void run(job.id)}>
Retry
</Button>
) : null}
{job.status === "completed" ? (
<Button size="sm" variant="outline" asChild>
<Link to="/reports/$reportId" params={{ reportId: job.id }}>
Open report
</Link>
</Button>
) : null}
</div>
</div>

<div
className={
showLog && !finished
? "mt-6 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-stretch"
: "mt-6 flex flex-col gap-4"
}
>
{showLog ? <JobTerminal job={job} compact={finished} /> : null}
<ResultsPanel job={job} />
</div>
</div>
);
}