import type { Job } from "./types";
import { visOf } from "./types";
import { slug } from "./utils";

export function leadsCsv(job: Job): string {
const rows = [
["Name", "Category", "City", "Website", "Phone", "Maturity", "Priority", "Gaps"],
];
for (const l of job.result?.leads ?? []) {
rows.push([
l.name,
l.category,
l.city,
l.website,
l.phone,
String(l.maturity),
l.priority,
l.gaps.join("; "),
]);
}
return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}

function csvCell(v: string) {
if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
return v;
}

export function schemaExport(job: Job): string {
const blocks = job.result?.schema.blocks ?? [];
const parsed = blocks.map((b) => {
try {
return JSON.parse(b.jsonld) as unknown;
} catch {
return { "@comment": b.type, raw: b.jsonld };
}
});
return JSON.stringify(parsed, null, 2);
}

export function outreachText(job: Job): string {
const o = job.result?.outreach;
if (!o) return "";
const follows = (o.followUps ?? [])
.map((f) => `— Day ${f.day} (${f.channel}) —\n${f.body}`)
.join("\n\n");
return `EMAIL SUBJECT\n${o.emailSubject}\n\nEMAIL BODY\n${o.emailBody}\n\nWHATSAPP\n${o.whatsapp}\n\nFOLLOW-UPS\n${follows}\n`;
}

export function visibilityCsv(job: Job): string {
const rows = [["Type", "Name", "Status", "URL", "Note"]];
const v = visOf(job.result?.visibility ?? job.visibility);
for (const s of v.social) rows.push(["social", s.network, s.status, s.url, s.note]);
for (const c of v.content) rows.push(["content", c.kind, c.status, c.url, c.note]);
for (const m of v.mentions) rows.push(["mention", m.kind, m.source, m.url, m.title]);
for (const b of v.backlinks) rows.push(["backlink", b.channel, b.priority, "", b.action]);
return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}

export function fileBase(job: Job) {
return `m2-${slug(job.target.businessName) || "report"}-${job.id.slice(-6)}`;
}

