import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
({ className, type = "text", ...props }, ref) => (
<input
type={type}
ref={ref}
className={cn(
"flex h-11 w-full rounded-lg bg-surface-2 px-3 text-base text-fg shadow-[var(--shadow-border)]",
"placeholder:text-subtle outline-none transition-[box-shadow] duration-150",
"focus-visible:shadow-[var(--shadow-border-hover)] focus-visible:ring-2 focus-visible:ring-accent/30",
"disabled:opacity-50",
className,
)}
{...props}
/>
),
);
Input.displayName = "Input";