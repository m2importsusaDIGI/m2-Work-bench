import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { copyText, kb } from "@/lib/utils";

export const Route = createFileRoute("/handoff")({ component: HandoffPage });

const FALLBACK_PROMPT =
"Rebuild M2 Workbench from this source. It is a no-login agency console for M2 Digital Solutions LLC: crawl a business site, write JSON-LD, audit local SEO, scan social and off-site mentions, score leads, draft outreach. Stack: TanStack Start, React 19, Tailwind v4, Zustand persist key m2-workbench-v1. Auth off, database off, jobs in localStorage. Visual: ink #0c0d0c, paper #f2f0e9, sage #c5d4cb, Fraunces + Figtree + IBM Plex Mono. No purple, no emoji icons. Modules: schema, local, visibility (social/news/wikipedia/backlinks), leads, outreach. Honesty: live footprint, not Semrush traffic/DA/keywords. Guessed socials must say verify. /reports.tsx is an Outlet layout; list lives in reports.index.tsx. Never filter inside a Zustand selector.";

type DumpFile = { path: string; body: string };

function parseDump(raw: string): { prompt: string; files: DumpFile[] } {
const files: DumpFile[] = [];
const re = /===== FILE: (.+?) =====\n```[^\n]*\n([\s\S]*?)\n```/g;
let m: RegExpExecArray | null;
while ((m = re.exec(raw))) {
files.push({ path: m[1].trim(), body: m[2] });
}
const head = raw.split("===== FILE:")[0] ?? "";
const promptLine = head
.replace(/^[\s\S]*?PROMPT FOR CLAUDE:\s*/m, "")
.replace(/\n---\s*$/m, "")
.trim();
return { prompt: promptLine || FALLBACK_PROMPT, files };
}

function fileBlock(f: DumpFile) {
const ext = f.path.split(".").pop() ?? "";
const lang =
ext === "tsx" || ext === "ts"
? ext
: ext === "json"
? "json"
: ext === "css"
? "css"
: ext === "svg"
? "xml"
: ext === "sh"
? "bash"
: "";
return `===== FILE: ${f.path} =====\n\`\`\`${lang}\n${f.body}\n\`\`\`\n`;
}

function splitParts(prompt: string, files: DumpFile[], target = 42_000): string[] {
const parts: string[] = [];
let buf = `PROMPT FOR CLAUDE:\n${prompt}\n\n---\n\n`;
for (const f of files) {
const block = fileBlock(f);
if (buf.length > 80 && buf.length + block.length > target) {
parts.push(buf.trimEnd() + "\n");
buf = `M2 Workbench source — continued. Paste after the previous part.\n\n${block}`;
} else {
buf += block + "\n";
}
}
if (buf.trim()) parts.push(buf.trimEnd() + "\n");
return parts;
}

function HandoffPage() {
const [raw, setRaw] = useState("");
const [error, setError] = useState("");
const [shown, setShown] = useState("");
const taRef = useRef<HTMLTextAreaElement>(null);

useEffect(() => {
let alive = true;
void fetch("/m2-source.txt", { cache: "no-store" })
.then(async (res) => {
if (!res.ok) throw new Error("Could not load the source dump");
const text = await res.text();
if (alive) {
setRaw(text);
setShown(text);
}
})
.catch((err: unknown) => {
if (alive) setError(err instanceof Error ? err.message : "Load failed");
});
return () => {
alive = false;
};
}, []);

const parsed = useMemo(() => (raw ? parseDump(raw) : { prompt: FALLBACK_PROMPT, files: [] }), [raw]);
const parts = useMemo(() => splitParts(parsed.prompt, parsed.files), [parsed]);

function reveal(text: string) {
setShown(text);
requestAnimationFrame(() => {
const el = taRef.current;
if (!el) return;
el.focus();
el.select();
el.setSelectionRange(0, text.length);
});
}

async function copy(label: string, text: string) {
reveal(text);
const result = await copyText(text);
if (result === "copied") toast.success(`${label} copied. Paste into Claude.`);
else {
reveal(text);
toast.message("Tap the box below, then Copy");
}
}

async function shareAll() {
const text = raw || shown;
if (!text) return;
const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
if (typeof nav.share !== "function") {
await copy("Source", text);
return;
}
try {
await nav.share({ title: "M2 Workbench source", text });
} catch (err) {
if (err instanceof Error && err.name === "AbortError") return;
await copy("Source", text);
}
}

async function sharePdf() {
try {
const res = await fetch("/M2-Workbench-source-code.pdf", { cache: "no-store" });
if (!res.ok) throw new Error("PDF missing");
const blob = await res.blob();
const file = new File([blob], "M2-Workbench-source-code.pdf", { type: "application/pdf" });
const nav = navigator as Navigator & {
share?: (d: ShareData) => Promise<void>;
canShare?: (d: ShareData) => boolean;
};
if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
await nav.share({ files: [file], title: "M2 Workbench source" });
toast.success("Share sheet opened — save or send the PDF");
return;
}
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = "M2-Workbench-source-code.pdf";
a.rel = "noopener";
document.body.appendChild(a);
a.click();
a.remove();
window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
toast.success("PDF download started");
} catch (err) {
if (err instanceof Error && err.name === "AbortError") return;
toast.error("Could not share the PDF");
}
}

