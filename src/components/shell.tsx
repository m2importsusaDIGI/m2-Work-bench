import { Link, useRouterState } from "@tanstack/react-router";
import { FileBarChart, LayoutDashboard, ListTodo, Cpu, ScanSearch, Users } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { Wordmark } from "@/components/mark";
import { useWorkbench } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV = [
{ to: "/", label: "Dashboard", icon: LayoutDashboard },
{ to: "/queue", label: "Queue", icon: ListTodo },
{ to: "/crm", label: "CRM", icon: Users },
{ to: "/audit", label: "Audit", icon: ScanSearch },
{ to: "/reports", label: "Reports", icon: FileBarChart },
{ to: "/modules", label: "Modules", icon: Cpu },
] as const;

export function Shell({ children }: { children: ReactNode }) {
const pathname = useRouterState({ select: (s) => s.location.pathname });
const jobs = useWorkbench((s) => s.jobs);
const running = jobs.filter((j) => j.status === "running" || j.status === "queued").length;
const setHydrated = useWorkbench((s) => s.setHydrated);

useEffect(() => {
void useWorkbench.persist.rehydrate();
return useWorkbench.persist.onFinishHydration(() => setHydrated());
}, [setHydrated]);

return (
<div className="min-h-dvh bg-bg text-fg flex">
<aside className="hidden md:flex w-[232px] shrink-0 flex-col border-r border-border px-4 py-5 sticky top-0 h-dvh">
<Link to="/" className="mb-8">
<Wordmark />
</Link>
<nav className="flex flex-col gap-1">
{NAV.map((item) => {
const active =
item.to === "/"
? pathname === "/"
: pathname === item.to || pathname.startsWith(item.to + "/");
const Icon = item.icon;
return (
<Link
key={item.to}
to={item.to}
className={cn(
"flex items-center gap-2.5 h-11 px-3 rounded-lg text-sm transition-colors",
active ? "bg-surface-2 text-fg" : "text-muted hover:text-fg hover:bg-surface",
)}
>
<Icon className="size-4" />
{item.label}
{item.to === "/queue" && running > 0 ? (
<span className="ml-auto tabular-nums text-[11px] text-accent">{running}</span>
) : null}
</Link>
);
})}
</nav>
<div className="mt-auto px-1 space-y-3">
<Link
to="/handoff"
className={cn(
"flex items-center h-10 px-2 rounded-lg text-[12px] transition-colors",
pathname === "/handoff" ? "bg-surface-2 text-fg" : "text-muted hover:text-fg hover:bg-surface",
)}
>
Copy source for Claude
</Link>
<p className="text-[11px] leading-5 text-subtle">
Execution console for schema, local SEO, leads, and outreach.
</p>
</div>
</aside>

<div className="flex-1 min-w-0 flex flex-col">
<header className="md:hidden sticky top-0 z-20 bg-bg/90 backdrop-blur-sm border-b border-border px-4 h-14 flex items-center justify-between gap-3">
<Link to="/">
<Wordmark compact />
</Link>
<Link
to="/handoff"
className={cn(
"h-9 min-h-9 px-3 inline-flex items-center rounded-lg text-xs font-medium",
pathname === "/handoff" ? "bg-surface-2 text-fg" : "text-accent",
)}
>
Copy source
</Link>
</header>
<main className="flex-1 px-4 py-5 md:px-8 md:py-8 pb-28 md:pb-10">{children}</main>
</div>

<nav
className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-bg/95 backdrop-blur-sm"
style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
>
<div className="grid grid-cols-6 h-16">
{NAV.map((item) => {
const active =
item.to === "/"
? pathname === "/"
: pathname === item.to || pathname.startsWith(item.to + "/");
const Icon = item.icon;
return (
<Link
key={item.to}
to={item.to}
className={cn(
"flex flex-col items-center justify-center gap-1 text-[11px]",
active ? "text-fg" : "text-muted",
)}
>
<Icon className="size-5" />
{item.label}
</Link>
);
})}
</div>
</nav>
<Toaster
theme="dark"
position="bottom-center"
offset={{ bottom: 24 }}
mobileOffset={{ bottom: 88 }}
toastOptions={{
style: {
background: "#141614",
color: "#f2f0e9",
border: "1px solid rgba(242,240,233,0.12)",
},
}}
/>
</div>
);
}