#!/usr/bin/env python3
"""
M2 SEO audit engine.

Runs a set of keyless checks from Claude SEO (github.com/AgriciDaniel/claude-seo,
MIT licensed) against one live URL and returns a single JSON document of
findings. No AI key is needed. Used two ways:

  * by the Workbench server (src/lib/seo-audit.server.ts), which reads --json
  * standalone from Windows via tools/M2-SEO-Audit.bat, which writes --html

Usage:
    python m2_audit.py https://example.com --json
    python m2_audit.py https://example.com --html report.html
    python m2_audit.py https://example.com --json --psi        # adds PageSpeed

Where Claude SEO lives: --scripts-dir, else $CLAUDE_SEO_SCRIPTS, else
./vendor/claude-seo/scripts next to this file.

Honesty rules (match the Workbench): every finding comes from the live site
or a Google API response. There is no invented 0-100 "health score".
"""
from __future__ import annotations

import argparse
import datetime as _dt
import html as _html
import json
import os
import re
import sys
import time
from typing import Any, Callable, Optional
from urllib.parse import urlparse

ENGINE_VERSION = "1.0.0"
HERE = os.path.dirname(os.path.abspath(__file__))

SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}

# Schema.org types that count as a local business for the Local checks.
LOCAL_TYPES = {
    "localbusiness", "autorepair", "autodealer", "autobodyshop", "autopartsstore",
    "autorental", "autowash", "gasstation", "motorcycledealer", "motorcyclerepair",
    "automotivebusiness", "restaurant", "foodestablishment", "cafeorcoffeeshop",
    "bakery", "barorpub", "fastfoodrestaurant", "store", "professionalservice",
    "legalservice", "attorney", "dentist", "medicalbusiness", "physician",
    "homeandconstructionbusiness", "electrician", "plumber", "hvacbusiness",
    "roofingcontractor", "generalcontractor", "housepainter", "locksmith",
    "movingcompany", "healthandbeautybusiness", "beautysalon", "hairsalon",
    "dayspa", "nailsalon", "sportsactivitylocation", "exercisegym",
    "financialservice", "accountingservice", "insuranceagency",
    "realestateagent", "lodgingbusiness", "hotel", "emergencyservice",
    "animalshelter", "childcare", "drycleaningorlaundry", "travelagency",
    "employmentagency", "entertainmentbusiness", "shoppingcenter",
}

PHONE_RE = re.compile(
    r"(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}|\+\d{2}\s?\d{2}\s?\d{4,5}[-\s]?\d{4}"
)
SECURITY_HEADERS = {
    "strict-transport-security": "HSTS",
    "content-security-policy": "Content-Security-Policy",
    "x-content-type-options": "X-Content-Type-Options",
    "referrer-policy": "Referrer-Policy",
}


# ---------------------------------------------------------------- loading


def load_claude_seo(scripts_dir: Optional[str]) -> str:
    candidates = [
        scripts_dir,
        os.environ.get("CLAUDE_SEO_SCRIPTS"),
        os.path.join(HERE, "vendor", "claude-seo", "scripts"),
    ]
    for c in candidates:
        if c and os.path.isfile(os.path.join(c, "url_safety.py")):
            if c not in sys.path:
                sys.path.insert(0, c)
            return c
    raise SystemExit(
        "Claude SEO scripts not found. Run setup (tools/M2-SEO-Audit.bat does it "
        "for you) or pass --scripts-dir /path/to/claude-seo/scripts."
    )


# ---------------------------------------------------------------- helpers


class Findings:
    def __init__(self) -> None:
        self.items: list[dict] = []

    def add(self, cid: str, category: str, severity: str, title: str,
            detail: str = "", fix: str = "", evidence: Any = None) -> None:
        self.items.append({
            "id": cid, "category": category, "severity": severity, "title": title,
            "detail": detail, "fix": fix, "evidence": evidence,
        })

    def sorted(self) -> list[dict]:
        return sorted(self.items, key=lambda f: (SEVERITY_ORDER.get(f["severity"], 9), f["category"]))


