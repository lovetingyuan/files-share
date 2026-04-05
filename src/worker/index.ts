import { Hono } from "hono";
import type { Context } from "hono";
import { csrf } from "hono/csrf";
import { UserDO } from "./durable-objects/UserDO";
import { authMiddleware, requireAuth } from "./middleware/auth";
import type { AppContext } from "./context";
import { applyCorsHeaders, isAllowedOrigin } from "./utils/appHelpers";
import { jsonError } from "./utils/response";
import authRoutes from "./routes/auth";
import profileRoutes from "./routes/profile";
import fileRoutes from "./routes/files";
import shareRoutes from "./routes/shares";

export { UserDO };

const app = new Hono<AppContext>();

app.get("/health", (c) => c.json({ status: "ok", time: new Date().toISOString() }));

app.use("/api/*", async (c, next) => {
  const origin = c.req.header("Origin");
  if (origin && !isAllowedOrigin(c, origin)) {
    return jsonError(c, "Origin not allowed", 403);
  }

  if (c.req.method === "OPTIONS") {
    const headers = new Headers();
    if (origin) {
      applyCorsHeaders(headers, origin);
    }
    return new Response(null, { status: 204, headers });
  }

  await next();

  if (origin && isAllowedOrigin(c, origin)) {
    applyCorsHeaders(c.res.headers, origin);
  }
});

app.use(
  "/api/*",
  csrf({
    origin: (origin, c) => isAllowedOrigin(c as Context<AppContext>, origin),
  }),
);

app.use("/api/*", authMiddleware());
app.use("/api/profile/*", requireAuth());
app.use("/api/files/*", requireAuth());

app.route("/", authRoutes);
app.route("/", profileRoutes);
app.route("/", fileRoutes);
app.route("/", shareRoutes);

export default app;
