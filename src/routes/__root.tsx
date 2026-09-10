import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import appCss from "../styles.css?url";

const APP_NAME = "M2 Workbench";

export const Route = createRootRoute({
head: () => ({
meta: [
{ charSet: "utf-8" },
{ name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
{ title: APP_NAME },
{
name: "description",
content:
"M2 Digital Solutions LLC execution console — crawl a site, fix schema, draft local SEO, score leads, and ship a work report.",
},
{ name: "theme-color", content: "#0c0d0c" },
],
links: [
{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
{ rel: "stylesheet", href: appCss },
{ rel: "preconnect", href: "https://fonts.googleapis.com" },
{ rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
{
rel: "stylesheet",
href:"https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,400;0,500;0,600;1,400&family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Mono:wght@400;500&display=swap",
},
],
}),
component: Root,
});

function Root() {
return (
<html lang="en" className="antialiased" suppressHydrationWarning>
<head>
<HeadContent />
</head>
<body className="bg-bg text-fg">
<Shell>
<Outlet />
</Shell>
<Scripts />
</body>
</html>
);
}
