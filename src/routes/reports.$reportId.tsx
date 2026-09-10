import { createFileRoute, Link } from "@tanstack/react-router";
import { DownloadBar } from "@/components/download-bar";
import { ResultsPanel } from "@/components/results-panel";
import { Button } from "@/components/ui/button";
import { useWorkbench } from "@/lib/store";

export const Route = createFileRoute("/reports/$reportId")({ component: ReportPage });

function ReportPage() {
const { reportId } = Route.useParams();
const job = useWorkbench((s) => s.jobs.find((j) => j.id === reportId));

if (!job || !job.result) {
return (
<div className="mx-auto max-w-lg py-16 text-center">
<h1 className="font-display text-3xl">Report not found</h1>
<Button asChild className="mt-6">
<Link to="/reports">All reports</Link>
</Button>
</div>
);
}

return (
<div className="mx-auto max-w-4xl">
<p className="text-xs uppercase tracking-[0.16em] text-muted no-print">
Work Completion Report
</p>
<div className="flex flex-wrap items-end justify-between gap-3">
<div>
<h1 className="font-display text-3xl md:text-4xl tracking-tight mt-1">
{job.target.businessName}
</h1>
<p className="text-sm text-muted mt-1">
{job.target.websiteUrl} · {job.target.location}
</p>
</div>
<div className="no-print flex gap-2">
<DownloadBar job={job} />
<Button size="sm" variant="ghost" onClick={() => window.print()}>
Print
</Button>
</div>
</div>
<div className="mt-6">
<ResultsPanel job={job} />
</div>
</div>
);
}