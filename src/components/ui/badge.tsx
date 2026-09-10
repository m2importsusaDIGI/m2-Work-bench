import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
"inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide uppercase",
{
variants: {
tone: {
muted: "bg-surface-2 text-muted",
accent: "bg-accent/15 text-accent",
ok: "bg-ok/15 text-ok",
warn: "bg-warn/15 text-warn",
danger: "bg-danger/15 text-danger",
running: "bg-accent/15 text-accent",
},
},
defaultVariants: { tone: "muted" },
},
);

export function Badge({
className,
tone,
...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}