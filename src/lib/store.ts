import { create } from "zustand";
import { persist } from "zustand/middleware";
import { crawlTarget, runEngine, auditVisibility, findProspects } from "./fns";
import { MODULE_META } from "./modules";
import type {
Contact,
Job,
Lead,
LogChannel,
ModuleId,
PipelineStage,
ProspectHit,
Target,
Task,
TaskChannel,
} from "./types";
import { kb, nid, normalizeUrl } from "./utils";

const inFlight = new Set<string>();

function sameBusiness(a: { businessName: string; websiteUrl: string }, b: { businessName: string; websiteUrl: string }) {
const norm = (s: string) => s.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
if (a.websiteUrl && b.websiteUrl && norm(a.websiteUrl) === norm(b.websiteUrl)) return true;
return norm(a.businessName) === norm(b.businessName);
}

function normalizeChannel(channel: string): TaskChannel {
const c = channel.toLowerCase();
if (c === "email" || c === "whatsapp" || c === "call") return c;
return "other";
}

type State = {
jobs: Job[];
contacts: Contact[];
tasks: Task[];
hydrated: boolean;
setHydrated: () => void;
createJob: (target: Target, modules: ModuleId[]) => string;
appendLog: (id: string, channel: LogChannel, message: string) => void;
patch: (id: string, partial: Partial<Job>) => void;
run: (id: string) => Promise<void>;
remove: (id: string) => void;
clearCompleted: () => void;
addContact: (input: Partial<Contact> & { businessName: string }) => string;
updateContact: (id: string, partial: Partial<Contact>) => void;
removeContact: (id: string) => void;
setStage: (id: string, stage: PipelineStage) => void;
addContactFromLead: (lead: Lead, jobId: string) => string;
addContactFromTarget: (target: Target, jobId: string | null) => string;
prospecting: boolean;
prospectError: string | null;
prospectResults: ProspectHit[];
searchProspects: (niche: string, location: string) => Promise<void>;
importProspects: (hits: ProspectHit[], niche: string, location: string) => { added: number; skipped: number };
addTask: (input: {
contactId: string;
title: string;
body?: string;
channel?: TaskChannel;
dueAt: string;
}) => string;
toggleTask: (id: string) => void;
removeTask: (id: string) => void;
addFollowUpTasks: (
contactId: string,
followUps: { day: number; channel: string; body: string }[],
fromDate?: string,
) => void;
};

function patchJobs(jobs: Job[], id: string, partial: Partial<Job>): Job[] {
return jobs.map((j) => (j.id === id ? { ...j, ...partial } : j));
}

