import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fileBase, leadsCsv, outreachText, reportHtml, schemaExport, visibilityCsv } from "@/lib/export";
import type { Job } from "@/lib/types";
import { downloadBlob } from "@/lib/utils";

export function DownloadBar({ job }: { job: Job }) {
if (!job.result) return null;
const base = fileBase(job);

async function save(kind: "report" | "schema" | "leads" | "outreach" | "visibility") {
try {
let result: "shared" | "downloaded" | "aborted" = "downloaded";
if (kind === "report") result = await downloadBlob(`${base}.html`, reportHtml(job), "text/html;charset=utf-8");
if (kind === "schema")
result = await downloadBlob(`${base}.jsonld`, schemaExport(job), "application/ld+json;charset=utf-8");
if (kind === "leads")
result = await downloadBlob(`${base}-leads.csv`, leadsCsv(job), "text/csv;charset=utf-8");
if (kind === "outreach")
result = await downloadBlob(`${base}-outreach.txt`, outreachText(job), "text/plain;charset=utf-8");
if (kind === "visibility")
result = await downloadBlob(`${base}-visibility.csv`, visibilityCsv(job), "text/csv;charset=utf-8");
if (result === "aborted") return;
toast.success(result === "shared" ? "Share sheet opened" : "Saved to downloads");
} catch {
toast.error("Could not export that file");
}
}

return (
<div className="flex flex-wrap gap-2">
<Button size="sm" onClick={() => void save("report")}>
<Download /> Report
</Button>
<Button size="sm" variant="outline" onClick={() => void save("schema")}>
JSON-LD
</Button>
<Button size="sm" variant="outline" onClick={() => void save("leads")}>
Leads CSV
</Button>
<Button size="sm" variant="outline" onClick={() => void save("outreach")}>
Outreach
</Button>
{(job.modules ?? []).includes("visibility") ? (
<Button size="sm" variant="outline" onClick={() => void save("visibility")}>
Social CSV
</Button>
) : null}
</div>
);
}