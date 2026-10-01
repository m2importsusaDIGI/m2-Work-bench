# --- Build stage ---
FROM node:22-slim AS build
WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# --- Run stage ---
FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production

# Only the built server output is needed at runtime — no node_modules,
# no source, no dev dependencies. Keeps the image small.
COPY --from=build /app/.output ./.output

# --- SEO audit engine (Python, keyless Claude SEO checks) ---
# Debian's python3 (3.11) in its own venv, plus Claude SEO pinned to the tag in
# seo-engine/CLAUDE_SEO_VERSION. Only its scripts are used; nothing is run at
# build time except pip.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*
COPY seo-engine ./seo-engine
RUN python3 -m venv /opt/seo-venv \
 && /opt/seo-venv/bin/pip install --no-cache-dir -r seo-engine/requirements.txt \
 && mkdir -p seo-engine/vendor/claude-seo \
 && curl -fsSL "https://github.com/AgriciDaniel/claude-seo/archive/refs/tags/$(tr -d '[:space:]' < seo-engine/CLAUDE_SEO_VERSION).tar.gz" \
    | tar -xz --strip-components=1 -C seo-engine/vendor/claude-seo \
 && test -f seo-engine/vendor/claude-seo/scripts/url_safety.py
ENV SEO_ENGINE_PYTHON=/opt/seo-venv/bin/python \
    SEO_ENGINE_SCRIPT=/app/seo-engine/m2_audit.py \
    CLAUDE_SEO_SCRIPTS=/app/seo-engine/vendor/claude-seo/scripts

EXPOSE 8080
ENV PORT=8080
CMD ["node", ".output/server/index.mjs"]
