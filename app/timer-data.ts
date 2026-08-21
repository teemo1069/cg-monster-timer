export const SERVERS = ["櫻之舞", "卡連", "露比", "獅子", "歌姬", "雙子"] as const;
export const MULTIPLIERS = Array.from({ length: 101 }, (_, index) => (100 + index) / 100);
export const MAX_TIMERS = 200;
export const MAX_STORAGE_CHARS = 250_000;

const MIN_TIMESTAMP = Date.UTC(2000, 0, 1);
const MAX_TIMESTAMP = Date.UTC(2100, 0, 1);
const UNSAFE_TEXT = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g;

export type Server = (typeof SERVERS)[number];
export type Timer = {
  id: string;
  server: Server;
  monster: string;
  multiplier: number;
  appearedAt: number;
  createdAt: number;
};

export function sanitizeMonster(value: string): string {
  return value.normalize("NFKC").replace(UNSAFE_TEXT, "").trim().slice(0, 30);
}

export function isSafeTimestamp(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= MIN_TIMESTAMP &&
    value <= MAX_TIMESTAMP
  );
}

export function sanitizeTimers(value: unknown): Timer[] {
  if (!Array.isArray(value)) return [];

  const result: Timer[] = [];
  const ids = new Set<string>();

  for (const candidate of value) {
    if (result.length >= MAX_TIMERS) break;
    if (!candidate || typeof candidate !== "object") continue;

    const timer = candidate as Partial<Timer>;
    if (
      typeof timer.id !== "string" ||
      timer.id.length === 0 ||
      timer.id.length > 128 ||
      typeof timer.monster !== "string" ||
      timer.monster.length > 200 ||
      !SERVERS.includes(timer.server as Server) ||
      !isSafeTimestamp(timer.appearedAt) ||
      !isSafeTimestamp(timer.createdAt)
    ) {
      continue;
    }

    const id = timer.id.replace(UNSAFE_TEXT, "").slice(0, 64);
    if (!id || ids.has(id)) continue;
    ids.add(id);

    result.push({
      id,
      server: timer.server as Server,
      monster: sanitizeMonster(timer.monster) || "未命名魔物",
      multiplier:
        typeof timer.multiplier === "number" && MULTIPLIERS.includes(timer.multiplier)
          ? timer.multiplier
          : 1,
      appearedAt: timer.appearedAt,
      createdAt: timer.createdAt,
    });
  }

  return result;
}
