/**
 * Cloudflare Worker: MiniMax TTS CORS Proxy
 *
 * Forwards requests to api.minimaxi.com and adds CORS headers.
 * Deploy on Cloudflare Workers, then set the worker URL in app MiniMax「代理」.
 *
 * Usage in app: proxy base URL e.g.
 *   https://minimax-tts-proxy.YOUR_SUBDOMAIN.workers.dev
 *
 * The app appends /v1/t2a_v2 (optional ?GroupId= for legacy) to this base URL.
 */

const MINIMAX_API = "https://api.minimaxi.com";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400"
};

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method === "GET") {
      const url = new URL(request.url);
      if (url.pathname === "/" || url.pathname === "") {
        return new Response(JSON.stringify({ ok: true, service: "minimax-tts-cf-proxy" }), {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      }
    }

    try {
      const url = new URL(request.url);
      const targetUrl = `${MINIMAX_API}${url.pathname}${url.search}`;

      const headers = new Headers();
      if (request.headers.has("Authorization")) {
        headers.set("Authorization", request.headers.get("Authorization"));
      }
      if (request.headers.has("Content-Type")) {
        headers.set("Content-Type", request.headers.get("Content-Type"));
      }

      const response = await fetch(targetUrl, {
        method: request.method,
        headers,
        body: request.method === "POST" ? request.body : undefined
      });

      const responseHeaders = new Headers(response.headers);
      for (const [key, value] of Object.entries(CORS_HEADERS)) {
        responseHeaders.set(key, value);
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: "Proxy error", message: err.message }), {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }
  }
};
