import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
return (
<img
src="/logo.webp"
alt="M2 Digital Solutions LLC"
className={cn("size-8 shrink-0 rounded-lg object-cover", className)}
/>
);
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
return (
<div className="flex items-center gap-2.5 min-w-0">
<Mark className="size-8 shrink-0" />
<div className="min-w-0 leading-tight">
<div className="font-display text-[15px] tracking-tight text-fg">M2 Workbench</div>
{!compact ? (
<div className="text-[11px] text-muted truncate">M2 Digital Solutions LLC</div>
) : null}
</div>
</div>
);
}