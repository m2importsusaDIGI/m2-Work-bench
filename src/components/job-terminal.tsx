import { useEffect, useRef } from "react";
import type { Job } from "@/lib/types";
import { cn, formatClock } from "@/lib/utils";

const CHANNEL: Record<string, string> = {
queue: "text-muted",
crawl: "text-accent",
parse: "text-muted",
schema: "text-ok",
local: "text-ok",
visibility: "text-accent",
leads: "text-fg",
outreach: "text-fg",
report: "text-accent",
error: "text-danger",
};

export function JobTerminal({ job, compact = false }: { job: Job; compact?: boolean }) {
const scroller = useRef<HTMLDivElement>(null);
useEffect(() => {
const el = scroller.current;
if (!el) return;
el.scrollTop = el.scrollHeight;
}, [job.logs.length]);

return (
<div
className={cn(
"rounded-2xl bg-bg shadow-[var(--shadow-border)] overflow-hidden flex flex-col",
compact ? "h-44 md:h-48" : "h-72 md:h-full min-h-56",
)}
>
<div className="flex items-center gap-2 px-3 h-10 border-b border-border text-[11px] uppercase tracking-wide text-muted">
<span
className={cn(
"size-1.5 rounded-full bg-ok",
job.status === "running" && "live-dot bg-accent",
job.status === "failed" && "bg-danger",
job.status === "queued" && "bg-muted",
)}
/>
Execution log
<span className="ml-auto font-mono normal-case tracking-normal tabular-nums">
{job.logs.length} lines
</span>
</div>
<div
ref={scroller}
className="flex-1 overflow-auto px-3 py-2 font-mono text-[11px] leading-5 md:text-xs"
>
{job.logs.map((line) => (
<div key={line.id} className="term-line flex gap-2">
<span className="text-subtle shrink-0 tabular-nums">{formatClock(line.t)}</span>
<span className={cn("w-16 shrink-0 uppercase", CHANNEL[line.channel])}>
{line.channel}
</span>
<span className="text-fg/90 min-w-0 break-words">{line.message}</span>
</div>
))}
{job.status === "running" ? (
<div className="term-line flex gap-2 text-muted">
<span className="text-subtle tabular-nums">{formatClock(new Date().toISOString())}</span>
<span className="w-16 uppercase live-dot">live</span>
<span>working…</span>
</div>
) : null}
</div>
</div>
);
}