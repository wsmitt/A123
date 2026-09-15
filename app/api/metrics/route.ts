import os from "node:os";

export const runtime = "nodejs";

// Real host telemetry only — session (turn/byte) counts live in the browser
// and are computed client-side in lib/useMetrics.ts, since this is a
// single-user app with no server-side session store.
export async function GET() {
  const loadAvg = os.loadavg()[0];
  const cpuCount = os.cpus().length || 1;
  const cpuLoadPct = Math.min(100, Math.round((loadAvg / cpuCount) * 100));

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  return Response.json({
    cpuLoadPct,
    memUsedGB: Number((usedMem / 1024 ** 3).toFixed(1)),
    memTotalGB: Number((totalMem / 1024 ** 3).toFixed(1)),
    uptimeSec: Math.round(os.uptime()),
    platform: os.platform(),
    cpuCount: os.cpus().length,
    nodeVersion: process.version,
    timestamp: Date.now(),
  });
}
