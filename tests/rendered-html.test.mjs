import assert from "node:assert/strict";
import test from "node:test";

async function loadWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  return (await import(workerUrl.href)).default;
}

const env = {
  ASSETS: {
    fetch: async () => new Response("Not found", { status: 404 }),
  },
};

const ctx = {
  waitUntil() {},
  passThroughOnException() {},
};

test("renders HTML with restrictive security headers", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(
    new Request("https://site.example/", { headers: { accept: "text/html" } }),
    env,
    ctx,
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.match(response.headers.get("content-security-policy") ?? "", /default-src 'self'/);
  assert.match(response.headers.get("content-security-policy") ?? "", /connect-src 'none'/);
  assert.doesNotMatch(await response.text(), /codex-preview|supabase\.co|sb_publishable_/i);
});

test("rejects methods the read-only site does not use", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(
    new Request("https://site.example/", { method: "POST", body: "unexpected" }),
    env,
    ctx,
  );

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET, HEAD");
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("keeps the unused dynamic image parser unreachable", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(
    new Request("https://site.example/_vinext/image?url=https://evil.example/a.svg&w=999999"),
    env,
    ctx,
  );

  assert.equal(response.status, 404);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});