export function reportHtml(job: Job): string {
const r = job.result;
const t = job.target;
const v = visOf(r?.visibility ?? job.visibility);
const when = new Date(job.completedAt || job.createdAt).toLocaleString();
const scores = r
? `<table>
<tr><th></th><th>Before</th><th>After</th></tr>
${(["overall", "schema", "nap", "aeo", "local", "visibility"] as const)
.map(
(k) =>
`<tr><td>${k.toUpperCase()}</td><td>${r.scores.before[k] ?? "—"}</td><td>${r.scores.after[k] ?? "—"}</td></tr>`,
)
.join("")}
</table>`
: "";
const schema = (r?.schema.blocks ?? [])
.map(
(b) =>
`<h3>${escapeHtml(b.type)}</h3><p>${escapeHtml(b.notes)}</p><pre>${escapeHtml(b.jsonld)}</pre>`,
)
.join("");
const leads = (r?.leads ?? [])
.map(
(l) => `<tr><td>${escapeHtml(l.name)}</td><td>${escapeHtml(l.category)}</td><td>${escapeHtml(l.city)}</td><td>${l.maturity}</td><td>${l.priority}</td><td>${escapeHtml(l.gaps.join(", "))}</td></tr>`,

)
.join("");
const citations = (r?.local.citations ?? [])
.map((c) => `<tr><td>${escapeHtml(c.directory)}</td><td>${c.status}</td><td>${escapeHtml(c.note)}</td></tr>`)
.join("");
const social = v.social
.map(
(s) => `<tr><td>${escapeHtml(s.network)}</td><td>${s.status}</td><td>${escapeHtml(s.url)}</td><td>${escapeHtml(s.note)}</td></tr>`,

)
.join("");
const mentions = v.mentions
.map(
(m) => `<tr><td>${escapeHtml(m.kind)}</td><td>${escapeHtml(m.title)}</td><td>${escapeHtml(m.source)}</td><td>${escapeHtml(m.url)}</td></tr>`,

)
.join("");

return `<!doctype html>
<html lang="en">
<meta charset="utf-8"/>
<title>Work Completion Report — ${escapeHtml(t.businessName)}</title>
<style>
:root { font-family: Georgia, serif; color: #161616; }
body { max-width: 800px; margin: 40px auto; padding: 0 24px 80px; }
h1 { font-weight: 500; font-size: 32px; letter-spacing: -0.02em; }
h2 { margin-top: 2.2em; font-size: 18px; letter-spacing: 0.08em; text-transform: uppercase; }
h3 { margin-top: 1.4em; font-size: 14px; }
.meta { color: #555; font-family: ui-sans-serif, sans-serif; font-size: 13px; }
table { width: 100%; border-collapse: collapse; font-family: ui-sans-serif, sans-serif; font-size: 13px; }
th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #ddd; vertical-align: top; }
pre { background: #f4f2ec; padding: 12px; overflow: auto; font-size: 11px; }
.foot { margin-top: 48px; color: #777; font-size: 12px; font-family: ui-sans-serif, sans-serif; }
</style>
<body>
<p class="meta">M2 Digital Solutions LLC · Work Completion Report</p>
<h1>${escapeHtml(t.businessName)}</h1>
<p class="meta">${escapeHtml(t.websiteUrl)} · ${escapeHtml(t.location)} · ${escapeHtml(when)}</p>
<p>${escapeHtml(r?.summary || "")}</p>
<h2>Scores</h2>
${scores}
<h2>Social media</h2>
<p class="meta">${v.social.filter((s) => s.status === "linked" || s.status === "live").length} live profiles · score ${v.socialScore}</p>
<table><tr><th>Network</th><th>Status</th><th>URL</th><th>Note</th></tr>${social || "<tr><td colspan=4>No social profiles detected.</td></tr>"}</table>
<h2>Visibility</h2>
<p class="meta">Content ${v.contentScore} · Social ${v.socialScore} · Video ${v.videoScore} · Mentions ${v.mentionScore} · Sitemap ${v.sitemapUrls} URLs</p>
<h3>Off-site mentions</h3>
<table><tr><th>Kind</th><th>Title</th><th>Source</th><th>URL</th></tr>${mentions || "<tr><td colspan=4>None found.</td></tr>"}</table>
<h3>Backlink moves</h3>
<table><tr><th>Channel</th><th>Priority</th><th>Action</th></tr>${v.backlinks.map((b) => `<tr><td>${escapeHtml(b.channel)}</td><td>${b.priority}</td><td>${escapeHtml(b.action)}</td></tr>`).join("")}</table>
<h2>Schema implemented</h2>
${schema}
<h2>Local SEO</h2>
<p>${escapeHtml(r?.local.gbpDescription || "")}</p>
<p class="meta">Primary category: ${escapeHtml(r?.local.categories.primary || "")}</p>
<table><tr><th>Directory</th><th>Status</th><th>Note</th></tr>${citations}</table>
<h2>Prospects</h2>
<table><tr><th>Name</th><th>Category</th><th>City</th><th>Maturity</th><th>Priority</th><th>Gaps</th></tr>${leads || "<tr><td colspan=6>Queries only — see report in the workbench.</td></tr>"}</table>
<h2>Outreach</h2>
<p><strong>${escapeHtml(r?.outreach.emailSubject || "")}</strong></p>
<pre>${escapeHtml(r?.outreach.emailBody || "")}</pre>
<p class="foot">Prepared by M2 Workbench · M2 Digital Solutions LLC. Prospect names are candidates — verify before contact. Schema must be reviewed before injecting on a live site. Social URLs marked live should be verified as belonging to the client before citing.</p>
</body></html>`;
}

function escapeHtml(s: string) {
return s
.replace(/&/g, "&" + "amp;")
.replace(/</g, "&" + "lt;")
.replace(/>/g, "&" + "gt;")
.replace(/"/g, "&" + "quot;");
}