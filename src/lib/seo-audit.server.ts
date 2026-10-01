import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { publicUrl } from "./crawl.server";
import type { SeoAuditReport } from "./types";

// Runs seo-engine/m2_audit.py (keyless Claude SEO checks) and returns its JSON.
// Paths are overridable so the same code works in Docker and on a laptop:
//   SEO_ENGINE_PYTHON   python binary (default: python3, or "python" on Windows)
//   SEO_ENGINE_SCRIPT   path to m2_audit.py
//   CLAUDE_SEO_SCRIPTS  path to claude-seo/scripts (read by m2_audit.py)
//   PSI_API_KEY         optional Google key for PageSpeed quota

const TIMEOUT_MS = 150_000;
const MAX_OUTPUT = 8_000_000;

function enginePaths() {
const script =
process.env.SEO_ENGINE_SCRIPT || path.join(process.cwd(), "seo-engine", "m2_audit.py");
const python =
process.env.SEO_ENGINE_PYTHON || (process.platform === "win32" ? "python" : "python3");
return { script, python };
}

export async function runSeoAudit(input: { url: string; pagespeed?: boolean }): Promise<SeoAuditReport> {
// Same SSRF guard as the crawler; the Python side re-checks with DNS pinning.
const target = publicUrl(input.url).toString();
const { script, python } = enginePaths();
if (!existsSync(script)) {
throw new Error(
"SEO engine not installed on this server (seo-engine/m2_audit.py missing). Redeploy with the updated Dockerfile.",
);
}

const args = [script, target, "--json"];
if (input.pagespeed) args.push("--psi");

return new Promise<SeoAuditReport>((resolve, reject) => {
const child = spawn(python, args, {
env: { ...process.env, PYTHONIOENCODING: "utf-8" },
stdio: ["ignore", "pipe", "pipe"],
});
let out = "";
let err = "";
let done = false;
const finish = (fn: () => void) => {
if (done) return;
done = true;
clearTimeout(timer);
fn();
};
const timer = setTimeout(() => {
child.kill("SIGKILL");
finish(() => reject(new Error("SEO audit timed out after 150 seconds.")));
}, TIMEOUT_MS);

child.stdout.on("data", (chunk: Buffer) => {
out += chunk.toString("utf8");
if (out.length > MAX_OUTPUT) {
child.kill("SIGKILL");
finish(() => reject(new Error("SEO audit output was too large.")));
}
});
child.stderr.on("data", (chunk: Buffer) => {
err = (err + chunk.toString("utf8")).slice(-4000);
});
child.on("error", (e) =>
finish(() =>
reject(new Error(`Could not start Python (${python}): ${e.message}. Is Python 3.10+ installed?`)),
),
);
child.on("close", (code) =>
finish(() => {
if (code !== 0) {
return reject(new Error(`SEO engine exited with ${code}: ${err.trim().split("\n").pop() ?? ""}`));
}
try {
resolve(JSON.parse(out) as SeoAuditReport);
} catch {
reject(new Error("SEO engine returned unreadable output."));
}
}),
);
});
}