def run_step(name: str, fn: Callable[[], Any], log: list) -> Any:
    t0 = time.time()
    try:
        out = fn()
        log.append({"step": name, "ok": True, "ms": int((time.time() - t0) * 1000)})
        return out
    except Exception as exc:  # one broken check must not sink the audit
        log.append({"step": name, "ok": False, "ms": int((time.time() - t0) * 1000),
                    "error": f"{type(exc).__name__}: {exc}"})
        return None


def _types_of(item: dict) -> list[str]:
    t = item.get("@type")
    if isinstance(t, list):
        return [str(x) for x in t]
    return [str(t)] if t else []


def _walk_schema(items: list) -> list[dict]:
    out: list[dict] = []
    stack = list(items)
    while stack:
        it = stack.pop()
        if isinstance(it, dict):
            out.append(it)
            for v in it.values():
                if isinstance(v, (dict, list)):
                    stack.append(v)
        elif isinstance(it, list):
            stack.extend(it)
    return out


def _digits(s: str) -> str:
    d = re.sub(r"\D", "", s or "")
    return d[-10:] if len(d) >= 10 else d


def visible_text(html_text: str) -> str:
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html_text, "html.parser")
    for el in soup(["script", "style", "noscript", "svg", "template"]):
        el.decompose()
    return soup.get_text(" ", strip=True)


# ---------------------------------------------------------------- checks


def check_fetch(fetch: dict, url: str, f: Findings) -> None:
    if fetch.get("error") or not fetch.get("status_code"):
        f.add("fetch-failed", "Technical", "critical", "Homepage could not be fetched",
              detail=str(fetch.get("error") or "No response"),
              fix="Confirm the site is up and not blocking normal browsers or bots.")
        return
    status = fetch["status_code"]
    if status >= 400:
        f.add("http-status", "Technical", "critical", f"Homepage returns HTTP {status}",
              fix="The homepage must return 200 for Google to index it.")
    final = fetch.get("url") or url
    if urlparse(final).scheme != "https":
        f.add("no-https", "Technical", "high", "Site does not end on HTTPS",
              evidence={"final_url": final},
              fix="Force HTTPS with a 301 redirect and a valid certificate.")
    chain = fetch.get("redirect_chain") or []
    if len(chain) > 1:
        f.add("redirect-chain", "Technical", "medium",
              f"{len(chain)} redirects before the homepage loads",
              evidence={"chain": chain + [final]},
              fix="Point links and the canonical at the final URL; collapse to one 301.")
    headers = {k.lower(): v for k, v in (fetch.get("headers") or {}).items()}
    missing = [label for key, label in SECURITY_HEADERS.items() if key not in headers]
    if missing:
        f.add("security-headers", "Technical", "low",
              f"Missing security headers: {', '.join(missing)}",
              evidence={"missing": missing},
              fix="Add them at the host or CDN. HSTS matters most once HTTPS is solid.")
    xrt = headers.get("x-robots-tag", "")
    if "noindex" in xrt.lower():
        f.add("x-robots-noindex", "Technical", "critical",
              "X-Robots-Tag header says noindex", evidence={"x-robots-tag": xrt},
              fix="Remove noindex from the server response for public pages.")


