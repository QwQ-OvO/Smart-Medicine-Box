import Fastify from "fastify";
import {
  parseRequestSchema,
  parseResponseSchema,
  type ParseRequest,
} from "@medicine/contracts";
import {
  ApiError,
  mockProvider,
  parseText,
  type Provider,
} from "./services/parse-service";
export type AppOptions = {
  mode?: "mock" | "live";
  provider?: Provider;
  timeoutMs?: number;
  maxRequests?: number;
  allowedOrigins?: string[];
};
export function buildApp(options: AppOptions = {}) {
  const mode = options.mode ?? "mock";
  if (mode === "live" && !options.provider)
    throw new Error("Live mode requires a provider");
  const app = Fastify({
    bodyLimit: 16384,
    ajv: { customOptions: { removeAdditional: false } },
    logger: false,
  });
  let active = 0;
  let start = Date.now();
  let used = 0;
  const origins = new Set(
    options.allowedOrigins ?? [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:3001",
      "http://127.0.0.1:3001",
    ],
  );
  app.addHook("onRequest", async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    const host = req.headers.host?.split(":")[0];
    if (host && !["localhost", "127.0.0.1"].includes(host))
      throw new ApiError(403, "ORIGIN_NOT_ALLOWED");
    if (req.headers.origin && !origins.has(req.headers.origin))
      throw new ApiError(403, "ORIGIN_NOT_ALLOWED");
  });
  app.setErrorHandler((err, req, reply) => {
    const e = err as {
      validation?: unknown;
      code?: string;
      statusCode?: number;
    };
    const status =
      err instanceof ApiError
        ? err.status
        : e.validation
          ? 422
          : (e.statusCode ?? 500);
    const code =
      err instanceof ApiError
        ? err.code
        : e.validation
          ? "VALIDATION_ERROR"
          : status === 413
            ? "PAYLOAD_TOO_LARGE"
            : status === 415
              ? "UNSUPPORTED_MEDIA_TYPE"
              : status === 400
                ? "INVALID_JSON"
                : "INTERNAL_ERROR";
    reply
      .code(status)
      .send({ error: { code, message: code }, requestId: req.id });
  });
  app.get("/api/v1/health", async () => ({ data: { status: "ok" } }));
  app.get("/api/v1/capabilities", async () => ({ data: { parseMode: mode } }));
  app.post<{ Body: ParseRequest }>(
    "/api/v1/parse-previews",
    {
      schema: {
        body: parseRequestSchema,
        response: { 200: parseResponseSchema },
      },
    },
    async (req, reply) => {
      if (Date.now() - start >= 60000) {
        start = Date.now();
        used = 0;
      }
      if (active >= 2 || used >= (options.maxRequests ?? 10)) {
        reply.header(
          "Retry-After",
          active >= 2
            ? "2"
            : String(
                Math.max(1, Math.ceil((60000 - Date.now() + start) / 1000)),
              ),
        );
        throw new ApiError(429, "RATE_LIMITED");
      }
      active++;
      used++;
      try {
        return {
          data: await parseText(
            req.body,
            options.provider ?? mockProvider,
            mode,
            options.timeoutMs,
          ),
          requestId: req.id,
        };
      } finally {
        active--;
      }
    },
  );
  return app;
}
