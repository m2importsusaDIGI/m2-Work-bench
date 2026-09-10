import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
return twMerge(clsx(inputs));
}

export function nid(prefix = "wb") {
return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36)}`;
}

export function formatClock(iso: string) {
const d = new Date(iso);
return d.toLocaleTimeString([], {
hour: "2-digit",
minute: "2-digit",
second: "2-digit",
hour12: false,
});
}

export function formatDate(iso: string) {
return new Date(iso).toLocaleString([], {
month: "short",
day: "numeric",
hour: "2-digit",
minute: "2-digit",
});
}

export function kb(bytes: number) {
if (bytes < 1024) return `${bytes} B`;
if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function clamp(n: number, min = 0, max = 100) {
return Math.max(min, Math.min(max, Math.round(n)));
}

export async function downloadBlob(filename: string, contents: string, mime: string) {
const blob = new Blob([contents], { type: mime });
const file = new File([blob], filename, { type: mime });
const nav = navigator as Navigator & {
canShare?: (data: ShareData) => boolean;
};
if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
try {
await nav.share({ files: [file], title: filename });
return "shared" as const;
} catch (err) {
if (err instanceof Error && err.name === "AbortError") return "aborted" as const;
}
}
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = filename;
a.rel = "noopener";
document.body.appendChild(a);
a.click();
a.remove();
window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
return "downloaded" as const;
}

export async function copyText(text: string): Promise<"copied" | "failed"> {
try {
if (navigator.clipboard?.writeText) {
await Promise.race([
navigator.clipboard.writeText(text),
new Promise<never>((_, reject) => {
window.setTimeout(() => reject(new Error("clipboard timeout")), 1500);
}),
]);
return "copied";
}
} catch {
/* fall through */
}
try {
const active = document.activeElement;
const reuse =
(active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) &&
active.value === text
? active
: null;
const ta = reuse ?? document.createElement("textarea");
if (!reuse) {
ta.value = text;
ta.setAttribute("readonly", "");
ta.style.cssText =
"position:fixed;top:0;left:0;opacity:0.01;width:1px;height:1px;padding:0;border:0;font-size:16px;";
document.body.appendChild(ta);
}
ta.focus();
ta.select();
ta.setSelectionRange(0, text.length);
const ok = document.execCommand("copy");
if (!reuse) ta.remove();
if (ok) return "copied";
} catch {
/* fall through */
}
return "failed";
}

export function slug(s: string) {
return s
.toLowerCase()
.replace(/[^a-z0-9]+/g, "-")
.replace(/(^-|-$)/g, "")
.slice(0, 48);
}

export function normalizeUrl(raw: string) {
const t = raw.trim();
if (!t) return t;
if (!/^https?:\/\//i.test(t)) return `https://${t}`;
return t;
}