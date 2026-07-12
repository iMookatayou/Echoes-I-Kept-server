import express from "express";
import cors from "cors";
import { hasSupabaseConfig, supabase } from "./supabaseClient.js";

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "server",
    endpoints: ["/health", "/health/db"],
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "server" });
});

app.get("/health/db", async (_req, res) => {
  if (!hasSupabaseConfig()) {
    return res.status(500).json({
      ok: false,
      database: "missing_config",
      message: "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env",
    });
  }

  const { error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1,
  });

  if (error) {
    return res.status(500).json({
      ok: false,
      database: "connection_failed",
      message: error.message,
    });
  }

  return res.json({ ok: true, database: "connected" });
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
