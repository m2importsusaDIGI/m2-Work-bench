import { useMemo, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, ChevronUp, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useWorkbench } from "@/lib/store";
import {
PIPELINE_STAGES,
STAGE_LABEL,
type Contact,
type PipelineStage,
type ProspectHit,
type TaskChannel,
} from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

export const Route = createFileRoute("/crm")({ component: CrmPage });

const STAGE_TONE: Record<PipelineStage, "muted" | "accent" | "ok" | "warn" | "danger"> = {
prospecting: "muted",
contacted: "accent",
qualified: "warn",
won: "ok",
lost: "danger",
};

function CrmPage() {
const contacts = useWorkbench((s) => s.contacts);
const [showNew, setShowNew] = useState(false);
const [showProspect, setShowProspect] = useState(false);

const byStage = useMemo(() => {
const map: Record<PipelineStage, Contact[]> = {
prospecting: [],
contacted: [],
qualified: [],
won: [],
lost: [],
};
for (const c of contacts) map[c.stage].push(c);
return map;
}, [contacts]);

return (
<div className="mx-auto max-w-6xl">
<div className="flex items-end justify-between gap-3 flex-wrap">
<div>
<p className="text-xs uppercase tracking-[0.16em] text-muted">Relationships</p>
<h1 className="font-display text-3xl md:text-4xl tracking-tight mt-1">CRM</h1>
</div>
<div className="flex gap-2">
<Button size="sm" variant={showProspect ? "outline" : "accent"} onClick={() => setShowProspect((v) => !v)}>
<Search className={cn("transition-transform", showProspect && "rotate-90")} />
{showProspect ? "Close" : "Find prospects"}
</Button>
<Button size="sm" variant={showNew ? "outline" : "outline"} onClick={() => setShowNew((v) => !v)}>
<Plus className={cn("transition-transform", showNew && "rotate-45")} />
{showNew ? "Close" : "New contact"}
</Button>
</div>
</div>

{showProspect ? <ProspectSearch onDone={() => setShowProspect(false)} /> : null}
{showNew ? <NewContactForm onDone={() => setShowNew(false)} /> : null}

<FollowUpsDue />

{contacts.length === 0 ? (
<div className="mt-6 rounded-2xl bg-surface p-8 shadow-[var(--shadow-border)] text-center">
<p className="text-muted">No contacts yet.</p>
<p className="text-xs text-subtle mt-1">
Add one above, or use “Add to CRM” from a job's Leads or Outreach tab.
</p>
</div>
) : (
<div className="mt-6 grid grid-cols-1 md:grid-cols-5 gap-4">
{PIPELINE_STAGES.map((stage) => (
<div key={stage} className="min-w-0">
<div className="flex items-center gap-2 px-1 mb-2">
<h2 className="text-xs uppercase tracking-wide text-muted">{STAGE_LABEL[stage]}</h2>
<span className="text-[11px] text-subtle tabular-nums">{byStage[stage].length}</span>
</div>
<div className="flex flex-col gap-2">
{byStage[stage].map((c) => (
<ContactCard key={c.id} contact={c} />
))}
</div>
</div>
))}
</div>
)}
</div>
);
}

function FollowUpsDue() {
const tasks = useWorkbench((s) => s.tasks);
const contacts = useWorkbench((s) => s.contacts);
const toggleTask = useWorkbench((s) => s.toggleTask);

const due = useMemo(() => {
const now = Date.now();
return tasks
.filter((t) => !t.done)
.map((t) => ({ ...t, overdue: new Date(t.dueAt).getTime() < now }))
.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
.slice(0, 8);
}, [tasks]);

if (due.length === 0) return null;

return (
<div className="mt-6 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
<h2 className="text-xs uppercase tracking-wide text-muted mb-3">Follow-ups due</h2>
<ul className="flex flex-col gap-2">
{due.map((t) => {
const contact = contacts.find((c) => c.id === t.contactId);
return (
<li key={t.id} className="flex items-start gap-3 text-sm">
<input
type="checkbox"
checked={t.done}
onChange={() => toggleTask(t.id)}
className="mt-1 size-4 shrink-0 accent-accent"
/>
<div className="min-w-0 flex-1">
<div className="flex items-center gap-2 flex-wrap">
<span className="font-medium">{t.title}</span>
{contact ? <span className="text-xs text-muted">· {contact.businessName}</span> : null}
{t.overdue ? <Badge tone="danger">overdue</Badge> : null}
</div>
<p className="text-xs text-subtle mt-0.5">Due {formatDate(t.dueAt)}</p>
</div>
</li>
);
})}
</ul>
</div>
);
}

