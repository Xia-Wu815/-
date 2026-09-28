/**
 * Vercel Serverless Function: MiniMax TTS Proxy
 *
 * Routes:
 *   GET  /api/minimax-tts          → Health check (ping)
 *   GET  /api/minimax-tts?diag=1   → Upstream diagnostic (test MiniMax reachability)
 *   POST /api/minimax-tts → Proxy forward to MiniMax T2A v2（Bearer only）
 *   POST /api/minimax-tts?GroupId=X → 旧版账号可选带 GroupId
 */

export const config = {
  maxDuration: 60
};

const UPSTREAM_BASE = "https://api.minimaxi.com/v1/t2a_v2";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "GET") {
    if (req.query.diag === "1") {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const upstream = await fetch(UPSTREAM_BASE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "speech-2.8-hd",
            text: "diag",
            stream: false,
            voice_setting: { voice_id: "female-shaonv", speed: 1, vol: 1, pitch: 0 },
            audio_setting: { sample_rate: 32000, bitrate: 128000, format: "mp3" }
          }),
          signal: controller.signal
        });
        clearTimeout(timer);
        const body = await upstream.text();
        return res.status(200).json({
          ok: true,
          diag: true,
          upstream_status: upstream.status,
          upstream_body_preview: body.substring(0, 200),
          node: process.version,
          region: process.env.VERCEL_REGION || "unknown"
        });
      } catch (e) {
        return res.status(200).json({
          ok: false,
          diag: true,
          error: e.message || "upstream unreachable",
          node: process.version,
          region: process.env.VERCEL_REGION || "unknown"
        });
      }
    }

    return res.status(200).json({
      ok: true,
      service: "minimax-tts-proxy",
      node: process.version,
      region: process.env.VERCEL_REGION || "unknown",
      ts: Date.now()
    });
  }

  if (req.method === "POST") {
    const groupId = String(req.query.GroupId || req.query.groupId || "").trim();

    const authHeader = req.headers["authorization"] || req.headers["Authorization"];
    if (!authHeader) {
      return res.status(401).json({ error: "Missing Authorization header" });
    }

    try {
      const upstreamUrl = groupId
        ? `${UPSTREAM_BASE}?GroupId=${encodeURIComponent(groupId)}`
        : UPSTREAM_BASE;

      let bodyToSend;
      if (typeof req.body === "string") {
        bodyToSend = req.body;
      } else if (req.body && typeof req.body === "object") {
        bodyToSend = JSON.stringify(req.body);
      } else {
        const chunks = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        bodyToSend = Buffer.concat(chunks).toString("utf-8");
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);

      const upstream = await fetch(upstreamUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader
        },
        body: bodyToSend,
        signal: controller.signal
      });
      clearTimeout(timer);

      const contentType = upstream.headers.get("content-type") || "application/json";
      const responseBody = await upstream.text();

      res.setHeader("Content-Type", contentType);
      return res.status(upstream.status).send(responseBody);
    } catch (e) {
      console.error("[minimax-tts] Proxy error:", e);
      if (e.name === "AbortError") {
        return res.status(504).json({ error: "Upstream timeout (30s)" });
      }
      return res.status(502).json({ error: `Proxy error: ${e.message}` });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
