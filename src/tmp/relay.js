import dotenv from "dotenv";
dotenv.config({ path: "/srv/agentfoundry/vps-service/.env" });
import express from "express";
import { executeCode } from "./docker-executor.js";

const app = express();
app.use(express.json({ limit: "5mb" }));

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const SHARED_SECRET = process.env.SHARED_SECRET;
const VERCEL_URL = process.env.VERCEL_URL;
const VERCEL_EXECUTE_SECRET = process.env.VERCEL_EXECUTE_SECRET;

app.use((req, res, next) => {
  if (req.path === "/health") return next();
  const secret = req.headers["x-shared-secret"];
  if (!SHARED_SECRET || secret !== SHARED_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.post("/relay", async (req, res) => {
  const { pipelineId, runId, inputs, triggerType, webhookPayload } = req.body;

  if (!pipelineId || !runId) {
    return res.status(400).json({ error: "pipelineId and runId are required" });
  }

  res.json({ accepted: true, runId });

  try {
    console.log(`[Relay] Starting execution for run ${runId}`);
    const response = await fetch(
      `${VERCEL_URL}/api/pipelines/${pipelineId}/execute`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-execute-secret": VERCEL_EXECUTE_SECRET,
        },
        body: JSON.stringify({ runId, inputs, triggerType, webhookPayload }),
      }
    );
    console.log(
      `[Relay] Execute completed for run ${runId} — status ${response.status}`
    );
  } catch (err) {
    console.error(`[Relay] Execute failed for run ${runId}:`, err.message);
  }
});

// ── Code Execution ───────────────────────────────────────
app.post("/execute-code", async (req, res) => {
  const {
    runId,
    executionId,
    language,
    code,
    timeoutSeconds,
    needsNetwork,
  } = req.body;

  if (!runId || !language || !code) {
    return res.status(400).json({
      error: "runId, language, and code are required",
    });
  }

  console.log(
    `[Executor] Run ${runId} — executing ${language} code ` +
      `(timeout: ${timeoutSeconds ?? 120}s)`
  );

  try {
    const result = await executeCode({
      runId,
      executionId: executionId ?? Date.now().toString(),
      language,
      code,
      timeoutSeconds: timeoutSeconds ?? 120,
      needsNetwork: needsNetwork ?? false,
    });

    console.log(
      `[Executor] Run ${runId} — ${result.success ? "success" : "failed"} ` +
        `in ${result.duration_ms}ms`
    );

    res.json(result);
  } catch (err) {
    console.error(`[Executor] Run ${runId} — error:`, err.message);
    res.status(500).json({
      success: false,
      stdout: "",
      stderr: err.message,
      files: [],
      duration_ms: 0,
      exit_code: 1,
    });
  }
});

app.listen(PORT, () => {
  console.log(`[Relay] Agent Foundry relay running on port ${PORT}`);
  console.log(`[Relay] Forwarding to: ${VERCEL_URL}`);
  console.log(
    `[Relay] Shared secret: ${SHARED_SECRET ? "configured" : "NOT SET"}`
  );
});