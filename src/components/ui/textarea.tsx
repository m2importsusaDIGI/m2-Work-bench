import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
({ className, ...props }, ref) => (
<textarea
ref={ref}
className={cn(
"flex min-h-32 w-full rounded-lg bg-surface-2 px-3 py-2.5 text-base text-fg shadow-[var(--shadow-border)]",
"placeholder:text-subtle outline-none transition-[box-shadow] duration-150",
"focus-visible:ring-2 focus-visible:ring-accent/30",
className,
)}
{...props}
/>
),
);
Textarea.displayName = "Textarea";