return (
<div className="mx-auto max-w-3xl">
<p className="text-xs uppercase tracking-[0.16em] text-muted">For Claude</p>
<h1 className="font-display text-3xl md:text-4xl tracking-tight mt-1">Copy source</h1>
<p className="mt-2 text-muted text-sm max-w-xl leading-6">
Claude needs the source files, not just the prompt. Share the PDF to Files or
Claude, or Share to Claude as text (then Copy in the iPhone sheet) and paste.
</p>

{error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

<div className="mt-6 flex flex-col gap-2">
<Button size="lg" variant="accent" className="w-full" onClick={() => void sharePdf()}>
Share PDF
</Button>
<Button size="lg" className="w-full" disabled={!raw} onClick={() => void shareAll()}>
Share as text{raw ? ` · ${kb(raw.length)}` : ""}
</Button>
<Button variant="outline" className="w-full" disabled={!raw} onClick={() => void copy("All source", raw)}>
Copy all
</Button>
</div>

{parts.length > 1 ? (
<section className="mt-8">
<h2 className="font-display text-xl tracking-tight">Copy in parts</h2>
<p className="text-sm text-muted mt-1">Safer on iPhone. Paste part 1 first, then the rest in order.</p>
<ol className="mt-3 grid gap-2">
{parts.map((part, i) => (
<li key={i}>
<Button
variant="outline"
className="w-full justify-between"
onClick={() => void copy(`Part ${i + 1}`, part)}
>
<span>
Part {i + 1} of {parts.length}
</span>
<span className="tabular-nums text-muted font-normal">{kb(part.length)}</span>
</Button>
</li>
))}
</ol>
</section>
) : null}

<section className="mt-8">
<div className="flex items-baseline justify-between gap-3">
<h2 className="font-display text-xl tracking-tight">Selectable dump</h2>
<span className="text-[11px] text-subtle tabular-nums">
{parsed.files.length ? `${parsed.files.length} files` : "Loading"}
</span>
</div>
<p className="text-sm text-muted mt-1">Tap the box to select everything, then Copy from the phone menu.</p>
<textarea
ref={taRef}
readOnly
value={shown}
onFocus={(e) => e.currentTarget.select()}
onClick={(e) => e.currentTarget.select()}
spellCheck={false}
aria-label="Source dump"
className="mt-3 w-full min-h-48 h-[42vh] rounded-xl bg-surface-2 px-3 py-3 text-fg font-mono leading-5 shadow-[var(--shadow-border)] outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
/>
</section>

{parsed.files.length > 0 ? (
<section className="mt-8 pb-4">
<h2 className="font-display text-xl tracking-tight">One file at a time</h2>
<ul className="mt-3 divide-y divide-border rounded-2xl bg-surface shadow-[var(--shadow-border)] overflow-hidden">
{parsed.files.map((f) => (
<li key={f.path} className="flex items-center gap-3 px-4 min-h-12">
<span className="font-mono text-xs truncate flex-1">{f.path}</span>
<span className="tabular-nums text-[11px] text-subtle shrink-0">{kb(f.body.length)}</span>
<Button
size="sm"
variant="ghost"
className="shrink-0"
onClick={() => void copy(f.path, `===== FILE: ${f.path} =====\n\`\`\`\n${f.body}\n\`\`\`\n`)}
>
Copy
</Button>
</li>
))}
</ul>
</section>
) : null}
</div>
);
}