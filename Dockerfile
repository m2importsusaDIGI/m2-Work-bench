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

EXPOSE 8080
ENV PORT=8080
CMD ["node", ".output/server/index.mjs"]
