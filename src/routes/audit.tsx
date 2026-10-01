import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Download, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { runSeoAudit } from "@/lib/fns";
import type { SeoAuditReport, SeoFinding } from "@/lib/types";
import { cn, normalizeUrl } from "@/lib/utils";

export const Route = createFileRoute("/audit")({ component: AuditPage });

const SEVERITIES = ["critical", "high", "medium", "low"] as const;

const SEV_CLASS: Record<string, string> = {
critical: "text-danger",
high: "text-danger",
medium: "text-warn",
low: "text-muted",
info: "text-muted",
};

function AuditPage() {
const [url, setUrl] = useState("");
const [pagespeed, setPagespeed] = useState(false);
const [busy, setBusy] = useState(false);
const [error, setError] = useState<string | null>(null);
const [report, setReport] = useState<SeoAuditReport | null>(null);

async function onSubmit(e: FormEvent) {
e.preventDefault();
setError(null);
let target: string;
try {
target = new URL(normalizeUrl(url)).toString();
} catch {
return setError("That URL does not look valid.");
}
setBusy(true);
setReport(null);
try {
setReport(await runSeoAudit({ data: { url: target, pagespeed } }));
} catch (err) {
setError(err instanceof Error ? err.message : "Audit failed.");
} finally {
setBusy(false);
}
}

function downloadJson() {
if (!report) return;
const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
const a = document.createElement("a");
a.href = URL.createObjectURL(blob);
a.download = `seo-audit-${new URL(report.final_url || report.url).hostname}.json`;
a.click();
URL.revokeObjectURL(a.href);
}

return (
<div className="mx-auto max-w-4xl">
<p className="text-xs uppercase tracking-[0.16em] text-muted">Engine</p>
<h1 className="font-display text-3xl md:text-4xl tracking-tight mt-1">SEO audit</h1>
<p className="mt-2 text-muted text-sm max-w-xl">
Live checks on the homepage, robots.txt, sitemaps, schema, NAP, and AI-crawler rules. No
API key. Every finding comes from the site itself, not third-party traffic estimates.
</p>

<form onSubmit={onSubmit} className="mt-6 rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)]">
<Label htmlFor="audit-url">Website URL</Label>
<div className="mt-2 flex flex-col sm:flex-row gap-3">
<Input
id="audit-url"
inputMode="url"
autoComplete="url"
placeholder="https://client-site.com"
value={url}
onChange={(e) => setUrl(e.target.value)}
/>
<Button type="submit" disabled={busy} className="sm:w-40">
<Play />
{busy ? "Auditing…" : "Run audit"}
</Button>
</div>
<label className="mt-4 flex items-center gap-2 text-sm text-muted">
<input
type="checkbox"
checked={pagespeed}
onChange={(e) => setPagespeed(e.target.checked)}
className="size-4 accent-[var(--color-accent)]"
/>
Include Google PageSpeed (slower, about a minute)
</label>
{error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
{busy ? (
<p className="mt-3 text-sm text-muted">Fetching the site and running checks. This usually takes 10–40 seconds.</p>
) : null}
</form>

{report ? <AuditResult report={report} onDownload={downloadJson} /> : null}
</div>
);
}

function AuditResult({ report, onDownload }: { report: SeoAuditReport; onDownload: () => void }) {
const page = report.data.page;
const local = report.data.local;
const failed = report.steps.filter((s) => !s.ok);
const byCategory = new Map<string, SeoFinding[]>();
for (const f of report.findings) {
const list = byCategory.get(f.category) ?? [];
list.push(f);
byCategory.set(f.category, list);
}

return (
<section className="mt-8">
<div className="flex flex-wrap items-end justify-between gap-3">
<div>
<h2 className="font-display text-2xl tracking-tight">
{new URL(report.final_url || report.url).hostname}
</h2>
<p className="text-xs text-muted mt-1 font-mono">{report.checked_at}</p>
</div>
<Button size="sm" variant="ghost" onClick={onDownload}>
<Download />
JSON
</Button>
</div>

<div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
{SEVERITIES.map((s) => (
<div key={s} className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
<p className={cn("font-display text-3xl tabular-nums", SEV_CLASS[s])}>{report.summary[s] ?? 0}</p>
<p className="text-[11px] uppercase tracking-[0.12em] text-muted mt-1">{s}</p>
</div>
))}
</div>

{page || local ? (
<dl className="mt-4 grid grid-cols-[120px_1fr] gap-x-3 gap-y-2 rounded-xl bg-surface-2 p-4 text-sm">
<dt className="text-muted">Title</dt>
<dd className="break-words">{page?.title || "—"}</dd>
<dt className="text-muted">H1</dt>
<dd className="break-words">{page?.h1?.join(" · ") || "—"}</dd>
<dt className="text-muted">Words</dt>
<dd className="tabular-nums">{page?.word_count ?? "—"}</dd>
<dt className="text-muted">Schema</dt>
<dd className="break-words">{local?.schema_types?.join(", ") || "none"}</dd>
<dt className="text-muted">Phones</dt>
<dd className="break-words">{local?.phones_on_page?.join(", ") || "none found"}</dd>
</dl>
) : null}

{failed.length > 0 ? (
<p className="mt-3 text-sm text-warn">
Some checks could not run: {failed.map((s) => s.step).join(", ")}. Results below are partial.
</p>
) : null}

<div className="mt-6 space-y-6">
{[...byCategory.entries()].map(([category, items]) => (
<div key={category}>
<h3 className="text-xs uppercase tracking-[0.16em] text-muted">{category}</h3>
<ul className="mt-2 space-y-2">
{items.map((f) => (
<li key={f.id} className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
<p className={cn("font-mono text-[11px] uppercase tracking-[0.12em]", SEV_CLASS[f.severity])}>
{f.severity}
</p>
<p className="mt-1 font-medium">{f.title}</p>
{f.detail ? <p className="mt-1 text-sm text-muted leading-6">{f.detail}</p> : null}
{f.fix ? (
<p className="mt-2 text-sm leading-6 pl-3 border-l border-accent/40">{f.fix}</p>
) : null}
</li>
))}
</ul>
</div>
))}
{report.findings.length === 0 ? (
<p className="text-sm text-muted">No issues found by these checks.</p>
) : null}
</div>

<p className="mt-8 text-[11px] leading-5 text-subtle">
Checks adapted from Claude SEO (MIT). Content flags are text-pattern heuristics, not Google
verdicts. PageSpeed numbers are lab results, not field Core Web Vitals.
</p>
</section>
);
}
