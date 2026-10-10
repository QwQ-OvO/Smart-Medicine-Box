import { buildApp } from "./app";
import { liveProvider } from "./services/live-provider";
import staticPlugin from "@fastify/static";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
const mode = process.env.AI_MODE === "live" ? "live" : "mock";
if (
  mode === "live" &&
  (!process.env.AI_URL || !process.env.AI_KEY || !process.env.AI_MODEL)
)
  throw new Error("Live mode requires AI_URL, AI_KEY, AI_MODEL");
const app = buildApp({
  mode,
  provider:
    mode === "live"
      ? liveProvider({
          url: process.env.AI_URL!,
          key: process.env.AI_KEY!,
          model: process.env.AI_MODEL!,
        })
      : undefined,
});
const root = fileURLToPath(new URL("../../web/dist/", import.meta.url));
if (existsSync(root)) {
  await app.register(staticPlugin, { root });
  app.setNotFoundHandler((req, reply) =>
    req.url.startsWith("/api/")
      ? reply
          .code(404)
          .send({ error: { code: "NOT_FOUND" }, requestId: req.id })
      : reply.sendFile("index.html"),
  );
}
await app.listen({ host: "127.0.0.1", port: 3001 });
console.log(`Ready: http://127.0.0.1:3001 (${mode})`);
