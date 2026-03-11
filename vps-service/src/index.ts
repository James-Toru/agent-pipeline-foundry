/**
 * Agent Foundry — VPS Pipeline Executor
 *
 * A standalone Express server that executes pipeline runs without
 * timeout limits. Vercel delegates execution here via POST /execute.
 *
 * Authentication: Every request must include an `x-shared-secret` header
 * matching the VPS_SHARED_SECRET environment variable.
 */

import "dotenv/config";
import express from "express";
import { loadSettingsIntoEnv } from "@/lib/settings-manager";
import { runPipeline } from "@/lib/orchestrator";
import type { PipelineSpec } from "@/types/pipeline";

const app = express();
app.use(express.json({ limit: "5mb" }));

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const SHARED_SECRET = process.env.VPS_SHARED_SECRET;

// ── Auth Middleware ──────────────────────────────────────────────────────────

function authenticate(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  if (!SHARED_SECRET) {
    res.status(500).json({ error: "VPS_SHARED_SECRET is not configured on the server." });
    return;
  }

  const provided = req.headers["x-shared-secret"];
  if (provided !== SHARED_SECRET) {
    res.status(401).json({ error: "Unauthorized — invalid shared secret." });
    return;
  }

  next();
}

// ── Health Check ────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "agent-foundry-vps-executor",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ── Execute Pipeline ────────────────────────────────────────────────────────

app.post("/execute", authenticate, (req, res) => {
  const { run_id, spec, input_data } = req.body as {
    run_id: string;
    spec: PipelineSpec;
    input_data: Record<string, unknown>;
  };

  if (!run_id || !spec) {
    res.status(400).json({ error: "run_id and spec are required." });
    return;
  }

  // Acknowledge immediately — execution happens in background
  res.json({
    accepted: true,
    run_id,
    message: "Pipeline execution started on VPS.",
  });

  // Fire-and-forget: run the pipeline asynchronously
  runPipeline(run_id, spec, input_data ?? {}).catch(async (err) => {
    console.error(`[VPS] Pipeline run ${run_id} failed:`, err);

    // Safety net: mark run as failed if orchestrator didn't already
    try {
      const { createSupabaseServerClient } = await import(
        "@/lib/supabase-server"
      );
      const supabase = await createSupabaseServerClient();
      const { data } = await supabase
        .from("pipeline_runs")
        .select("status")
        .eq("id", run_id)
        .single();

      if (data?.status !== "failed" && data?.status !== "cancelled") {
        const errorMsg =
          err instanceof Error ? err.message : String(err);
        await supabase
          .from("pipeline_runs")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_code: "UNKNOWN_ERROR",
            error_message: errorMsg,
            error_user_message:
              "An unexpected error occurred during this pipeline run.",
            error_action:
              "Check the error details below. If the problem persists contact support with the run ID.",
          })
          .eq("id", run_id);
      }
    } catch (cleanupErr) {
      console.error("[VPS] Failed to update run status after error:", cleanupErr);
    }
  });
});

// ── Start Server ────────────────────────────────────────────────────────────

async function start() {
  // Load credentials from Supabase (same as Next.js instrumentation.ts)
  try {
    await loadSettingsIntoEnv();
    console.log("[VPS] Settings loaded from Supabase");
  } catch (err) {
    console.warn(
      "[VPS] Could not load settings from Supabase — using .env only:",
      err instanceof Error ? err.message : err
    );
  }

  app.listen(PORT, () => {
    console.log(`[VPS] Agent Foundry Pipeline Executor running on port ${PORT}`);
    console.log(`[VPS] Health check: http://localhost:${PORT}/health`);
    console.log(
      `[VPS] Shared secret: ${SHARED_SECRET ? "configured" : "NOT SET — requests will be rejected"}`
    );
  });
}

start();
