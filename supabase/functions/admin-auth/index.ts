import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ALLOWED_ORIGINS = new Set([
  "https://teemo1069.github.io",
  "https://waterblue-monster-timer.teem0.chatgpt.site",
]);

function responseHeaders(origin: string) {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Referrer-Policy": "no-referrer",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
  });

  if (ALLOWED_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Headers", "authorization, apikey, content-type");
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Max-Age", "600");
  }

  return headers;
}

Deno.serve((request: Request) => {
  const origin = request.headers.get("origin") ?? "";
  const headers = responseHeaders(origin);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: ALLOWED_ORIGINS.has(origin) ? 204 : 403,
      headers,
    });
  }

  return new Response(
    JSON.stringify({ error: "此網站已停用遠端管理員驗證" }),
    { status: 410, headers },
  );
});
