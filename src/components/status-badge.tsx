import { Badge } from "@/components/ui/badge";
import type { JobStatus } from "@/lib/types";

const TONE: Record<JobStatus, "muted" | "running" | "ok" | "danger"> = {
queued: "muted",
running: "running",
completed: "ok",
failed: "danger",
};

export function StatusBadge({ status }: { status: JobStatus }) {
return <Badge tone={TONE[status]}>{status}</Badge>;
}