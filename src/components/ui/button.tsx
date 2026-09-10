import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
"inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[opacity,transform,background-color,box-shadow,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-40 active:enabled:scale-[0.96] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
{
variants: {
variant: {
default: "bg-fg text-bg hover:opacity-90",
accent: "bg-accent text-accent-fg hover:opacity-90",
outline:
"bg-transparent text-fg shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)] hover:bg-surface-2",
ghost: "text-muted hover:text-fg hover:bg-surface-2",
danger: "bg-danger/90 text-fg hover:opacity-90",
},
size: {
default: "h-11 min-h-11 px-4 rounded-lg text-sm",
sm: "h-9 min-h-9 px-3 rounded-md text-sm",
lg: "h-12 min-h-12 px-5 rounded-xl text-sm",
icon: "size-11 min-h-11 rounded-lg",
},
},
defaultVariants: { variant: "default", size: "default" },
},
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
VariantProps<typeof buttonVariants> & { asChild?: boolean };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
({ className, variant, size, asChild, ...props }, ref) => {
const Comp = asChild ? Slot : "button";
return (
<Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
);
},
);
Button.displayName = "Button";

export { buttonVariants };