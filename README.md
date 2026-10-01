# M2 Workbench

Agency ops console for M2 Digital Solutions LLC. Enter a local business, run
an engagement, get schema, local SEO, visibility, leads, and outreach — all
downloadable as a work report.

Rebuilt as a standalone Vite + TanStack Start project from the original
source handoff. The Grok App Builder platform scaffold (auth, database,
`/__grok` PWA injector, preview host bridge) has been removed, matching the
handoff doc's own "drop on a greenfield Vite+TanStack app" instruction —
this app has auth and a database OFF regardless.

## Run it

```bash
npm install
cp .env.example .env      # optional — see below
npm run dev
```

Open **http://localhost:8080** on your computer. On your phone, use your
computer's LAN IP instead of `localhost` (e.g. `http://192.168.1.23:8080`) —
both devices need to be on the same network. `npm run dev` binds to
`0.0.0.0` so this works out of the box.

For an always-on mobile-reachable copy, deploy it (Vercel, Netlify, Fly.io,
a VPS, etc.). `npm run build` bundles a production server to
`.output/server/index.mjs`; `npm run start` runs it.

## The xAI key (optional)

Two things use `XAI_API_KEY` server-side (never exposed to the browser):

- **Outreach/schema copy** (`src/lib/engine.server.ts`) — AI-drafted email,
  WhatsApp, and JSON-LD notes. Without a key, template-based fallback copy
  is used instead — the app still fully works.
- **Off-site mention search** (`src/lib/visibility.server.ts`) — live web
  search for news/social mentions. Without a key, this step is skipped and
  the visibility score is built from the other on-site + RSS + Wikipedia
  signals only.

Get a key at console.x.ai, put it in `.env` as `XAI_API_KEY=...`. Never
prefix it `VITE_` — that would ship it to the browser.

## What's real vs. best-effort

- **Crawling** the target's homepage happens server-side (`crawl.server.ts`),
  so it isn't limited by browser CORS. It refuses private/internal hosts
  (SSRF guard).
- **Visibility/social** scanning hits public RSS/Wikipedia/social endpoints
  directly — some sites occasionally block scripted requests; the app
  degrades gracefully per-source rather than failing the whole run.
- **Leads and outreach copy** use the AI model when a key is present, and a
  competent template fallback otherwise — both paths are fully wired.

## Presets

Two ready-made targets are in `src/lib/modules.ts` for a fast first run:
Founding Farmers (DC restaurant) and Ben's Chili Bowl (DC landmark eatery).

## CRM

A lightweight CRM lives at `/crm` (`src/routes/crm.tsx`):

- **Contacts** with a 5-stage pipeline (Prospecting → Contacted → Qualified →
  Won / Lost), notes, and per-contact tasks.
- **"Add to CRM"** on the Leads tab of any job's results turns a scored lead
  into a contact (deduped by business name / website).
- **"Save to CRM + schedule follow-ups"** on the Outreach tab creates a
  contact for that job's target and turns its day-3/day-7 follow-ups into
  real dated tasks.
- A **"Follow-ups due"** panel on `/crm` surfaces upcoming and overdue tasks
  across all contacts.
- **"Find prospects"** on `/crm` searches by industry + location (e.g. "roofing"
  in "Alexandria, VA") — no business name or website needed up front, and no
  API key or billing account either. It geocodes the location with Nominatim,
  then runs an Overpass query for named businesses matching that industry
  within a fixed ~20-mile radius (all free, keyless OpenStreetMap services).
  For any result with a website, it reuses the existing crawler
  (`src/lib/crawl.server.ts`) to pick up linked social profiles (LinkedIn,
  Facebook, Instagram, etc.). Results are deduped against existing contacts
  by website/business name before you add them — "Add all new to CRM" skips
  anything already there. Coverage depends on OpenStreetMap data density for
  the area/industry, so it can miss businesses a paid directory like Google
  would catch — trade-off for zero cost. Runs in `src/lib/prospect.server.ts`,
  exposed via `findProspects` in `src/lib/fns.ts`.

Every job you run (via the target form) also auto-creates or matches a CRM
contact — location and niche are optional on that form and can be filled in
later from the contact card.

Contacts and tasks persist the same way jobs do — `localStorage`, same
`m2-workbench-v1` key, not synced across devices. State and actions live in
`src/lib/store.ts` (`contacts`, `tasks`, `addContact`, `addContactFromLead`,
`addContactFromTarget`, `addFollowUpTasks`, etc.); types are in
`src/lib/types.ts` (`Contact`, `Task`, `PipelineStage`).

## Notes for further work

- Jobs persist in `localStorage` under key `m2-workbench-v1` (Zustand
  `persist`, `skipHydration: true`) — not synced across devices/browsers.
- Never `.filter()` inside a Zustand selector — causes an infinite render
  loop (React error #185). See `src/lib/store.ts` for the existing pattern.
- `src/routes/reports.tsx` is a layout route — it only renders `<Outlet />`;
  the actual list is `reports.index.tsx`.
- Design tokens live in `src/styles.css` under `@theme` — keep to the
  existing ink/paper/sage palette, no purple, no gold, no emoji icons
  (lucide-react only).

## SEO audit engine (Audit page)

`/audit` runs `seo-engine/m2_audit.py`, a Python wrapper around the keyless
checks in [Claude SEO](https://github.com/AgriciDaniel/claude-seo) (MIT,
pinned in `seo-engine/CLAUDE_SEO_VERSION`). It checks the live homepage,
robots.txt, sitemaps, LocalBusiness schema and NAP, AI-crawler rules,
llms.txt, bfcache/preload hints, and content-quality heuristics. No API key;
`PSI_API_KEY` is optional for the PageSpeed toggle.

- **Deployed:** the Dockerfile installs Python and the pinned Claude SEO
  release, so Railway/Render need no extra setup.
- **Local `npm run dev`:** needs Python 3.10+ with
  `pip install -r seo-engine/requirements.txt`, and `CLAUDE_SEO_SCRIPTS`
  pointing at a `claude-seo/scripts` folder (see `.env.example`).
- **Standalone on Windows:** copy `tools/M2-SEO-Audit.bat` to the Desktop and
  double-click it. First run installs everything into
  `%LOCALAPPDATA%\M2SEOAudit`; reports open in the browser and are saved to
  `Documents\M2 SEO Audits`.

There is deliberately no 0-100 score: findings are graded critical / high /
medium / low from what the site actually serves.