def check_onpage(p: dict, html_text: str, final_url: str, f: Findings) -> None:
    title = (p.get("title") or "").strip()
    if not title:
        f.add("title-missing", "On-page", "high", "No <title> tag",
              fix="Add a title: primary service + city + brand, about 50-60 characters.")
    elif len(title) > 65:
        f.add("title-long", "On-page", "low", f"Title is {len(title)} characters",
              evidence={"title": title}, fix="Google usually truncates past ~60 characters.")
    elif len(title) < 20:
        f.add("title-short", "On-page", "medium", f"Title is only {len(title)} characters",
              evidence={"title": title}, fix="Include the main service and city.")

    desc = (p.get("meta_description") or "").strip()
    if not desc:
        f.add("meta-desc-missing", "On-page", "medium", "No meta description",
              fix="Write 140-160 characters that sell the click and name the city.")
    elif len(desc) > 170:
        f.add("meta-desc-long", "On-page", "low", f"Meta description is {len(desc)} characters",
              evidence={"meta_description": desc})

    robots = (p.get("meta_robots") or "").lower()
    if "noindex" in robots:
        f.add("meta-noindex", "Technical", "critical", "Homepage has meta robots noindex",
              evidence={"meta_robots": p.get("meta_robots")},
              fix="Remove noindex or Google will drop the page.")

    h1 = p.get("h1") or []
    if not h1:
        f.add("h1-missing", "On-page", "high", "No H1 heading",
              fix="Add one H1 that names the main service and location.")
    elif len(h1) > 1:
        f.add("h1-multiple", "On-page", "low", f"{len(h1)} H1 headings",
              evidence={"h1": h1[:6]}, fix="Keep a single H1; demote the rest to H2.")

    canonical = p.get("canonical")
    if not canonical:
        f.add("canonical-missing", "Technical", "medium", "No canonical tag",
              fix="Add <link rel=\"canonical\"> pointing at the preferred URL.")
    else:
        cu, fu = urlparse(canonical), urlparse(final_url)
        if cu.netloc and cu.netloc.lower() != fu.netloc.lower():
            f.add("canonical-offsite", "Technical", "high",
                  "Canonical points to a different host",
                  evidence={"canonical": canonical, "page": final_url},
                  fix="A cross-host canonical tells Google to index the other site instead.")

    lower = html_text.lower()
    if 'name="viewport"' not in lower and "name='viewport'" not in lower:
        f.add("viewport-missing", "Technical", "high", "No mobile viewport meta tag",
              fix="Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">.")
    if not re.search(r"<html[^>]*\blang=", html_text, re.I):
        f.add("lang-missing", "On-page", "low", "No lang attribute on <html>",
              fix="Add lang=\"en\" (or the site's language).")

    images = p.get("images") or []
    no_alt = [i["src"] for i in images if not (i.get("alt") or "").strip()]
    if images and no_alt:
        sev = "medium" if len(no_alt) / max(1, len(images)) > 0.3 else "low"
        f.add("img-alt", "On-page", sev, f"{len(no_alt)} of {len(images)} images lack alt text",
              evidence={"examples": no_alt[:5]},
              fix="Describe what the photo shows; include service or city where natural.")

    words = p.get("word_count") or 0
    if words < 250:
        f.add("thin-homepage", "Content", "medium", f"Homepage has ~{words} words of body text",
              fix="Add real copy: services, areas served, proof (reviews, years, certifications).")

    og = p.get("open_graph") or {}
    if not og.get("og:title") or not og.get("og:image"):
        f.add("og-missing", "On-page", "low", "Open Graph title or image missing",
              fix="Set og:title and og:image so shares on Facebook/WhatsApp show a card.")


def check_local(p: dict, text: str, f: Findings) -> dict:
    nodes = _walk_schema(p.get("schema") or [])
    all_types = sorted({t for n in nodes for t in _types_of(n)})
    local = [n for n in nodes if any(t.lower() in LOCAL_TYPES for t in _types_of(n))]
    page_phones = sorted({m.group(0).strip() for m in PHONE_RE.finditer(text)})
    summary = {"schema_types": all_types, "local_business_nodes": len(local),
               "phones_on_page": page_phones[:6]}

    if not nodes:
        f.add("schema-none", "Local & schema", "high", "No JSON-LD structured data",
              fix="Add LocalBusiness (or the closest subtype, e.g. AutoRepair) JSON-LD.")
    if not local:
        f.add("localbusiness-missing", "Local & schema", "high",
              "No LocalBusiness-type schema",
              evidence={"types_found": all_types},
              fix="Add a LocalBusiness subtype with name, address, telephone, geo, hours, url.")
        if not page_phones:
            f.add("phone-missing", "Local & schema", "high", "No phone number visible on homepage",
                  fix="Show a click-to-call number in the header and footer.")
        return summary

    lb = local[0]
    summary["local_business_type"] = _types_of(lb)
    want = {
        "name": "high", "address": "high", "telephone": "high",
        "geo": "medium", "openingHoursSpecification": "medium",
        "url": "low", "image": "low", "priceRange": "low",
    }
    missing = []
    for prop, sev in want.items():
        has = lb.get(prop) or (prop == "openingHoursSpecification" and lb.get("openingHours"))
        if not has:
            missing.append(prop)
    high_missing = [m for m in missing if want[m] == "high"]
    if missing:
        f.add("localbusiness-props", "Local & schema",
              "high" if high_missing else "medium",
              f"LocalBusiness schema missing: {', '.join(missing)}",
              evidence={"type": _types_of(lb), "missing": missing},
              fix="Fill these from the Google Business Profile so NAP matches exactly.")
    if not lb.get("sameAs"):
        f.add("sameas-missing", "Local & schema", "low", "No sameAs links in LocalBusiness",
              fix="List the GBP, Facebook, Instagram, Yelp URLs in sameAs.")

    tel = lb.get("telephone")
    if isinstance(tel, str) and page_phones:
        if _digits(tel) not in {_digits(x) for x in page_phones}:
            f.add("nap-phone-mismatch", "Local & schema", "high",
                  "Schema phone does not match any phone shown on the page",
                  evidence={"schema": tel, "page": page_phones[:4]},
                  fix="Use one phone number everywhere: site, schema, GBP, citations.")
    if lb.get("aggregateRating"):
        f.add("self-review-rating", "Local & schema", "medium",
              "aggregateRating on own LocalBusiness",
              detail="Google does not show review stars for self-serving LocalBusiness ratings.",
              evidence={"aggregateRating": lb.get("aggregateRating")},
              fix="Fine to keep, but don't promise stars in search results.")
    return summary


def check_sitemaps(sm: Optional[dict], f: Findings) -> None:
    if not sm:
        return
    if sm.get("error"):
        f.add("sitemap-error", "Technical", "low", "Sitemap discovery failed",
              detail=str(sm["error"]))
        return
    if not sm.get("found"):
        f.add("sitemap-missing", "Technical", "medium", "No XML sitemap found",
              evidence={"checked": sm.get("checked")},
              fix="Publish /sitemap.xml and reference it in robots.txt.")
    elif not sm.get("declared"):
        f.add("sitemap-undeclared", "Technical", "low", "Sitemap not listed in robots.txt",
              fix="Add a 'Sitemap: https://…/sitemap.xml' line to robots.txt.")


AGENTIC_PRIORITY = {"P0": "high", "P1": "medium", "P2": "low", "P3": "low"}


def check_agentic(rep: Optional[dict], f: Findings) -> None:
    if not rep:
        return
    for c in rep.get("checks") or []:
        if c.get("status") not in ("fail", "warn"):
            continue
        sev = AGENTIC_PRIORITY.get(c.get("priority"), "low")
        if c.get("status") == "warn" and sev != "low":
            sev = {"high": "medium", "medium": "low"}[sev]
        f.add(f"ai-{c.get('id')}", "AI search", sev, c.get("title") or c.get("id"),
              detail=c.get("standard") or "", fix=c.get("fix") or "",
              evidence=c.get("evidence"))


def check_preload(pre: Optional[dict], f: Findings) -> None:
    if not pre:
        return
    for i, rec in enumerate(pre.get("recommendations") or []):
        sev = "medium" if "bfcache" in rec.lower() else "low"
        f.add(f"perf-hint-{i}", "Performance", sev, rec.split(".")[0], fix=rec)


def check_content(cq: Optional[dict], f: Findings) -> None:
    if not cq:
        return
    flags = set(cq.get("flags") or []) - {"thin-content", "empty-input"}
    labels = {"filler": "Lots of filler phrases", "ai-patterns": "Reads like generic AI copy",
              "low-density": "Few concrete facts (names, numbers, places)",
              "repetitive": "Repetitive wording"}
    for fl in sorted(flags):
        f.add(f"content-{fl}", "Content", "low", labels.get(fl, fl),
              detail="Heuristic signal from text patterns, not a Google verdict.",
              evidence={k: cq.get(k) for k in ("filler_score", "ai_pattern_score",
                                               "information_density", "repetition_score")},
              fix="Rewrite with specifics: services, prices, brands, neighborhoods, proof.")


def check_psi(psi: Optional[dict], f: Findings) -> dict:
    out: dict = {}
    if not psi:
        return out
    for strat, r in (psi.get("psi") or {}).items():
        if not isinstance(r, dict) or r.get("error"):
            out[strat] = {"error": (r or {}).get("error")}
            continue
        scores = r.get("lighthouse_scores") or {}
        out[strat] = {"scores": scores, "metrics": r.get("lab_metrics")}
        perf = scores.get("performance")
        if isinstance(perf, (int, float)) and perf < 50:
            f.add(f"psi-{strat}-slow", "Performance", "high" if strat == "mobile" else "medium",
                  f"Lighthouse {strat} performance {int(perf)}/100 (lab)",
                  detail="Google PageSpeed Insights lab score, not field Core Web Vitals.",
                  fix="Compress hero images, defer third-party scripts, cache static assets.")
    return out


# ---------------------------------------------------------------- main audit


def audit(url: str, *, scripts_dir: Optional[str] = None, psi: bool = False) -> dict:
    load_claude_seo(scripts_dir)
    if "://" not in url:
        url = "https://" + url

    import fetch_page as _fp
    import parse_html as _ph

    log: list = []
    f = Findings()
    report: dict = {
        "engine": {"name": "m2-seo-audit", "version": ENGINE_VERSION,
                   "source": "Claude SEO (MIT) keyless checks"},
        "url": url,
        "checked_at": _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds"),
        "data": {},
    }

    fetch = run_step("fetch", lambda: _fp.fetch_page(url, timeout=25), log) or {"error": "fetch crashed"}
    check_fetch(fetch, url, f)
    final_url = fetch.get("url") or url
    report["final_url"] = final_url
    report["data"]["fetch"] = {"status_code": fetch.get("status_code"),
                               "redirect_chain": fetch.get("redirect_chain"),
                               "error": fetch.get("error")}
    html_text = fetch.get("content") or ""

    if html_text:
        parsed = run_step("parse", lambda: _ph.parse_html(html_text, final_url), log) or {}
        text = run_step("text", lambda: visible_text(html_text), log) or ""
        check_onpage(parsed, html_text, final_url, f)
        report["data"]["page"] = {
            "title": parsed.get("title"), "meta_description": parsed.get("meta_description"),
            "canonical": parsed.get("canonical"), "h1": parsed.get("h1"),
            "word_count": parsed.get("word_count"), "images": len(parsed.get("images") or []),
            "internal_links": len((parsed.get("links") or {}).get("internal") or []),
            "external_links": len((parsed.get("links") or {}).get("external") or []),
        }
        report["data"]["local"] = check_local(parsed, text, f)

        def _pre():
            import preload_check
            return preload_check.analyse(html_text, fetch.get("headers") or {})
        pre = run_step("preload", _pre, log)
        check_preload(pre, f)

        def _cq():
            import content_quality
            return content_quality.analyse(text)
        cq = run_step("content", _cq, log)
        check_content(cq, f)
        if cq:
            report["data"]["content"] = {k: cq.get(k) for k in
                                         ("tokens", "filler_score", "ai_pattern_score",
                                          "information_density", "repetition_score", "flags")}

    def _sm():
        import sitemap_discovery
        return sitemap_discovery.discover_sitemaps(final_url)
    sm = run_step("sitemaps", _sm, log)
    check_sitemaps(sm, f)
    if sm:
        report["data"]["sitemaps"] = {k: sm.get(k) for k in ("declared", "found", "warnings", "error")}

    def _ag():
        import agentic_check
        return agentic_check.audit(final_url)
    ag = run_step("ai_readiness", _ag, log)
    check_agentic(ag, f)
    if ag:
        report["data"]["ai_readiness_summary"] = ag.get("summary")

    if psi:
        def _psi():
            import pagespeed_check
            return pagespeed_check.combined_check(
                final_url, api_key=os.environ.get("PSI_API_KEY") or None, strategy="mobile")
        report["data"]["pagespeed"] = check_psi(run_step("pagespeed", _psi, log), f)

    items = f.sorted()
    counts = {s: 0 for s in ("critical", "high", "medium", "low")}
    for it in items:
        if it["severity"] in counts:
            counts[it["severity"]] += 1
    report["summary"] = counts
    report["findings"] = items
    report["steps"] = log
    return report


# ---------------------------------------------------------------- HTML report


def render_html(rep: dict) -> str:
    e = _html.escape
    host = urlparse(rep.get("final_url") or rep["url"]).netloc
    sev_color = {"critical": "#c45c4a", "high": "#c45c4a", "medium": "#b89a62", "low": "#8e9088"}
    rows = []
    for it in rep.get("findings", []):
        ev = it.get("evidence")
        ev_html = ""
        if ev:
            ev_html = f"<pre>{e(json.dumps(ev, indent=2, default=str)[:1200])}</pre>"
        rows.append(
            f"<article class='f'><div class='meta'><span class='sev' style='color:{sev_color.get(it['severity'], '#8e9088')}'>"
            f"{e(it['severity'].upper())}</span><span class='cat'>{e(it['category'])}</span></div>"
            f"<h3>{e(it['title'])}</h3>"
            + (f"<p class='d'>{e(it['detail'])}</p>" if it.get("detail") else "")
            + (f"<p class='fix'><b>Fix:</b> {e(it['fix'])}</p>" if it.get("fix") else "")
            + ev_html + "</article>"
        )
    s = rep.get("summary", {})
    tiles = "".join(
        f"<div class='tile'><span class='n' style='color:{sev_color[k]}'>{s.get(k, 0)}</span><span>{k}</span></div>"
        for k in ("critical", "high", "medium", "low")
    )
    failed = [x for x in rep.get("steps", []) if not x.get("ok")]
    failed_html = ""
    if failed:
        failed_html = "<p class='warn'>Some checks could not run: " + e(
            "; ".join(f"{x['step']} ({x.get('error', '')[:120]})" for x in failed)) + "</p>"
    page = rep.get("data", {}).get("page") or {}
    local = rep.get("data", {}).get("local") or {}
    facts = [
        ("Final URL", rep.get("final_url")), ("Title", page.get("title")),
        ("H1", ", ".join(page.get("h1") or [])[:160]), ("Words", page.get("word_count")),
        ("Schema types", ", ".join(local.get("schema_types") or []) or "none"),
        ("Phones on page", ", ".join(local.get("phones_on_page") or []) or "none"),
    ]
    facts_html = "".join(f"<dt>{e(k)}</dt><dd>{e(str(v if v is not None else '—'))}</dd>" for k, v in facts)
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SEO audit · {e(host)}</title>
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600&family=Fraunces:opsz,wght@9..144,600&family=IBM+Plex+Mono&display=swap" rel="stylesheet">
<style>
:root{{--ink:#0c0d0c;--paper:#f2f0e9;--sage:#c5d4cb;--muted:#6a6c66;--line:rgba(12,13,12,.12)}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--paper);color:var(--ink);font-family:Figtree,system-ui,sans-serif;line-height:1.5}}
.wrap{{max-width:860px;margin:0 auto;padding:32px 16px 64px}}
.k{{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}}
h1{{font-family:Fraunces,Georgia,serif;font-size:34px;margin:4px 0 4px;letter-spacing:-.01em}}
.sub{{color:var(--muted);font-size:14px}}
.tiles{{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:24px 0}}
.tile{{background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px;display:flex;flex-direction:column;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}}
.tile .n{{font-family:Fraunces,Georgia,serif;font-size:28px;letter-spacing:0}}
dl{{display:grid;grid-template-columns:140px 1fr;gap:6px 12px;font-size:14px;background:var(--sage);border-radius:12px;padding:16px;margin:0 0 24px}}
dt{{color:#3d4a42}}dd{{margin:0;word-break:break-word}}
.f{{background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px;margin:10px 0}}
.meta{{display:flex;gap:10px;font-size:11px;letter-spacing:.12em;font-family:'IBM Plex Mono',monospace}}
.cat{{color:var(--muted)}}h3{{margin:6px 0 4px;font-size:16px}}
.d{{margin:4px 0;color:var(--muted);font-size:14px}}.fix{{margin:6px 0 0;font-size:14px}}
pre{{font-family:'IBM Plex Mono',monospace;font-size:11px;background:#f7f6f1;border-radius:8px;padding:8px;overflow:auto;max-height:180px}}
.warn{{font-size:13px;color:#8a5a2c}}footer{{margin-top:32px;font-size:12px;color:var(--muted)}}
@media(max-width:560px){{.tiles{{grid-template-columns:repeat(2,1fr)}}dl{{grid-template-columns:1fr}}}}
</style></head><body><div class="wrap">
<p class="k">M2 Digital Solutions · SEO audit</p>
<h1>{e(host)}</h1>
<p class="sub">Checked {e(rep.get('checked_at', ''))} · live homepage, robots.txt, sitemaps, AI-crawler rules</p>
<div class="tiles">{tiles}</div>
<dl>{facts_html}</dl>
{failed_html}
{''.join(rows) or '<p>No issues found by these checks.</p>'}
<footer>Findings come from the live site. Checks adapted from Claude SEO (MIT, github.com/AgriciDaniel/claude-seo). No proxy traffic or authority metrics are used.</footer>
</div></body></html>"""


def main() -> int:
    ap = argparse.ArgumentParser(description="M2 SEO audit engine (keyless Claude SEO checks)")
    ap.add_argument("url")
    ap.add_argument("--json", action="store_true", help="Print the report as JSON")
    ap.add_argument("--html", help="Write a standalone HTML report to this path")
    ap.add_argument("--out-dir", help="Write <host>-<timestamp>.html and .json here; prints the HTML path")
    ap.add_argument("--psi", action="store_true",
                    help="Also run Google PageSpeed Insights (mobile). PSI_API_KEY optional.")
    ap.add_argument("--scripts-dir", help="Path to claude-seo/scripts")
    args = ap.parse_args()

    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError, OSError):
            pass

    rep = audit(args.url, scripts_dir=args.scripts_dir, psi=args.psi)
    if args.html:
        with open(args.html, "w", encoding="utf-8") as fh:
            fh.write(render_html(rep))
    if args.out_dir:
        os.makedirs(args.out_dir, exist_ok=True)
        host = re.sub(r"[^a-z0-9.-]", "_", urlparse(rep.get("final_url") or rep["url"]).netloc.lower()) or "site"
        stem = os.path.join(args.out_dir, f"{host}-{_dt.datetime.now().strftime('%Y%m%d-%H%M')}")
        with open(stem + ".html", "w", encoding="utf-8") as fh:
            fh.write(render_html(rep))
        with open(stem + ".json", "w", encoding="utf-8") as fh:
            json.dump(rep, fh, indent=2, default=str)
        print(f"REPORT={stem}.html")
        s = rep["summary"]
        print(f"Found {s['critical']} critical, {s['high']} high, {s['medium']} medium, {s['low']} low.")
        return 0
    if args.json:
        print(json.dumps(rep, default=str))
    elif not args.html:
        print(f"{rep['url']}  {rep['summary']}")
        for it in rep["findings"]:
            print(f"  [{it['severity']:>8}] {it['category']}: {it['title']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