export const useWorkbench = create<State>()(
persist(
(set, get) => ({
jobs: [],
contacts: [],
tasks: [],
hydrated: false,
setHydrated: () => set({ hydrated: true }),
createJob: (target, modules) => {
const id = nid("job");
const job: Job = {
id,
target: { ...target, websiteUrl: normalizeUrl(target.websiteUrl) },
modules,
status: "queued",
logs: [
{
id: nid("log"),
t: new Date().toISOString(),
channel: "queue",
message: `Queued · ${modules.map((m) => MODULE_META[m].title).join(" · ")}`,
},
],
createdAt: new Date().toISOString(),
startedAt: null,
completedAt: null,
crawl: null,
visibility: null,
result: null,
error: null,
};
set({ jobs: [job, ...get().jobs].slice(0, 40) });
get().addContactFromTarget(job.target, id);
return id;
},
appendLog: (id, channel, message) => {
const line = {
id: nid("log"),
t: new Date().toISOString(),
channel,
message,
};
set({
jobs: get().jobs.map((j) =>
j.id === id ? { ...j, logs: [...j.logs, line].slice(-180) } : j,
),
});
},
patch: (id, partial) => set({ jobs: patchJobs(get().jobs, id, partial) }),
remove: (id) => set({ jobs: get().jobs.filter((j) => j.id !== id) }),
clearCompleted: () =>
set({
jobs: get().jobs.filter((j) => j.status === "running" || j.status === "queued"),
}),
addContact: (input) => {
const id = nid("contact");
const now = new Date().toISOString();
const contact: Contact = {
id,
businessName: input.businessName,
contactName: input.contactName ?? "",
email: input.email ?? "",
phone: input.phone ?? "",
websiteUrl: input.websiteUrl ?? "",
location: input.location ?? "",
niche: input.niche ?? "",
address: input.address ?? "",
socials: input.socials ?? [],
stage: input.stage ?? "prospecting",
notes: input.notes ?? "",
sourceJobId: input.sourceJobId ?? null,
createdAt: now,
updatedAt: now,
};
set({ contacts: [contact, ...get().contacts] });
return id;
},
updateContact: (id, partial) =>
set({
contacts: get().contacts.map((c) =>
c.id === id ? { ...c, ...partial, updatedAt: new Date().toISOString() } : c,
),
}),
removeContact: (id) => {
const contact = get().contacts.find((c) => c.id === id);
set({
contacts: get().contacts.filter((c) => c.id !== id),
tasks: get().tasks.filter((t) => t.contactId !== id),
jobs: contact
? get().jobs.filter(
(j) => !sameBusiness(contact, { businessName: j.target.businessName, websiteUrl: j.target.websiteUrl }),
)
: get().jobs,
});
},
setStage: (id, stage) => get().updateContact(id, { stage }),
addContactFromLead: (lead, jobId) => {
const candidate = { businessName: lead.name, websiteUrl: lead.website };
const existing = get().contacts.find((c) => sameBusiness(c, candidate));
if (existing) return existing.id;
return get().addContact({
businessName: lead.name,
websiteUrl: lead.website,
phone: lead.phone,
location: lead.city,
niche: lead.category,
notes: lead.gaps.length ? `Gaps: ${lead.gaps.join(", ")}` : "",
sourceJobId: jobId,
});
},
addContactFromTarget: (target, jobId) => {
const candidate = { businessName: target.businessName, websiteUrl: target.websiteUrl };
const existing = get().contacts.find((c) => sameBusiness(c, candidate));
if (existing) return existing.id;
return get().addContact({
businessName: target.businessName,
websiteUrl: target.websiteUrl,
phone: target.phone,
location: target.location,
niche: target.niche,
sourceJobId: jobId,
});
},
prospecting: false,
prospectError: null,
prospectResults: [],
searchProspects: async (niche, location) => {
set({ prospecting: true, prospectError: null, prospectResults: [] });
try {
const res = await findProspects({ data: { niche, location } });
if (!res.ok) {
set({ prospecting: false, prospectError: res.error ?? "Search failed.", prospectResults: [] });
return;
}
set({ prospecting: false, prospectResults: res.results });
} catch (err) {
set({
prospecting: false,
prospectError: err instanceof Error ? err.message : "Search failed.",
prospectResults: [],
});
}
},
importProspects: (hits, niche, location) => {
let added = 0;
let skipped = 0;
for (const hit of hits) {
const candidate = { businessName: hit.businessName, websiteUrl: hit.websiteUrl };
const existing = get().contacts.find((c) => sameBusiness(c, candidate));
if (existing) {
skipped += 1;
continue;
}
get().addContact({
businessName: hit.businessName,
websiteUrl: hit.websiteUrl,
phone: hit.phone,
address: hit.address,
socials: hit.socials,
location,
niche,
sourceJobId: null,
});
added += 1;
}
return { added, skipped };
},
addTask: (input) => {
const id = nid("task");
const task: Task = {
id,
contactId: input.contactId,
title: input.title,
body: input.body ?? "",
channel: input.channel ?? "other",
dueAt: input.dueAt,
done: false,
createdAt: new Date().toISOString(),
};
set({ tasks: [...get().tasks, task] });
return id;
},
toggleTask: (id) =>
set({
tasks: get().tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
}),
removeTask: (id) => set({ tasks: get().tasks.filter((t) => t.id !== id) }),
addFollowUpTasks: (contactId, followUps, fromDate) => {
const base = fromDate ? new Date(fromDate) : new Date();
const { addTask } = get();
for (const f of followUps) {
const due = new Date(base);
due.setDate(due.getDate() + f.day);
addTask({
contactId,
title: `Day ${f.day} follow-up · ${f.channel}`,
body: f.body,
channel: normalizeChannel(f.channel),
dueAt: due.toISOString(),
});
}
},
run: async (id) => {
if (inFlight.has(id)) return;
const job = get().jobs.find((j) => j.id === id);
if (!job) return;
inFlight.add(id);
const { appendLog, patch } = get();
patch(id, {
status: "running",
startedAt: new Date().toISOString(),
error: null,
});
try {
appendLog(id, "queue", "Worker claimed the job");
appendLog(id, "crawl", `GET ${job.target.websiteUrl}`);
const crawl = await crawlTarget({ data: { url: job.target.websiteUrl } });
patch(id, { crawl });
if (crawl.ok) {
appendLog(
id,
"crawl",
`HTTP ${crawl.status} · ${kb(crawl.bytes)} · ${crawl.elapsedMs}ms · ${crawl.finalUrl}`,
);
} else {
appendLog(
id,
"error",
crawl.error || "Crawl failed — continuing with intake fields",
);
}
appendLog(
id,
"parse",
`Title “${crawl.title || "—"}” · ${crawl.jsonLdCount} JSON-LD block${crawl.jsonLdCount === 1 ? "" : "s"} · ${crawl.jsonLdTypes.join(", ") || "none"}`,
);
if (crawl.gaps[0]) appendLog(id, "parse", `Gap: ${crawl.gaps[0]}`);
if (crawl.gaps[1]) appendLog(id, "parse", `Gap: ${crawl.gaps[1]}`);

for (const m of job.modules) {
const channel =
m === "schema"
? "schema"
: m === "local"
? "local"
: m === "visibility"
? "visibility"
: m === "leads"
? "leads"
: "outreach";
appendLog(id, channel, `${MODULE_META[m].log}…`);
}

let visibility = null as Awaited<ReturnType<typeof auditVisibility>> | null;
if (job.modules.includes("visibility")) {
appendLog(id, "visibility", "Checking sitemap, blog/news, social, news index, Wikipedia, and the open web");
visibility = await auditVisibility({ data: { target: job.target, crawl } });
patch(id, { visibility });
const linked = visibility.social.filter((s) => s.status === "linked" || s.status === "live").length;
const mentions = visibility.mentions?.length ?? 0;
appendLog(
id,
"visibility",
`Mentions ${mentions} off-site · social ${linked} live · sitemap ${visibility.sitemapUrls} URLs · ${visibility.articleUrls} article-like · score ${visibility.score}`,
);
if (visibility.backlinks[0]) {
appendLog(id, "visibility", `Top move: ${visibility.backlinks[0].channel}`);
}
}

appendLog(id, "schema", "Compiling JSON-LD + local pack + visibility + outreach");
const result = await runEngine({
data: { target: job.target, modules: job.modules, crawl, visibility },
});
patch(id, { result });

if (job.modules.includes("schema")) {
appendLog(
id,
"schema",
`Wrote ${result.schema.blocks.length} blocks · missing ${result.schema.missing.join(", ") || "none"}`,
);
}
if (job.modules.includes("local")) {
appendLog(
id,
"local",
`NAP ${result.local.nap.issues.length ? "issues: " + result.local.nap.issues[0] : "aligned"} · GBP ${result.local.gbpDescription.length} chars`,
);
}
if (job.modules.includes("leads")) {
appendLog(
id,
"leads",
result.leads.length
? `Scored ${result.leads.length} prospect candidates in ${job.target.location}`
: `No directory API — stored ${result.leadQueries.length} search queries instead`,
);
}
if (job.modules.includes("outreach")) {
appendLog(
id,
"outreach",
`Email “${result.outreach.emailSubject}” + WhatsApp + 2 follow-ups`,
);
}
if (job.modules.includes("visibility") && result.visibility) {
appendLog(
id,
"visibility",
`${result.visibility.backlinks.length} backlink moves queued · content ${result.visibility.contentScore} · social ${result.visibility.socialScore} · video ${result.visibility.videoScore}`,
);
}
appendLog(
id,
"report",
`Work Completion Report ready · overall ${result.scores.before.overall} → ${result.scores.after.overall}${result.usedAi ? "" : " · template engine (AI unavailable)"}`,
);
patch(id, { status: "completed", completedAt: new Date().toISOString() });
} catch (err) {
const message = err instanceof Error ? err.message : "Engine failed";
appendLog(id, "error", message);
patch(id, {
status: "failed",
error: message,
completedAt: new Date().toISOString(),
});
} finally {
inFlight.delete(id);
}
},
}),
{
name: "m2-workbench-v1",
skipHydration: true,
partialize: (s) => ({ jobs: s.jobs, contacts: s.contacts, tasks: s.tasks }),
onRehydrateStorage: () => (state) => {
state?.setHydrated();
},
},
),
);