import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { join } from "node:path";
import { createApp } from "./app.mjs";
let bills = null;
if (process.env.REDIS_URL && process.env.BILLS_ENABLED === "1") { const { createBillQueue } = await import("./bills.mjs"); bills = createBillQueue({ redisUrl: process.env.REDIS_URL, privateDir: process.env.BILLS_DIR ?? join(new URL("..", import.meta.url).pathname, "data", "private-bills") }); }
const app = createApp({ bills });
const root = new URL("../web/dist", import.meta.url).pathname;
app.use("/*", serveStatic({ root: process.env.OTS_WEB_DIST ?? root }));
app.get("*", serveStatic({ path: join(process.env.OTS_WEB_DIST ?? root, "index.html") }));
const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port, hostname: process.env.HOST ?? "127.0.0.1" }, () => console.log(`OTS comparison on http://${process.env.HOST ?? "127.0.0.1"}:${port}`));
