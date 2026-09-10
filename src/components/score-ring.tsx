import { cn } from "@/lib/utils";

export function ScoreRing({
value,
label,
size = 88,
}: {
value: number;
label: string;
size?: number;
}) {
const r = 28;
const c = 2 * Math.PI * r;
const clamped = Math.max(0, Math.min(100, value));
const dash = (clamped / 100) * c;
return (
<div className="flex flex-col items-center gap-1.5" style={{ width: size }}>
<svg width={size} height={size} viewBox="0 0 72 72" className="text-fg">
<circle
cx="36"
cy="36"
r={r}
fill="none"
stroke="currentColor"
className="text-surface-2"
strokeWidth="6"
/>
<circle
cx="36"
cy="36"
r={r}
fill="none"
stroke="currentColor"
className={cn(clamped >= 70 ? "text-ok" : clamped >= 40 ? "text-accent" : "text-warn")}
strokeWidth="6"
strokeLinecap="round"
strokeDasharray={`${dash} ${c - dash}`}
transform="rotate(-90 36 36)"
/>
<text
x="36"
y="40"
textAnchor="middle"
className="fill-fg font-sans"
fontSize="14"
fontWeight="600"
>
{clamped}
</text>
</svg>
<span className="text-[11px] uppercase tracking-wide text-muted">{label}</span>
</div>
);
}