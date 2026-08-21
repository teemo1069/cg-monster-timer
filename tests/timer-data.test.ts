import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_TIMERS,
  sanitizeMonster,
  sanitizeTimers,
  type Timer,
} from "../app/timer-data.ts";

const timestamp = Date.UTC(2026, 7, 21, 7, 0);

function timer(overrides: Partial<Timer> = {}): Timer {
  return {
    id: crypto.randomUUID(),
    server: "櫻之舞",
    monster: "大象",
    multiplier: 1.25,
    appearedAt: timestamp,
    createdAt: timestamp,
    ...overrides,
  };
}

test("removes control and bidirectional override characters from names", () => {
  assert.equal(sanitizeMonster("  骷髏\u202e<script>\u0000  "), "骷髏<script>");
});

test("copies only known timer fields and normalizes invalid multipliers", () => {
  const malicious = {
    ...timer({ multiplier: 9 }),
    __proto__: { polluted: true },
    extra: "discard me",
  };
  const [cleaned] = sanitizeTimers([malicious]);

  assert.equal(cleaned.multiplier, 1);
  assert.equal(Object.hasOwn(cleaned, "extra"), false);
  assert.equal(Object.hasOwn(cleaned, "__proto__"), false);
});

test("rejects invalid timestamps, servers, duplicates, and oversized identifiers", () => {
  const valid = timer({ id: "same" });
  const cleaned = sanitizeTimers([
    valid,
    timer({ id: "same" }),
    timer({ appearedAt: Number.MAX_VALUE }),
    timer({ server: "假伺服器" as Timer["server"] }),
    timer({ id: "x".repeat(129) }),
  ]);

  assert.equal(cleaned.length, 1);
  assert.equal(cleaned[0].id, "same");
});

test("caps imported data before it can overwhelm rendering", () => {
  const imported = Array.from({ length: MAX_TIMERS + 50 }, (_, index) =>
    timer({ id: `timer-${index}` }),
  );
  assert.equal(sanitizeTimers(imported).length, MAX_TIMERS);
});
