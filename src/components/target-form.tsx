import { useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MODULE_META, PRESETS } from "@/lib/modules";
import { useWorkbench } from "@/lib/store";
import type { ModuleId } from "@/lib/types";
import { MODULES } from "@/lib/types";
import { cn, normalizeUrl } from "@/lib/utils";

const EMPTY = {
businessName: "",
websiteUrl: "",
location: "",
niche: "",
phone: "",
};

export function TargetForm() {
const navigate = useNavigate();
const createJob = useWorkbench((s) => s.createJob);
const [form, setForm] = useState(EMPTY);
const [modules, setModules] = useState<ModuleId[]>([...MODULES]);
const [error, setError] = useState<string | null>(null);
const [busy, setBusy] = useState(false);

function set<K extends keyof typeof EMPTY>(key: K, value: string) {
setForm((f) => ({ ...f, [key]: value }));
}

function toggle(id: ModuleId) {
setModules((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
}

async function onSubmit(e: FormEvent) {
e.preventDefault();
setError(null);
if (!form.businessName.trim()) return setError("Business name is required.");
if (!form.websiteUrl.trim()) return setError("Website URL is required.");
if (modules.length === 0) return setError("Pick at least one module.");
try {
new URL(normalizeUrl(form.websiteUrl));
} catch {
return setError("That URL does not look valid.");
}
setBusy(true);
const id = createJob(
{
businessName: form.businessName.trim(),
websiteUrl: normalizeUrl(form.websiteUrl),
location: form.location.trim(),
niche: form.niche.trim(),
phone: form.phone.trim(),
},
modules,
);
await navigate({ to: "/jobs/$jobId", params: { jobId: id } });
}

return (
<form onSubmit={onSubmit} className="flex flex-col gap-5">
<div className="grid gap-4 md:grid-cols-2">
<Field label="Business name" htmlFor="bn">
<Input
id="bn"
autoComplete="organization"
placeholder="Founding Farmers"
value={form.businessName}
onChange={(e) => set("businessName", e.target.value)}
/>
</Field>
<Field label="Website URL" htmlFor="url">
<Input
id="url"
inputMode="url"
autoCapitalize="none"
placeholder="https://example.com"
value={form.websiteUrl}
onChange={(e) => set("websiteUrl", e.target.value)}
/>
</Field>
<Field label="Target location (optional)" htmlFor="loc">
<Input
id="loc"
placeholder="DMV area or Alphaville, São Paulo — add later if unsure"
value={form.location}
onChange={(e) => set("location", e.target.value)}
/>
</Field>
<Field label="Niche (optional)" htmlFor="niche">
<Input
id="niche"
placeholder="Restaurant, HVAC, dental clinic"
value={form.niche}
onChange={(e) => set("niche", e.target.value)}
/>
</Field>
<Field label="Phone (optional)" htmlFor="phone" className="md:col-span-2">
<Input
id="phone"
inputMode="tel"
placeholder="+1 202 555 0142"
value={form.phone}
onChange={(e) => set("phone", e.target.value)}
/>
</Field>
</div>

<div>
<p className="text-xs font-medium tracking-wide text-muted mb-2">Load a sample</p>
<div className="flex flex-wrap gap-2">
{PRESETS.map((p) => (
<button
key={p.label}
type="button"
onClick={() =>
setForm({
businessName: p.businessName,
websiteUrl: p.websiteUrl,
location: p.location,
niche: p.niche,
phone: p.phone,
})
}
className="h-9 rounded-full px-3 text-xs text-muted shadow-[var(--shadow-border)] hover:text-fg hover:bg-surface-2 transition-colors"
>
{p.label}
</button>
))}
</div>
</div>

<div>
<p className="text-xs font-medium tracking-wide text-muted mb-2">Modules</p>
<div className="grid gap-2 sm:grid-cols-2">
{MODULES.map((id) => {
const on = modules.includes(id);
const meta = MODULE_META[id];
return (
<button
key={id}
type="button"
onClick={() => toggle(id)}
className={cn(
"text-left rounded-xl p-3.5 transition-[box-shadow,background-color] duration-150 min-h-16",
on
? "bg-surface-2 shadow-[var(--shadow-border-hover)]"
: "shadow-[var(--shadow-border)] hover:bg-surface-2/60",
)}
>
<div className="flex items-center justify-between gap-2">
<span className="text-sm font-medium text-fg">{meta.title}</span>
<span
className={cn(
"size-4 rounded-full border",
on ? "bg-accent border-accent" : "border-border-strong",
)}
/>
</div>
<p className="mt-1 text-xs text-muted leading-5">{meta.blurb}</p>
</button>
);
})}
</div>
</div>

{error ? <p className="text-sm text-danger">{error}</p> : null}

<Button type="submit" size="lg" className="w-full md:w-auto" disabled={busy}>
<Play className="size-4" />
Run engagement
</Button>
</form>
);
}

function Field({
label,
htmlFor,
children,
className,
}: {
label: string;
htmlFor: string;
children: ReactNode;
className?: string;
}) {
return (
<div className={cn("flex flex-col gap-1.5", className)}>
<Label htmlFor={htmlFor}>{label}</Label>
{children}
</div>
);
}