function ProspectSearch({ onDone }: { onDone: () => void }) {
const [niche, setNiche] = useState("");
const [location, setLocation] = useState("");
const prospecting = useWorkbench((s) => s.prospecting);
const prospectError = useWorkbench((s) => s.prospectError);
const prospectResults = useWorkbench((s) => s.prospectResults);
const searchProspects = useWorkbench((s) => s.searchProspects);
const importProspects = useWorkbench((s) => s.importProspects);
const contacts = useWorkbench((s) => s.contacts);
const [imported, setImported] = useState<{ added: number; skipped: number } | null>(null);

function submit(e: FormEvent) {
e.preventDefault();
if (!niche.trim() || !location.trim()) return;
setImported(null);
searchProspects(niche.trim(), location.trim());
}

function isKnown(hit: ProspectHit) {
const norm = (s: string) => s.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
return contacts.some(
(c) =>
(hit.websiteUrl && c.websiteUrl && norm(c.websiteUrl) === norm(hit.websiteUrl)) ||
norm(c.businessName) === norm(hit.businessName),
);
}

function addAll() {
const result = importProspects(prospectResults, niche.trim(), location.trim());
setImported(result);
}

return (
<div className="mt-4 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)] flex flex-col gap-3">
<form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
<div>
<Label htmlFor="pr-niche">Industry / niche</Label>
<Input
id="pr-niche"
className="mt-1.5"
placeholder="roofing"
value={niche}
onChange={(e) => setNiche(e.target.value)}
required
/>
</div>
<div>
<Label htmlFor="pr-loc">Location</Label>
<Input
id="pr-loc"
className="mt-1.5"
placeholder="Alexandria, VA"
value={location}
onChange={(e) => setLocation(e.target.value)}
required
/>
</div>
<Button type="submit" size="sm" disabled={prospecting}>
<Search />
{prospecting ? "Searching…" : "Search"}
</Button>
</form>

{prospectError ? (
<p className="text-xs text-danger">{prospectError}</p>
) : null}

{prospectResults.length > 0 ? (
<div className="flex flex-col gap-2">
<div className="flex items-center justify-between flex-wrap gap-2">
<p className="text-xs text-muted">
{prospectResults.length} found · no business name or website needed to search
</p>
<Button type="button" size="sm" variant="accent" onClick={addAll}>
Add all new to CRM
</Button>
</div>
{imported ? (
<p className="text-xs text-ok">
Added {imported.added} new contact{imported.added === 1 ? "" : "s"}
{imported.skipped > 0 ? ` · skipped ${imported.skipped} already in CRM` : ""}.
</p>
) : null}
<ul className="flex flex-col gap-1.5 max-h-80 overflow-y-auto">
{prospectResults.map((hit) => (
<li key={hit.placeId} className="flex items-start justify-between gap-2 text-xs bg-surface-2 rounded-lg px-2.5 py-2">
<div className="min-w-0">
<div className="font-medium truncate">{hit.businessName}</div>
<div className="text-subtle truncate">
{[hit.phone, hit.websiteUrl?.replace(/^https?:\/\//, ""), hit.address].filter(Boolean).join(" · ")}
</div>
{hit.socials.length > 0 ? (
<div className="text-subtle truncate mt-0.5">
{hit.socials.map((s) => s.network).join(", ")}
</div>
) : null}
</div>
{isKnown(hit) ? <Badge tone="muted">in CRM</Badge> : null}
</li>
))}
</ul>
</div>
) : null}

{!prospecting && prospectResults.length === 0 && !prospectError ? (
<p className="text-xs text-subtle">
Type an industry and a location — this searches by area, not a specific business, so you don't need a
name or website up front.
</p>
) : null}

<div className="flex justify-end">
<Button type="button" size="sm" variant="ghost" onClick={onDone}>
Done
</Button>
</div>
</div>
);
}

function NewContactForm({ onDone }: { onDone: () => void }) {
const addContact = useWorkbench((s) => s.addContact);
const [businessName, setBusinessName] = useState("");
const [contactName, setContactName] = useState("");
const [email, setEmail] = useState("");
const [phone, setPhone] = useState("");
const [websiteUrl, setWebsiteUrl] = useState("");
const [location, setLocation] = useState("");

function submit(e: FormEvent) {
e.preventDefault();
if (!businessName.trim()) return;
addContact({ businessName: businessName.trim(), contactName, email, phone, websiteUrl, location });
onDone();
}

return (
<form onSubmit={submit} className="mt-4 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)] grid grid-cols-1 sm:grid-cols-2 gap-3">
<div>
<Label htmlFor="cn-biz">Business name</Label>
<Input id="cn-biz" className="mt-1.5" value={businessName} onChange={(e) => setBusinessName(e.target.value)} required />
</div>
<div>
<Label htmlFor="cn-contact">Contact name</Label>
<Input id="cn-contact" className="mt-1.5" value={contactName} onChange={(e) => setContactName(e.target.value)} />
</div>
<div>
<Label htmlFor="cn-email">Email</Label>
<Input id="cn-email" type="email" className="mt-1.5" value={email} onChange={(e) => setEmail(e.target.value)} />
</div>
<div>
<Label htmlFor="cn-phone">Phone</Label>
<Input id="cn-phone" className="mt-1.5" value={phone} onChange={(e) => setPhone(e.target.value)} />
</div>
<div>
<Label htmlFor="cn-url">Website</Label>
<Input id="cn-url" className="mt-1.5" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
</div>
<div>
<Label htmlFor="cn-loc">Location</Label>
<Input id="cn-loc" className="mt-1.5" value={location} onChange={(e) => setLocation(e.target.value)} />
</div>
<div className="sm:col-span-2 flex justify-end">
<Button type="submit" size="sm">Add contact</Button>
</div>
</form>
);
}

function ContactCard({ contact }: { contact: Contact }) {
const setStage = useWorkbench((s) => s.setStage);
const removeContact = useWorkbench((s) => s.removeContact);
const [open, setOpen] = useState(false);

return (
<article className="rounded-xl bg-surface shadow-[var(--shadow-border)] overflow-hidden">
<button
type="button"
onClick={() => setOpen((v) => !v)}
className="w-full flex items-start gap-2 px-3 py-3 text-left"
>
<div className="min-w-0 flex-1">
<div className="font-medium text-sm truncate">{contact.businessName}</div>
{contact.location || contact.niche ? (
<div className="text-xs text-muted truncate">
{[contact.niche, contact.location].filter(Boolean).join(" · ")}
</div>
) : null}
</div>
{open ? <ChevronUp className="size-4 text-muted shrink-0" /> : <ChevronDown className="size-4 text-muted shrink-0" />}
</button>

{open ? (
<div className="px-3 pb-3 flex flex-col gap-3 border-t border-border pt-3">
<div className="flex items-center gap-2 flex-wrap">
<Badge tone={STAGE_TONE[contact.stage]}>{STAGE_LABEL[contact.stage]}</Badge>
<select
value={contact.stage}
onChange={(e) => setStage(contact.id, e.target.value as PipelineStage)}
className="h-8 rounded-md bg-surface-2 text-xs px-2 shadow-[var(--shadow-border)] outline-none"
>
{PIPELINE_STAGES.map((s) => (
<option key={s} value={s}>
Move to {STAGE_LABEL[s]}
</option>
))}
</select>
</div>

<dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
{contact.contactName ? (
<>
<dt className="text-subtle">Contact</dt>
<dd className="text-fg truncate">{contact.contactName}</dd>
</>
) : null}
{contact.email ? (
<>
<dt className="text-subtle">Email</dt>
<dd className="text-fg truncate">{contact.email}</dd>
</>
) : null}
{contact.phone ? (
<>
<dt className="text-subtle">Phone</dt>
<dd className="text-fg truncate">{contact.phone}</dd>
</>
) : null}
{contact.websiteUrl ? (
<>
<dt className="text-subtle">Website</dt>
<dd className="text-fg truncate">{contact.websiteUrl.replace(/^https?:\/\//, "")}</dd>
</>
) : null}
{contact.address ? (
<>
<dt className="text-subtle">Address</dt>
<dd className="text-fg truncate">{contact.address}</dd>
</>
) : null}
</dl>

{contact.socials.length > 0 ? (
<div className="flex flex-wrap gap-1.5">
{contact.socials.map((s) => (
<a
key={s.url}
href={s.url}
target="_blank"
rel="noreferrer"
className="text-[11px] rounded-full bg-surface-2 px-2 py-1 text-muted hover:text-fg"
>
{s.network}
</a>
))}
</div>
) : null}

<NotesField contact={contact} />
<TasksList contactId={contact.id} />

<div className="flex justify-end">
<Button
type="button"
size="sm"
variant="ghost"
className="text-danger hover:text-danger"
onClick={() => {
if (window.confirm(`Delete ${contact.businessName}? This also permanently deletes any reports/jobs run for this business.`)) {
removeContact(contact.id);
}
}}
>
<Trash2 />
Remove
</Button>
</div>
</div>
) : null}
</article>
);
}

function NotesField({ contact }: { contact: Contact }) {
const updateContact = useWorkbench((s) => s.updateContact);
const [value, setValue] = useState(contact.notes);

return (
<div>
<Label htmlFor={`notes-${contact.id}`}>Notes</Label>
<Textarea
id={`notes-${contact.id}`}
className="mt-1.5 min-h-20 text-sm"
value={value}
onChange={(e) => setValue(e.target.value)}
onBlur={() => {
if (value !== contact.notes) updateContact(contact.id, { notes: value });
}}
placeholder="Call notes, objections, next steps…"
/>
</div>
);
}

const CHANNELS: TaskChannel[] = ["email", "whatsapp", "call", "other"];

function TasksList({ contactId }: { contactId: string }) {
const allTasks = useWorkbench((s) => s.tasks);
const tasks = useMemo(() => allTasks.filter((t) => t.contactId === contactId), [allTasks, contactId]);
const addTask = useWorkbench((s) => s.addTask);
const toggleTask = useWorkbench((s) => s.toggleTask);
const removeTask = useWorkbench((s) => s.removeTask);
const [title, setTitle] = useState("");
const [dueAt, setDueAt] = useState("");
const [channel, setChannel] = useState<TaskChannel>("email");

function submit(e: FormEvent) {
e.preventDefault();
if (!title.trim() || !dueAt) return;
addTask({ contactId, title: title.trim(), channel, dueAt: new Date(dueAt).toISOString() });
setTitle("");
setDueAt("");
}

const sorted = [...tasks].sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

return (
<div>
<Label>Tasks &amp; follow-ups</Label>
{sorted.length > 0 ? (
<ul className="mt-1.5 flex flex-col gap-1.5">
{sorted.map((t) => (
<li key={t.id} className="flex items-center gap-2 text-xs bg-surface-2 rounded-lg px-2.5 py-2">
<input
type="checkbox"
checked={t.done}
onChange={() => toggleTask(t.id)}
className="size-3.5 shrink-0 accent-accent"
/>
<span className={cn("flex-1 min-w-0 truncate", t.done && "line-through text-subtle")}>
{t.title}
</span>
<span className="text-subtle shrink-0">{formatDate(t.dueAt)}</span>
<button
type="button"
onClick={() => removeTask(t.id)}
className="text-subtle hover:text-danger shrink-0"
aria-label="Remove task"
>
<Trash2 className="size-3.5" />
</button>
</li>
))}
</ul>
) : null}
<form onSubmit={submit} className="mt-2 flex flex-col sm:flex-row gap-2">
<Input
value={title}
onChange={(e) => setTitle(e.target.value)}
placeholder="Follow up about…"
className="h-9 text-sm flex-1"
/>
<select
value={channel}
onChange={(e) => setChannel(e.target.value as TaskChannel)}
className="h-9 rounded-lg bg-surface-2 text-xs px-2 shadow-[var(--shadow-border)] outline-none shrink-0"
>
{CHANNELS.map((c) => (
<option key={c} value={c}>
{c}
</option>
))}
</select>
<Input
type="date"
value={dueAt}
onChange={(e) => setDueAt(e.target.value)}
className="h-9 text-sm shrink-0 sm:w-36"
/>
<Button type="submit" size="sm" variant="outline" className="shrink-0">
Add
</Button>
</form>
</div>
);
}
