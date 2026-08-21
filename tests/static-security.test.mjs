import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("GitHub Pages output contains a restrictive meta CSP and no backend key", async () => {
  const html = await readFile(new URL("../dist-github/index.html", import.meta.url), "utf8");

  assert.match(html, /http-equiv=["']Content-Security-Policy["']/i);
  assert.match(html, /connect-src 'none'/i);
  assert.match(html, /script-src 'self'/i);
  assert.doesNotMatch(html, /supabase\.co|sb_publishable_|unsafe-eval/i);
});

test("deployment workflow pins third-party Actions and runs the security gate", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/pages.yml", import.meta.url),
    "utf8",
  );
  const refs = [...workflow.matchAll(/uses:\s*[^@\s]+@([^\s#]+)/g)].map((match) => match[1]);

  assert.ok(refs.length > 0);
  for (const ref of refs) assert.match(ref, /^[0-9a-f]{40}$/);
  assert.match(workflow, /persist-credentials:\s*false/);
  assert.match(workflow, /npm run security:audit/);
  assert.doesNotMatch(workflow, /pull_request_target/);
});
