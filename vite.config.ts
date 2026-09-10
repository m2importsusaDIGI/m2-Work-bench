import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

export default defineConfig({
server: {
port: 8080,
host: "0.0.0.0",
},
resolve: {
tsconfigPaths: true,
},
plugins: [
tailwindcss(),
// tanstackStart's vite plugin must come before react's vite plugin
tanstackStart(),
viteReact(),
// bundles the server build to .output/server/index.mjs for `npm run start`
nitro(),
],
});
