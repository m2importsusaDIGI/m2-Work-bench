import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppErrorComponent({ error, reset }: ErrorComponentProps) {
return (
<main className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 py-16 text-center bg-bg text-fg">
<span className="text-danger" aria-hidden="true">
<TriangleAlert className="size-10" strokeWidth={2} />
</span>
<h1 className="text-lg font-semibold">Something went wrong</h1>
<p className="max-w-md text-sm break-words text-muted leading-6">
{error.message || "An unexpected error occurred. Try reloading the page."}
</p>
<div className="mt-4 flex flex-wrap items-center justify-center gap-2">
<Button type="button" onClick={() => reset()}>
Try again
</Button>
<Button type="button" variant="outline" asChild>
<Link to="/">Dashboard</Link>
</Button>
</div>
</main>
);
}